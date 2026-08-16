export type Bindings = { 
  DB: D1Database
  CF_ACCESS_TEAM_DOMAIN?: string
  CF_ACCESS_AUD?: string
  INTEGRATIONS_ENCRYPTION_KEY?: string
}

import { createRemoteJWKSet, jwtVerify } from 'jose'
import { pbkdf2Sync } from 'node:crypto'

const encoder = new TextEncoder()

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
      users.department_id AS departmentId,
      users.access_profile_id AS accessProfileId,
      users.manager_id AS managerId,
      users.name,
      users.email,
      users.role
    FROM users
    WHERE ${condition} = ? AND users.status = 'active'
    LIMIT 1
  `).bind(value).first<AccessUser>()
}

async function verifyCloudflareJwt(jwt: string, env: Bindings): Promise<string | null> {
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    console.error('CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD missing for JWT validation')
    return null
  }

  try {
    const jwksUri = new URL('/cdn-cgi/access/certs', env.CF_ACCESS_TEAM_DOMAIN)
    const jwks = createRemoteJWKSet(jwksUri)
    const { payload } = await jwtVerify(jwt, jwks, {
      audience: env.CF_ACCESS_AUD,
      issuer: env.CF_ACCESS_TEAM_DOMAIN
    })
    return typeof payload.email === 'string' ? payload.email.trim().toLocaleLowerCase('en-US') : null
  } catch (err) {
    console.error('JWT Verification failed:', err)
    return null
  }
}

export async function getAccessUser(request: Request, env: Bindings): Promise<AccessUser | null> {
  const accessEmail = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim().toLocaleLowerCase('en-US')
  const accessJwt = request.headers.get('Cf-Access-Jwt-Assertion')
  
  if (accessEmail && accessJwt) {
    const verifiedEmail = await verifyCloudflareJwt(accessJwt, env)
    if (verifiedEmail === accessEmail) {
      return (await getUserByCondition(env, 'users.email', accessEmail)) ?? null
    }
  }

  const sessionToken = parseCookies(request).sixos_session
  if (!sessionToken) return null

  const tokenHash = await digest(sessionToken)
  const session = await env.DB.prepare(`
    SELECT
      auth_sessions.expires_at AS expiresAt,
      users.id,
      users.organization_id AS organizationId,
      users.team_id AS teamId,
      users.department_id AS departmentId,
      users.access_profile_id AS accessProfileId,
      users.manager_id AS managerId,
      users.name,
      users.email,
      users.role
    FROM auth_sessions
    JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ? AND users.status = 'active'
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

export type AccessUser = {
  id: string
  organizationId: string
  teamId: string | null
  departmentId: string | null
  accessProfileId: string | null
  managerId: string | null
  name: string
  email: string
  role: string
}

type CredentialRow = {
  passwordSalt: string
  passwordHash: string
  iterations: number
}



