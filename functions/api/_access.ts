export type Bindings = { DB: D1Database }

export type AccessUser = {
  id: string
  organizationId: string
  teamId: string | null
  name: string
  email: string
  role: string
}

type CredentialRow = {
  passwordSalt: string
  passwordHash: string
  iterations: number
}

const encoder = new TextEncoder()

const rolePermissions: Record<string, readonly string[]> = {
  admin: ['users.manage', 'roles.manage', 'gamification.manage', 'projects.create', 'projects.manage', 'missions.assign', 'missions.approve', 'missions.update_own', 'clients.manage', 'library.manage', 'finance.view', 'ai.use', 'reports.view', 'agenda.team.view'],
  management: ['projects.create', 'projects.manage', 'missions.approve', 'clients.manage', 'library.manage', 'ai.use', 'reports.view', 'agenda.team.view'],
  coordinator: ['projects.manage', 'missions.assign', 'missions.approve', 'agenda.team.view'],
  service: ['projects.create', 'clients.manage', 'agenda.team.view'],
  specialist: ['missions.update_own'],
}

function parseCookies(request: Request) {
  return Object.fromEntries((request.headers.get('cookie') ?? '').split(';').map((item) => {
    const [key, ...value] = item.trim().split('=')
    return [key, value.join('=')]
  }).filter(([key]) => key))
}

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function getUserByCondition(env: Bindings, condition: string, value: string) {
  return env.DB.prepare(`
    SELECT
      users.id,
      users.organization_id AS organizationId,
      users.team_id AS teamId,
      users.name,
      users.email,
      COALESCE(user_role_assignments.role_code, users.role) AS role
    FROM users
    LEFT JOIN user_role_assignments ON user_role_assignments.user_id = users.id
    WHERE ${condition} = ?
    LIMIT 1
  `).bind(value).first<AccessUser>()
}

export async function getAccessUser(request: Request, env: Bindings): Promise<AccessUser | null> {
  const accessEmail = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim().toLocaleLowerCase('en-US')
  if (accessEmail) return (await getUserByCondition(env, 'users.email', accessEmail)) ?? null

  const sessionToken = parseCookies(request).sixos_session
  if (!sessionToken) return null

  const tokenHash = await digest(sessionToken)
  const session = await env.DB.prepare(`
    SELECT
      auth_sessions.expires_at AS expiresAt,
      users.id,
      users.organization_id AS organizationId,
      users.team_id AS teamId,
      users.name,
      users.email,
      COALESCE(user_role_assignments.role_code, users.role) AS role
    FROM auth_sessions
    JOIN users ON users.id = auth_sessions.user_id
    LEFT JOIN user_role_assignments ON user_role_assignments.user_id = users.id
    WHERE auth_sessions.token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first<AccessUser & { expiresAt: string }>()

  if (!session) return null
  if (Date.parse(session.expiresAt) > Date.now()) {
    const { expiresAt: _expiresAt, ...user } = session
    return user
  }

  await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(tokenHash).run()
  return null
}

export async function verifyPassword(env: Bindings, username: string, password: string) {
  const credential = await env.DB.prepare(`
    SELECT user_credentials.password_salt AS passwordSalt, user_credentials.password_hash AS passwordHash, user_credentials.iterations
    FROM user_credentials
    JOIN users ON users.id = user_credentials.user_id
    WHERE users.username = ?
    LIMIT 1
  `).bind(username).first<CredentialRow>()

  if (!credential) return false

  const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: credential.iterations, salt: fromBase64(credential.passwordSalt) }, passwordKey, 256)
  return sameBytes(new Uint8Array(derivedBits), fromBase64(credential.passwordHash))
}

export async function createSession(env: Bindings, userId: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString()

  await env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run()
  await env.DB.prepare('INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), userId, await digest(token), expiresAt).run()

  return { token, expiresAt }
}

export async function deleteSession(request: Request, env: Bindings) {
  const sessionToken = parseCookies(request).sixos_session
  if (sessionToken) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await digest(sessionToken)).run()
}

export function sessionCookie(token: string, request: Request, maxAge = 60 * 60 * 12) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `sixos_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
}

export function accessRequiredResponse() {
  return Response.json({ error: 'Autenticação necessária' }, { status: 401 })
}

export function hasPermission(user: AccessUser, permission: string) {
  return rolePermissions[user.role]?.includes(permission) ?? false
}

export function permissionRequiredResponse() {
  return Response.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 })
}
