import { createSession, getAccessUser, sessionCookie, verifyPassword, type Bindings } from '../_access'

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

  const passwordIsValid = await verifyPassword(env, username, password)
  const user = passwordIsValid ? await env.DB.prepare(`
    SELECT id, organization_id AS organizationId, team_id AS teamId, name, email, role
    FROM users
    WHERE username = ?
    LIMIT 1
  `).bind(username).first<{ id: string }>() : null
  if (!user) return Response.json({ error: 'Login ou senha inválidos' }, { status: 401 })

  const session = await createSession(env, user.id)
  const authenticatedUser = await getAccessUser(new Request(request.url, { headers: { Cookie: `sixos_session=${session.token}` } }), env)
  if (!authenticatedUser) return Response.json({ error: 'Não foi possível iniciar a sessão' }, { status: 500 })

  return Response.json({ user: authenticatedUser }, { headers: { 'Set-Cookie': sessionCookie(session.token, request) } })
}