const rolePermissions: Record<string, readonly string[]> = {
  admin: ['users.manage', 'roles.manage', 'gamification.manage', 'integrations.manage', 'projects.create', 'projects.manage', 'missions.assign', 'missions.approve', 'missions.delete', 'missions.workflow.manage', 'missions.update_own', 'clients.manage', 'library.manage', 'finance.view', 'ai.use', 'reports.view', 'agenda.team.view', 'work_types.view', 'work_types.manage'],
  management: ['projects.create', 'projects.manage', 'missions.assign', 'missions.approve', 'missions.delete', 'missions.workflow.manage', 'clients.manage', 'library.manage', 'ai.use', 'reports.view', 'agenda.team.view', 'work_types.view', 'work_types.manage'],
  coordinator: ['projects.manage', 'missions.assign', 'missions.approve', 'missions.delete', 'missions.workflow.manage', 'agenda.team.view', 'work_types.view', 'work_types.manage'],
  service: ['projects.create', 'missions.assign', 'missions.approve', 'missions.delete', 'missions.workflow.manage', 'clients.manage', 'agenda.team.view', 'work_types.view', 'work_types.manage'],
  specialist: ['missions.update_own', 'work_types.view'],
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

function toBase64(value: Uint8Array) {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}



export async function verifyPassword(env: Bindings, username: string, password: string) {
  const credential = await env.DB.prepare(`
    SELECT user_credentials.password_salt AS passwordSalt, user_credentials.password_hash AS passwordHash, user_credentials.iterations
    FROM user_credentials
    JOIN users ON users.id = user_credentials.user_id
    WHERE (users.username = ? OR lower(users.email) = ?) AND users.status = 'active'
    LIMIT 1
  `).bind(username, username).first<CredentialRow>()

  if (!credential) return false

  const derivedBits = pbkdf2Sync(password, fromBase64(credential.passwordSalt), credential.iterations, 32, 'sha256')
  return sameBytes(derivedBits, fromBase64(credential.passwordHash))
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iterations = 100000
  const derivedBits = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
  return {
    passwordSalt: toBase64(salt),
    passwordHash: toBase64(derivedBits),
    iterations,
  }
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
  return `sixos_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`
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

// ============================================================================
// RBAC V2 - Core Authorization Engine
// ============================================================================

export type PermissionScope = 'own' | 'team' | 'department' | 'assigned_clients' | 'participating_projects' | 'unit' | 'all'

export type PermissionResolution = {
  granted: boolean
  scope: PermissionScope | null
  source: 'override' | 'profile' | 'fallback'
}

// Request-level Cache to avoid duplicate D1 queries during the same request lifecycle
const requestPermissionCache = new WeakMap<Request, Map<string, PermissionResolution>>()

function getCacheKey(userId: string, permissionCode: string): string {
  return `${userId}:${permissionCode}`
}

export async function resolvePermission(
  env: Bindings,
  request: Request,
  user: AccessUser,
  permissionCode: string
): Promise<PermissionResolution> {
  // 1. Check Request Cache
  let cache = requestPermissionCache.get(request)
  if (!cache) {
    cache = new Map<string, PermissionResolution>()
    requestPermissionCache.set(request, cache)
  }

  const cacheKey = getCacheKey(user.id, permissionCode)
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!
  }

  // Helper to save and return
  const finalize = (resolution: PermissionResolution) => {
    cache!.set(cacheKey, resolution)
    return resolution
  }

  // 2. Check Overrides (Explicit Allows or Denies)
  // We only consider overrides that have not expired and have already started.
  const override = await env.DB.prepare(`
    SELECT is_granted AS isGranted, scope
    FROM user_permission_overrides
    WHERE user_id = ? AND permission_code = ?
      AND (starts_at IS NULL OR starts_at <= datetime('now'))
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(user.id, permissionCode).first<{ isGranted: number; scope: PermissionScope }>()

  if (override) {
    if (override.isGranted === 0) {
      return finalize({ granted: false, scope: null, source: 'override' })
    }
    return finalize({ granted: true, scope: override.scope, source: 'override' })
  }

  // 3. Soma as permissoes do perfil principal e de todos os cargos atribuídos.
  // O nome do cargo continua independente do codigo interno do perfil V2.
  const profilePerm = await env.DB.prepare(`
    SELECT pp.scope
    FROM profile_permissions pp
    JOIN access_profiles ap ON ap.id = pp.profile_id
    WHERE pp.permission_code = ?
      AND ap.organization_id = ?
      AND ap.is_active = 1
      AND (
        pp.profile_id = ?
        OR ap.code IN (
          SELECT CASE ura.role_code
            WHEN 'admin' THEN 'admin_tech'
            WHEN 'management' THEN 'operations_management'
            ELSE ura.role_code
          END
          FROM user_role_assignments ura
          WHERE ura.user_id = ?
        )
      )
    ORDER BY CASE pp.scope
      WHEN 'all' THEN 7
      WHEN 'unit' THEN 6
      WHEN 'department' THEN 5
      WHEN 'team' THEN 4
      WHEN 'assigned_clients' THEN 3
      WHEN 'participating_projects' THEN 2
      ELSE 1
    END DESC
    LIMIT 1
  `).bind(permissionCode, user.organizationId, user.accessProfileId ?? '', user.id).first<{ scope: PermissionScope }>()

  if (profilePerm) {
    return finalize({ granted: true, scope: profilePerm.scope, source: 'profile' })
  }

  // 4. Legacy fallback is limited to users that have not been migrated to an
  // access profile. A configured V2 profile is deny-by-default.
  if (!user.accessProfileId) {
    const v1Granted = hasPermission(user, permissionCode)
    if (v1Granted) return finalize({ granted: true, scope: 'all', source: 'fallback' })
  }

  // 5. Deny by Default
  return finalize({ granted: false, scope: null, source: 'fallback' })
}

export async function hasPermissionV2(
  env: Bindings,
  request: Request,
  user: AccessUser,
  permissionCode: string
): Promise<boolean> {
  const result = await resolvePermission(env, request, user, permissionCode)
  return result.granted
}

export async function getPermissionScope(
  env: Bindings,
  request: Request,
  user: AccessUser,
  permissionCode: string
): Promise<PermissionScope | null> {
  const result = await resolvePermission(env, request, user, permissionCode)
  return result.granted ? result.scope : null
}

// ----------------------------------------------------------------------------
// Capabilities Export for Frontend (Phase 4)
// ----------------------------------------------------------------------------

export const SYSTEM_PERMISSIONS = [
  'users.manage', 'roles.manage', 'gamification.manage', 'integrations.manage', 'projects.create', 'projects.manage',
  'missions.view', 'missions.create', 'missions.edit', 'missions.assign', 'missions.complete', 'missions.approve', 'missions.delete', 'missions.workflow.manage', 'missions.update_own',
  'clients.view', 'clients.create', 'clients.edit', 'clients.manage',
  'library.view', 'library.manage',
  'finance.view', 'contracts.view', 'contracts.create',
  'demands.view', 'demands.create',
  'time_entries.view', 'time_entries.create', 'time_entries.manage',
  'ai.use', 'reports.view', 'agenda.team.view',
  'evaluations.view', 'evaluations.respond', 'evaluations.results.view_own', 'evaluations.results.view_team', 'evaluations.cycles.view', 'evaluations.cycles.manage', 'evaluations.competencies.manage', 'evaluations.assign_reviewers', 'evaluations.monitor', 'evaluations.close_cycle', 'evaluations.confidential.view',
  'development.plans.view', 'development.plans.create', 'development.plans.edit', 'development.plans.manage', 'development.monitor', 'development.debriefs.view', 'development.debriefs.edit'
] as const

export type Capabilities = Record<string, PermissionScope[]>

export async function getEffectiveCapabilities(
  env: Bindings,
  request: Request,
  user: AccessUser
): Promise<Capabilities> {
  const capabilities: Capabilities = {}

  const permissionPlaceholders = SYSTEM_PERMISSIONS.map(() => '?').join(', ')
  const [overrideRows, profileRows] = await Promise.all([
    env.DB.prepare(`
      SELECT permission_code AS permissionCode, is_granted AS isGranted, scope
      FROM user_permission_overrides
      WHERE user_id = ?
        AND permission_code IN (${permissionPlaceholders})
        AND (starts_at IS NULL OR starts_at <= datetime('now'))
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY permission_code, created_at DESC
    `).bind(user.id, ...SYSTEM_PERMISSIONS).all<{ permissionCode: string; isGranted: number; scope: PermissionScope }>(),
    env.DB.prepare(`
      SELECT pp.permission_code AS permissionCode, pp.scope
      FROM profile_permissions pp
      JOIN access_profiles ap ON ap.id = pp.profile_id
      WHERE pp.permission_code IN (${permissionPlaceholders})
        AND ap.organization_id = ?
        AND ap.is_active = 1
        AND (
          pp.profile_id = ?
          OR ap.code IN (
            SELECT CASE ura.role_code
              WHEN 'admin' THEN 'admin_tech'
              WHEN 'management' THEN 'operations_management'
              ELSE ura.role_code
            END
            FROM user_role_assignments ura
            WHERE ura.user_id = ?
          )
        )
      ORDER BY pp.permission_code, CASE pp.scope
        WHEN 'all' THEN 7
        WHEN 'unit' THEN 6
        WHEN 'department' THEN 5
        WHEN 'team' THEN 4
        WHEN 'assigned_clients' THEN 3
        WHEN 'participating_projects' THEN 2
        ELSE 1
      END DESC
    `).bind(...SYSTEM_PERMISSIONS, user.organizationId, user.accessProfileId ?? '', user.id).all<{ permissionCode: string; scope: PermissionScope }>(),
  ])

  const overrides = new Map<string, { isGranted: number; scope: PermissionScope }>()
  for (const row of overrideRows.results) {
    if (!overrides.has(row.permissionCode)) overrides.set(row.permissionCode, row)
  }

  const profilePermissions = new Map<string, PermissionScope>()
  for (const row of profileRows.results) {
    if (!profilePermissions.has(row.permissionCode)) profilePermissions.set(row.permissionCode, row.scope)
  }

  for (const permissionCode of SYSTEM_PERMISSIONS) {
    const override = overrides.get(permissionCode)
    if (override) {
      if (override.isGranted !== 0) capabilities[permissionCode] = [override.scope]
      continue
    }

    const profileScope = profilePermissions.get(permissionCode)
    if (profileScope) {
      capabilities[permissionCode] = [profileScope]
      continue
    }

    if (!user.accessProfileId && hasPermission(user, permissionCode)) {
      capabilities[permissionCode] = ['all']
    }
  }

  // Map legacy permissions that act as a bundle (e.g. clients.manage -> clients.view, create, edit)
  // This helps older code transition smoothly to new atomic permissions.
  if (capabilities['clients.manage']?.includes('all')) {
    if (!capabilities['clients.view']) capabilities['clients.view'] = ['all']
    if (!capabilities['clients.create']) capabilities['clients.create'] = ['all']
    if (!capabilities['clients.edit']) capabilities['clients.edit'] = ['all']
  }

  if (capabilities['projects.manage']?.includes('all')) {
    if (!capabilities['library.view']) capabilities['library.view'] = ['all']
    if (!capabilities['missions.view']) capabilities['missions.view'] = ['all']
  }

  return capabilities
}
