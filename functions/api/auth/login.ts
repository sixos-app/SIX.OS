import { createSession, getAccessUser, getEffectiveCapabilities, sessionCookie, verifyPassword, type Bindings } from '../_access'

type LoginPayload = { username?: unknown; password?: unknown }

const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

type LoginAttemptRow = {
  attempts: number
  windowStartedAt: string
  blockedUntil: string | null
}

async function loginIdentifier(request: Request, username: string) {
  const clientAddress = request.headers.get('CF-Connecting-IP') || 'local'
  const input = new TextEncoder().encode(`${username}:${clientAddress}`)
  const hash = await crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function getLoginAttempt(env: Bindings, identifierHash: string) {
  return env.DB.prepare(`
    SELECT attempts, window_started_at AS windowStartedAt, blocked_until AS blockedUntil
    FROM auth_login_attempts
    WHERE identifier_hash = ?
  `).bind(identifierHash).first<LoginAttemptRow>()
}

async function registerLoginFailure(env: Bindings, identifierHash: string, current: LoginAttemptRow | null) {
  const now = Date.now()
  const windowIsActive = current && now - Date.parse(current.windowStartedAt) < LOGIN_WINDOW_MS
  const attempts = windowIsActive ? current.attempts + 1 : 1
  const windowStartedAt = windowIsActive ? current.windowStartedAt : new Date(now).toISOString()
  const blockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(now + LOGIN_WINDOW_MS).toISOString() : null

  await env.DB.prepare(`
    INSERT INTO auth_login_attempts (identifier_hash, attempts, window_started_at, blocked_until, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(identifier_hash) DO UPDATE SET
      attempts = excluded.attempts,
      window_started_at = excluded.window_started_at,
      blocked_until = excluded.blocked_until,
      updated_at = excluded.updated_at
  `).bind(identifierHash, attempts, windowStartedAt, blockedUntil, new Date(now).toISOString()).run()
}

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

  const identifierHash = await loginIdentifier(request, username)
  const attempt = await getLoginAttempt(env, identifierHash)
  if (attempt?.blockedUntil && Date.parse(attempt.blockedUntil) > Date.now()) {
    const retryAfter = Math.max(1, Math.ceil((Date.parse(attempt.blockedUntil) - Date.now()) / 1000))
    return Response.json(
      { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  let passwordIsValid = false
  try {
    passwordIsValid = await verifyPassword(env, username, password)
  } catch (error) {
    console.error('[auth] Password verification failed', error instanceof Error ? error.name : 'UnknownError')
  }

  let user = passwordIsValid ? await env.DB?.prepare(`
    SELECT id, organization_id AS organizationId, team_id AS teamId, name, email, role
    FROM users
    WHERE (username = ? OR lower(email) = ?) AND status = 'active'
    LIMIT 1
  `).bind(username, username).first<{ id: string }>().catch(() => null) : null

  if (!user) {
    await registerLoginFailure(env, identifierHash, attempt)
    return Response.json({ error: 'Login ou senha inválidos' }, { status: 401 })
  }

  await env.DB.prepare('DELETE FROM auth_login_attempts WHERE identifier_hash = ?').bind(identifierHash).run()
  await env.DB.prepare("DELETE FROM auth_login_attempts WHERE updated_at < datetime('now', '-1 day')").run()

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
