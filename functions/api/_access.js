const encoder = new TextEncoder();
const rolePermissions = {
    admin: ['users.manage', 'roles.manage', 'gamification.manage', 'projects.create', 'projects.manage', 'missions.assign', 'missions.approve', 'missions.update_own', 'clients.manage', 'library.manage', 'finance.view', 'ai.use', 'reports.view', 'agenda.team.view'],
    management: ['projects.create', 'projects.manage', 'missions.assign', 'missions.approve', 'clients.manage', 'library.manage', 'ai.use', 'reports.view', 'agenda.team.view'],
    coordinator: ['projects.manage', 'missions.assign', 'missions.approve', 'agenda.team.view'],
    service: ['projects.create', 'clients.manage', 'agenda.team.view'],
    specialist: ['missions.update_own'],
};
function parseCookies(request) {
    return Object.fromEntries((request.headers.get('cookie') ?? '').split(';').map((item) => {
        const [key, ...value] = item.trim().split('=');
        return [key, value.join('=')];
    }).filter(([key]) => key));
}
function fromBase64(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function sameBytes(left, right) {
    if (left.length !== right.length)
        return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1)
        difference |= left[index] ^ right[index];
    return difference === 0;
}
async function digest(value) {
    const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function getUserByCondition(env, condition, value) {
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
      COALESCE(user_role_assignments.role_code, users.role) AS role
    FROM users
    LEFT JOIN user_role_assignments ON user_role_assignments.user_id = users.id
    WHERE ${condition} = ?
    LIMIT 1
  `).bind(value).first();
}
export async function getAccessUser(request, env) {
    const accessEmail = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim().toLocaleLowerCase('en-US');
    if (accessEmail)
        return (await getUserByCondition(env, 'users.email', accessEmail)) ?? null;
    const sessionToken = parseCookies(request).sixos_session;
    if (!sessionToken)
        return null;
    const tokenHash = await digest(sessionToken);
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
      COALESCE(user_role_assignments.role_code, users.role) AS role
    FROM auth_sessions
    JOIN users ON users.id = auth_sessions.user_id
    LEFT JOIN user_role_assignments ON user_role_assignments.user_id = users.id
    WHERE auth_sessions.token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first();
    if (!session)
        return null;
    if (Date.parse(session.expiresAt) > Date.now()) {
        const { expiresAt: _expiresAt, ...user } = session;
        return user;
    }
    await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
}
export async function verifyPassword(env, username, password) {
    const credential = await env.DB.prepare(`
    SELECT user_credentials.password_salt AS passwordSalt, user_credentials.password_hash AS passwordHash, user_credentials.iterations
    FROM user_credentials
    JOIN users ON users.id = user_credentials.user_id
    WHERE users.username = ?
    LIMIT 1
  `).bind(username).first();
    if (!credential)
        return false;
    const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: credential.iterations, salt: fromBase64(credential.passwordSalt) }, passwordKey, 256);
    return sameBytes(new Uint8Array(derivedBits), fromBase64(credential.passwordHash));
}
export async function createSession(env, userId) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
    await env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run();
    await env.DB.prepare('INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), userId, await digest(token), expiresAt).run();
    return { token, expiresAt };
}
export async function deleteSession(request, env) {
    const sessionToken = parseCookies(request).sixos_session;
    if (sessionToken)
        await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await digest(sessionToken)).run();
}
export function sessionCookie(token, request, maxAge = 60 * 60 * 12) {
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    return `sixos_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}
export function accessRequiredResponse() {
    return Response.json({ error: 'Autenticação necessária' }, { status: 401 });
}
export function hasPermission(user, permission) {
    return rolePermissions[user.role]?.includes(permission) ?? false;
}
export function permissionRequiredResponse() {
    return Response.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 });
}
// Request-level Cache to avoid duplicate D1 queries during the same request lifecycle
const requestPermissionCache = new WeakMap();
function getCacheKey(userId, permissionCode) {
    return `${userId}:${permissionCode}`;
}
export async function resolvePermission(env, request, user, permissionCode) {
    // 1. Check Request Cache
    let cache = requestPermissionCache.get(request);
    if (!cache) {
        cache = new Map();
        requestPermissionCache.set(request, cache);
    }
    const cacheKey = getCacheKey(user.id, permissionCode);
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }
    // Helper to save and return
    const finalize = (resolution) => {
        cache.set(cacheKey, resolution);
        return resolution;
    };
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
  `).bind(user.id, permissionCode).first();
    if (override) {
        if (override.isGranted === 0) {
            return finalize({ granted: false, scope: null, source: 'override' });
        }
        return finalize({ granted: true, scope: override.scope, source: 'override' });
    }
    // 3. Check Profile (If user has a V2 access profile)
    if (user.accessProfileId) {
        // We also ensure the profile belongs to the user's organization to prevent cross-org escalation
        const profilePerm = await env.DB.prepare(`
      SELECT pp.scope
      FROM profile_permissions pp
      JOIN access_profiles ap ON ap.id = pp.profile_id
      WHERE pp.profile_id = ? AND pp.permission_code = ? AND ap.organization_id = ?
      LIMIT 1
    `).bind(user.accessProfileId, permissionCode, user.organizationId).first();
        if (profilePerm) {
            return finalize({ granted: true, scope: profilePerm.scope, source: 'profile' });
        }
    }
    // 4. Fallback to RBAC V1
    const v1Granted = hasPermission(user, permissionCode);
    if (v1Granted) {
        return finalize({ granted: true, scope: 'all', source: 'fallback' }); // V1 implies 'all'
    }
    // 5. Deny by Default
    return finalize({ granted: false, scope: null, source: 'fallback' });
}
export async function hasPermissionV2(env, request, user, permissionCode) {
    const result = await resolvePermission(env, request, user, permissionCode);
    return result.granted;
}
export async function getPermissionScope(env, request, user, permissionCode) {
    const result = await resolvePermission(env, request, user, permissionCode);
    return result.granted ? result.scope : null;
}
export async function authorize(env, request, user, permissionCode, resource) {
    const result = await resolvePermission(env, request, user, permissionCode);
    if (!result.granted || !result.scope)
        return false;
    // Future implementation: evaluate resource against result.scope
    return true;
}
