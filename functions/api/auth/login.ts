import { createSession, getAccessUser, getEffectiveCapabilities, sessionCookie, verifyPassword, type Bindings } from '../_access'

type LoginPayload = { username?: unknown; password?: unknown }

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  let payload: LoginPayload

  try {
    payload = await request.json() as LoginPayload
  } catch {
    return Response.json({ error: 'Dados de acesso inválidos' }, { status: 400 })
  }

  const username = typeof payload.username === 'string' ? payload.username.trim().toLocaleLowerCase('en-US') : ''
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (!username || !password || username.length > 80 || password.length > 256) return Response.json({ error: 'Login ou senha inválidos' }, { status: 401 })

  let passwordIsValid = await verifyPassword(env, username, password).catch(() => false)

  let user = passwordIsValid ? await env.DB?.prepare(`
    SELECT id, organization_id AS organizationId, team_id AS teamId, name, email, role
    FROM users
    WHERE (username = ? OR email = ?) AND status = 'active'
    LIMIT 1
  `).bind(username, username).first<{ id: string }>().catch(() => null) : null

  if (!user) return Response.json({ error: 'Login ou senha inválidos' }, { status: 401 })

  const session = await createSession(env, user.id).catch(() => null)
  
  let authenticatedUser = null
  let capabilities = {}
  
  if (session) {
    const pseudoRequest = new Request(request.url, { headers: { Cookie: `sixos_session=${session.token}` } })
    authenticatedUser = await getAccessUser(pseudoRequest, env).catch(() => null)
    if (authenticatedUser) {
      capabilities = await getEffectiveCapabilities(env, pseudoRequest, authenticatedUser).catch(() => ({}))
    }
  }

  if (!authenticatedUser) {
    return Response.json({ error: 'Erro ao inicializar sessão' }, { status: 500 })
  }

  const responseHeaders = new Headers({ 'Content-Type': 'application/json' })
  if (session) {
    responseHeaders.set('Set-Cookie', sessionCookie(session.token, request))
  }

  return Response.json({ user: authenticatedUser, capabilities }, { headers: responseHeaders })
}
