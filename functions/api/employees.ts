import {
  accessRequiredResponse,
  getAccessUser,
  hasPermissionV2,
  permissionRequiredResponse,
  type Bindings,
} from './_access'

type EmployeeListRow = {
  id: string
  organizationId: string
  userId: string | null
  name: string
  socialName: string | null
  departmentId: string | null
  departmentName: string | null
  positionId: string | null
  positionName: string | null
  professionalLevelId: string | null
  professionalLevelName: string | null
  managerId: string | null
  managerName: string | null
  admissionDate: string | null
  contractType: string
  workModality: string
  status: string
  personalEmail: string | null
  phone: string | null
  avatarUrl: string | null
  salary?: number | null
  hourlyCost?: number | null
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.view'))) {
    return permissionRequiredResponse()
  }

  const canViewSalary = await hasPermissionV2(env, request, user, 'employees.salary.view')
  const canViewSensitive = await hasPermissionV2(env, request, user, 'employees.view_sensitive')

  const employees = await env.DB.prepare(`
    SELECT
      emp.id,
      emp.organization_id AS organizationId,
      emp.user_id AS userId,
      emp.name,
      emp.social_name AS socialName,
      emp.department_id AS departmentId,
      dept.name AS departmentName,
      emp.position_id AS positionId,
      pos.name AS positionName,
      emp.professional_level_id AS professionalLevelId,
      lvl.name AS professionalLevelName,
      emp.manager_id AS managerId,
      mgr.name AS managerName,
      emp.admission_date AS admissionDate,
      emp.contract_type AS contractType,
      emp.work_modality AS workModality,
      emp.status,
      emp.personal_email AS personalEmail,
      emp.phone,
      u.avatar_url AS avatarUrl,
      comp.salary,
      comp.hourly_cost AS hourlyCost
    FROM employees emp
    LEFT JOIN users u ON u.id = emp.user_id
    LEFT JOIN departments dept ON dept.id = emp.department_id
    LEFT JOIN professional_positions pos ON pos.id = emp.position_id
    LEFT JOIN professional_levels lvl ON lvl.id = emp.professional_level_id
    LEFT JOIN users mgr ON mgr.id = emp.manager_id
    LEFT JOIN employee_compensation_history comp ON comp.employee_id = emp.id AND comp.valid_until IS NULL
    WHERE emp.organization_id = ?
    ORDER BY emp.name ASC
  `).bind(user.organizationId).all<EmployeeListRow>()

  const sanitized = employees.results.map((emp) => ({
    ...emp,
    phone: canViewSensitive ? emp.phone : null,
    personalEmail: canViewSensitive ? emp.personalEmail : null,
    salary: canViewSalary ? emp.salary : undefined,
    hourlyCost: canViewSalary ? emp.hourlyCost : undefined,
  }))

  return Response.json(sanitized)
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.create'))) {
    return permissionRequiredResponse()
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return Response.json({ error: 'Nome do colaborador é obrigatório.' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  const name = body.name.trim()
  const socialName = typeof body.socialName === 'string' && body.socialName.trim() ? body.socialName.trim() : null
  const cpf = typeof body.cpf === 'string' && body.cpf.trim() ? body.cpf.trim().replace(/\D/g, '') : null
  const rg = typeof body.rg === 'string' && body.rg.trim() ? body.rg.trim() : null
  const emitterOrgan = typeof body.emitterOrgan === 'string' ? body.emitterOrgan.trim() : null
  const birthDate = typeof body.birthDate === 'string' && body.birthDate ? body.birthDate : null
  const maritalStatus = typeof body.maritalStatus === 'string' ? body.maritalStatus : null
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null
  const personalEmail = typeof body.personalEmail === 'string' ? body.personalEmail.trim() : null
  const emergencyContactName = typeof body.emergencyContactName === 'string' ? body.emergencyContactName.trim() : null
  const emergencyContactPhone = typeof body.emergencyContactPhone === 'string' ? body.emergencyContactPhone.trim() : null
  const zipCode = typeof body.zipCode === 'string' ? body.zipCode.trim() : null
  const street = typeof body.street === 'string' ? body.street.trim() : null
  const number = typeof body.number === 'string' ? body.number.trim() : null
  const complement = typeof body.complement === 'string' ? body.complement.trim() : null
  const neighborhood = typeof body.neighborhood === 'string' ? body.neighborhood.trim() : null
  const city = typeof body.city === 'string' ? body.city.trim() : null
  const state = typeof body.state === 'string' ? body.state.trim() : null
  const country = typeof body.country === 'string' && body.country.trim() ? body.country.trim() : 'Brasil'
  const registrationNumber = typeof body.registrationNumber === 'string' ? body.registrationNumber.trim() : null
  const departmentId = typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : null
  const positionId = typeof body.positionId === 'string' && body.positionId ? body.positionId : null
  const professionalLevelId = typeof body.professionalLevelId === 'string' && body.professionalLevelId ? body.professionalLevelId : null
  const managerId = typeof body.managerId === 'string' && body.managerId ? body.managerId : null
  const admissionDate = typeof body.admissionDate === 'string' && body.admissionDate ? body.admissionDate : null
  const contractType = typeof body.contractType === 'string' && ['CLT', 'PJ', 'estagio', 'freelancer', 'temporario', 'outro'].includes(body.contractType) ? body.contractType : 'CLT'
  const workModality = typeof body.workModality === 'string' && ['presencial', 'remoto', 'hibrido'].includes(body.workModality) ? body.workModality : 'hibrido'
  const status = typeof body.status === 'string' && ['active', 'inactive', 'vacation', 'leave', 'terminated'].includes(body.status) ? body.status : 'active'
  const notes = typeof body.notes === 'string' ? body.notes.trim() : null
  const userId = typeof body.userId === 'string' && body.userId ? body.userId : null

  const salary = typeof body.salary === 'number' && body.salary >= 0 ? body.salary : Number(body.salary) || 0
  const monthlyHours = typeof body.monthlyHours === 'number' && body.monthlyHours > 0 ? body.monthlyHours : Number(body.monthlyHours) || 220
  const hourlyCost = monthlyHours > 0 ? Math.round((salary / monthlyHours) * 100) / 100 : 0

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO employees (
        id, organization_id, user_id, name, social_name, cpf, rg, emitter_organ,
        birth_date, marital_status, phone, personal_email, emergency_contact_name,
        emergency_contact_phone, zip_code, street, number, complement, neighborhood,
        city, state, country, registration_number, department_id, position_id,
        professional_level_id, manager_id, admission_date, contract_type,
        work_modality, status, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `).bind(
      id, user.organizationId, userId, name, socialName, cpf, rg, emitterOrgan,
      birthDate, maritalStatus, phone, personalEmail, emergencyContactName,
      emergencyContactPhone, zipCode, street, number, complement, neighborhood,
      city, state, country, registrationNumber, departmentId, positionId,
      professionalLevelId, managerId, admissionDate, contractType,
      workModality, status, notes, now, now
    ),
    env.DB.prepare(`
      INSERT INTO employee_audit_logs (
        id, organization_id, employee_id, actor_user_id, action, field_name, old_value, new_value, details, created_at
      ) VALUES (?, ?, ?, ?, 'employee_created', 'all', NULL, ?, ?, ?)
    `).bind(crypto.randomUUID(), user.organizationId, id, user.id, name, 'Cadastro inicial de colaborador criado.', now),
  ]

  if (salary > 0 && (await hasPermissionV2(env, request, user, 'employees.salary.edit'))) {
    const compId = crypto.randomUUID()
    statements.push(
      env.DB.prepare(`
        INSERT INTO employee_compensation_history (
          id, organization_id, employee_id, salary, monthly_hours, hourly_cost, currency, valid_from, reason, created_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'BRL', ?, 'Remuneração inicial.', ?, ?)
      `).bind(compId, user.organizationId, id, salary, monthlyHours, hourlyCost, admissionDate || now.slice(0, 10), user.id, now),
      env.DB.prepare(`
        INSERT INTO employee_audit_logs (
          id, organization_id, employee_id, actor_user_id, action, field_name, old_value, new_value, details, created_at
        ) VALUES (?, ?, ?, ?, 'salary_created', 'salary', NULL, ?, ?, ?)
      `).bind(crypto.randomUUID(), user.organizationId, id, user.id, String(salary), `Salário inicial definido: R$ ${salary.toFixed(2)} (${monthlyHours}h/mês = R$ ${hourlyCost.toFixed(2)}/h)`, now),
    )
  }

  await env.DB.batch(statements)

  return Response.json({ id, name, status }, { status: 201 })
}
