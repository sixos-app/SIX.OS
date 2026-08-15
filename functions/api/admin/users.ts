import { accessRequiredResponse, getAccessUser, hashPassword, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

type CreateUserPayload = { name?: unknown; email?: unknown; role?: unknown; roles?: unknown; username?: unknown; initialPassword?: unknown; department?: unknown; status?: unknown }

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'users.manage'))) return permissionRequiredResponse()

  let payload: CreateUserPayload
  try {
    payload = await request.json() as CreateUserPayload
  } catch {
    return Response.json({ error: 'Dados do colaborador inválidos' }, { status: 400 })
  }

  const name = normalizeText(payload.name)
  const email = normalizeText(payload.email).toLocaleLowerCase('en-US')
  const requestedRoles = Array.isArray(payload.roles)
    ? payload.roles.map(normalizeText).filter(Boolean)
    : [normalizeText(payload.role)].filter(Boolean)
  const roles = [...new Set(requestedRoles)]
  const primaryRole = roles[0] ?? ''
  const usernameValue = normalizeText(payload.username).toLocaleLowerCase('en-US')
  const username = usernameValue || null
  const initialPassword = typeof payload.initialPassword === 'string' ? payload.initialPassword : ''
  const departmentValue = normalizeText(payload.department)
  const status = typeof payload.status === 'string' && ['active', 'blocked', 'inactive'].includes(payload.status) ? payload.status : 'active'
  if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 180 || roles.length < 1 || roles.length > 5 || (username && !/^[a-z0-9._-]{3,40}$/.test(username)) || initialPassword.length < 12 || initialPassword.length > 256) {
    return Response.json({ error: 'Revise os dados do colaborador. A senha inicial deve ter pelo menos 12 caracteres.' }, { status: 400 })
  }

  const rolePlaceholders = roles.map(() => '?').join(', ')
  const validRoles = await env.DB.prepare(`SELECT code FROM role_definitions WHERE code IN (${rolePlaceholders})`).bind(...roles).all<{ code: string }>()
  if (validRoles.results.length !== roles.length) return Response.json({ error: 'Um ou mais cargos são inválidos' }, { status: 400 })

  const department = departmentValue
    ? await env.DB.prepare('SELECT id FROM departments WHERE organization_id = ? AND (id = ? OR name = ? OR code = ?) AND is_active = 1 LIMIT 1')
      .bind(administrator.organizationId, departmentValue, departmentValue, departmentValue).first<{ id: string }>()
    : null
  if (departmentValue && !department) return Response.json({ error: 'Departamento inválido para esta organização' }, { status: 400 })

  const profileCodeByRole: Record<string, string> = {
    admin: 'admin_tech', management: 'operations_management', coordinator: 'coordinator', service: 'service', specialist: 'specialist',
  }
  const accessProfile = profileCodeByRole[primaryRole]
    ? await env.DB.prepare('SELECT id FROM access_profiles WHERE organization_id = ? AND code = ? AND is_active = 1 LIMIT 1')
      .bind(administrator.organizationId, profileCodeByRole[primaryRole]).first<{ id: string }>()
    : null

  const credential = await hashPassword(initialPassword)

  const id = `user-${crypto.randomUUID()}`
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, organization_id, team_id, name, email, role, username, department_id, access_profile_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, administrator.organizationId, administrator.teamId, name, email, primaryRole, username, department?.id ?? null, accessProfile?.id ?? null, status),
      env.DB.prepare("INSERT INTO gamification_profiles (user_id, level) VALUES (?, 'Criativo Iniciante')").bind(id),
      ...roles.map((role, index) => env.DB.prepare('INSERT INTO user_role_assignments (user_id, role_code, is_primary) VALUES (?, ?, ?)').bind(id, role, index === 0 ? 1 : 0)),
      env.DB.prepare('INSERT INTO user_credentials (user_id, password_salt, password_hash, iterations) VALUES (?, ?, ?, ?)').bind(id, credential.passwordSalt, credential.passwordHash, credential.iterations),
    ])
  } catch {
    return Response.json({ error: 'Já existe um colaborador com este e-mail ou login' }, { status: 409 })
  }

  return Response.json({ member: { id, name, email, username, role: primaryRole, roles } }, { status: 201 })
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  
  // Checking both users.manage and roles.manage. For this specific endpoint, users.manage is sufficient to list basic org data.
  const hasUsersManage = await hasPermissionV2(env, request, administrator, 'users.manage')
  const hasRolesManage = await hasPermissionV2(env, request, administrator, 'roles.manage')
  if (!hasUsersManage && !hasRolesManage) return permissionRequiredResponse()

  const { results } = await env.DB.prepare(`
    SELECT
      users.id, users.name, users.email, users.username,
      users.status, users.department_id, users.position_id, users.professional_level_id,
      users.access_profile_id, users.manager_id, users.created_at,
      users.role AS legacy_role,
      COALESCE((SELECT GROUP_CONCAT(ura.role_code) FROM user_role_assignments ura WHERE ura.user_id = users.id), users.role) AS roles_csv
    FROM users
    WHERE users.organization_id = ?
    ORDER BY users.name ASC
  `).bind(administrator.organizationId).all()

  return Response.json(results.map((row: any) => {
    const { roles_csv, ...user } = row
    return { ...user, roles: String(roles_csv || '').split(',').filter(Boolean) }
  }))
}
