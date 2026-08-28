import { accessRequiredResponse, getAccessUser, hashPassword, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'
import { relationId, validateEmployeeRelations } from '../_employeeRelations'
import { hasSensitiveEmployeeFields } from '../_employeeSensitive'
import { getLevelFromXp } from '../../../shared/gamificationLevels'

type CreateUserPayload = { name?: unknown; email?: unknown; role?: unknown; roles?: unknown; username?: unknown; initialPassword?: unknown; department?: unknown; status?: unknown; employee?: unknown }

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
  const employee = payload.employee && typeof payload.employee === 'object' && !Array.isArray(payload.employee) ? payload.employee as Record<string, unknown> : {}
  if (hasSensitiveEmployeeFields(employee) && !(await hasPermissionV2(env, request, administrator, 'employees.edit_sensitive'))) {
    return Response.json({ error: 'Você não tem permissão para registrar dados pessoais sensíveis do colaborador.' }, { status: 403 })
  }
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

  const positionId = relationId(employee.positionId)
  const professionalLevelId = relationId(employee.professionalLevelId)
  const managerId = relationId(employee.managerId)
  if (!await validateEmployeeRelations(env, administrator.organizationId, { departmentId: department?.id ?? null, positionId, professionalLevelId, managerId })) {
    return Response.json({ error: 'Uma ou mais relações do colaborador são inválidas.' }, { status: 400 })
  }

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
    const now = new Date().toISOString()
    const employeeId = `emp-${id}`
    const text = (key: string) => typeof employee[key] === 'string' ? employee[key].trim() || null : null
    const date = (key: string) => typeof employee[key] === 'string' && employee[key] ? employee[key] : null
    const contractType = typeof employee.contractType === 'string' && ['CLT', 'PJ', 'estagio', 'freelancer', 'temporario', 'outro'].includes(employee.contractType) ? employee.contractType : 'CLT'
    const workModality = typeof employee.workModality === 'string' && ['presencial', 'remoto', 'hibrido'].includes(employee.workModality) ? employee.workModality : 'hibrido'
    const employeeStatus = typeof employee.status === 'string' && ['active', 'inactive', 'vacation', 'leave', 'terminated'].includes(employee.status) ? employee.status : status === 'active' ? 'active' : 'inactive'
    const salary = Number(employee.salary) || 0
    const monthlyHours = Number(employee.monthlyHours) || 220
    const canSetSalary = salary > 0 && await hasPermissionV2(env, request, administrator, 'employees.salary.edit')
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, organization_id, team_id, name, email, role, username, department_id, access_profile_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, administrator.organizationId, administrator.teamId, name, email, primaryRole, username, department?.id ?? null, accessProfile?.id ?? null, status),
      env.DB.prepare('INSERT INTO gamification_profiles (user_id, level) VALUES (?, ?)').bind(id, getLevelFromXp(0).name),
      ...roles.map((role, index) => env.DB.prepare('INSERT INTO user_role_assignments (user_id, role_code, is_primary) VALUES (?, ?, ?)').bind(id, role, index === 0 ? 1 : 0)),
      env.DB.prepare('INSERT INTO user_credentials (user_id, password_salt, password_hash, iterations) VALUES (?, ?, ?, ?)').bind(id, credential.passwordSalt, credential.passwordHash, credential.iterations),
      env.DB.prepare(`INSERT INTO employees (id, organization_id, user_id, name, social_name, cpf, rg, emitter_organ, birth_date, marital_status, phone, personal_email, emergency_contact_name, emergency_contact_phone, zip_code, street, number, complement, neighborhood, city, state, country, registration_number, department_id, position_id, professional_level_id, manager_id, admission_date, contract_type, work_modality, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(employeeId, administrator.organizationId, id, name, text('socialName'), text('cpf')?.replace(/\D/g, '') ?? null, text('rg'), text('emitterOrgan'), date('birthDate'), text('maritalStatus'), text('phone'), text('personalEmail') ?? email, text('emergencyContactName'), text('emergencyContactPhone'), text('zipCode'), text('street'), text('number'), text('complement'), text('neighborhood'), text('city'), text('state'), text('country') ?? 'Brasil', text('registrationNumber'), department?.id ?? null, positionId, professionalLevelId, managerId, date('admissionDate'), contractType, workModality, employeeStatus, text('notes'), now, now),
      ...(canSetSalary ? [env.DB.prepare('INSERT INTO employee_compensation_history (id, organization_id, employee_id, salary, monthly_hours, hourly_cost, currency, valid_from, reason, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), administrator.organizationId, employeeId, salary, monthlyHours, Math.round((salary / monthlyHours) * 100) / 100, 'BRL', date('admissionDate') ?? now.slice(0, 10), 'Remuneração inicial.', administrator.id, now)] : []),
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
