import {
  accessRequiredResponse,
  getAccessUser,
  hasPermissionV2,
  permissionRequiredResponse,
  type Bindings,
} from '../_access'

type EmployeeDetailRow = {
  id: string
  organizationId: string
  userId: string | null
  name: string
  socialName: string | null
  cpf: string | null
  rg: string | null
  emitterOrgan: string | null
  birthDate: string | null
  maritalStatus: string | null
  phone: string | null
  personalEmail: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  zipCode: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  country: string | null
  registrationNumber: string | null
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
  terminationDate: string | null
  terminationReason: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  userEmail: string | null
  userUsername: string | null
  userRole: string | null
  avatarUrl: string | null
  currentSalary: number | null
  currentMonthlyHours: number | null
  currentHourlyCost: number | null
  compensationValidFrom: string | null
}

export const onRequestGet: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.view'))) {
    return permissionRequiredResponse()
  }

  const employeeId = params.id as string

  const employee = await env.DB.prepare(`
    SELECT
      emp.id,
      emp.organization_id AS organizationId,
      emp.user_id AS userId,
      emp.name,
      emp.social_name AS socialName,
      emp.cpf,
      emp.rg,
      emp.emitter_organ AS emitterOrgan,
      emp.birth_date AS birthDate,
      emp.marital_status AS maritalStatus,
      emp.phone,
      emp.personal_email AS personalEmail,
      emp.emergency_contact_name AS emergencyContactName,
      emp.emergency_contact_phone AS emergencyContactPhone,
      emp.zip_code AS zipCode,
      emp.street,
      emp.number,
      emp.complement,
      emp.neighborhood,
      emp.city,
      emp.state,
      emp.country,
      emp.registration_number AS registrationNumber,
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
      emp.termination_date AS terminationDate,
      emp.termination_reason AS terminationReason,
      emp.notes,
      emp.created_at AS createdAt,
      emp.updated_at AS updatedAt,
      u.email AS userEmail,
      u.username AS userUsername,
      u.role AS userRole,
      u.avatar_url AS avatarUrl,
      comp.salary AS currentSalary,
      comp.monthly_hours AS currentMonthlyHours,
      comp.hourly_cost AS currentHourlyCost,
      comp.valid_from AS compensationValidFrom
    FROM employees emp
    LEFT JOIN users u ON u.id = emp.user_id
    LEFT JOIN departments dept ON dept.id = emp.department_id
    LEFT JOIN professional_positions pos ON pos.id = emp.position_id
    LEFT JOIN professional_levels lvl ON lvl.id = emp.professional_level_id
    LEFT JOIN users mgr ON mgr.id = emp.manager_id
    LEFT JOIN employee_compensation_history comp ON comp.employee_id = emp.id AND comp.valid_until IS NULL
    WHERE emp.id = ? AND emp.organization_id = ?
    LIMIT 1
  `).bind(employeeId, user.organizationId).first<EmployeeDetailRow>()

  if (!employee) return Response.json({ error: 'Colaborador não encontrado.' }, { status: 404 })

  const canViewSensitive = await hasPermissionV2(env, request, user, 'employees.view_sensitive')
  const canViewSalary = await hasPermissionV2(env, request, user, 'employees.salary.view')

  return Response.json({
    ...employee,
    cpf: canViewSensitive ? employee.cpf : null,
    rg: canViewSensitive ? employee.rg : null,
    emitterOrgan: canViewSensitive ? employee.emitterOrgan : null,
    birthDate: canViewSensitive ? employee.birthDate : null,
    maritalStatus: canViewSensitive ? employee.maritalStatus : null,
    phone: canViewSensitive ? employee.phone : null,
    personalEmail: canViewSensitive ? employee.personalEmail : null,
    emergencyContactName: canViewSensitive ? employee.emergencyContactName : null,
    emergencyContactPhone: canViewSensitive ? employee.emergencyContactPhone : null,
    zipCode: canViewSensitive ? employee.zipCode : null,
    street: canViewSensitive ? employee.street : null,
    number: canViewSensitive ? employee.number : null,
    complement: canViewSensitive ? employee.complement : null,
    neighborhood: canViewSensitive ? employee.neighborhood : null,
    city: canViewSensitive ? employee.city : null,
    state: canViewSensitive ? employee.state : null,
    currentSalary: canViewSalary ? employee.currentSalary : undefined,
    currentMonthlyHours: canViewSalary ? employee.currentMonthlyHours : undefined,
    currentHourlyCost: canViewSalary ? employee.currentHourlyCost : undefined,
    compensationValidFrom: canViewSalary ? employee.compensationValidFrom : undefined,
  })
}

export const onRequestPatch: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.edit'))) {
    return permissionRequiredResponse()
  }

  const employeeId = params.id as string
  const existing = await env.DB.prepare('SELECT * FROM employees WHERE id = ? AND organization_id = ? LIMIT 1')
    .bind(employeeId, user.organizationId)
    .first<Record<string, unknown>>()

  if (!existing) return Response.json({ error: 'Colaborador não encontrado.' }, { status: 404 })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return Response.json({ error: 'Dados inválidos.' }, { status: 400 })

  const canEditSensitive = await hasPermissionV2(env, request, user, 'employees.edit_sensitive')
  const now = new Date().toISOString()
  const auditLogs: Array<{ action: string; field: string; oldVal: string | null; newVal: string | null; detail: string }> = []

  const updates: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  function trackChange(field: string, dbCol: string, newVal: unknown, isSensitive = false) {
    if (newVal === undefined) return
    if (isSensitive && !canEditSensitive) return
    const oldVal = existing ? existing[dbCol] : null
    if (oldVal !== newVal) {
      updates.push(`${dbCol} = ?`)
      values.push(newVal)
      auditLogs.push({
        action: 'employee_updated',
        field: dbCol,
        oldVal: oldVal != null ? String(oldVal) : null,
        newVal: newVal != null ? String(newVal) : null,
        detail: `Campo ${field} alterado.`,
      })
    }
  }

  if (typeof body.name === 'string' && body.name.trim()) trackChange('Nome', 'name', body.name.trim())
  if (body.socialName !== undefined) trackChange('Nome Social', 'social_name', typeof body.socialName === 'string' && body.socialName.trim() ? body.socialName.trim() : null)
  if (body.cpf !== undefined) trackChange('CPF', 'cpf', typeof body.cpf === 'string' && body.cpf.trim() ? body.cpf.trim().replace(/\D/g, '') : null, true)
  if (body.rg !== undefined) trackChange('RG', 'rg', typeof body.rg === 'string' ? body.rg.trim() : null, true)
  if (body.emitterOrgan !== undefined) trackChange('Órgão Emissor', 'emitter_organ', typeof body.emitterOrgan === 'string' ? body.emitterOrgan.trim() : null, true)
  if (body.birthDate !== undefined) trackChange('Data de Nascimento', 'birth_date', typeof body.birthDate === 'string' && body.birthDate ? body.birthDate : null, true)
  if (body.maritalStatus !== undefined) trackChange('Estado Civil', 'marital_status', typeof body.maritalStatus === 'string' ? body.maritalStatus : null, true)
  if (body.phone !== undefined) trackChange('Telefone', 'phone', typeof body.phone === 'string' ? body.phone.trim() : null, true)
  if (body.personalEmail !== undefined) trackChange('E-mail Pessoal', 'personal_email', typeof body.personalEmail === 'string' ? body.personalEmail.trim() : null, true)
  if (body.emergencyContactName !== undefined) trackChange('Contato de Emergência', 'emergency_contact_name', typeof body.emergencyContactName === 'string' ? body.emergencyContactName.trim() : null, true)
  if (body.emergencyContactPhone !== undefined) trackChange('Telefone de Emergência', 'emergency_contact_phone', typeof body.emergencyContactPhone === 'string' ? body.emergencyContactPhone.trim() : null, true)
  if (body.zipCode !== undefined) trackChange('CEP', 'zip_code', typeof body.zipCode === 'string' ? body.zipCode.trim() : null, true)
  if (body.street !== undefined) trackChange('Logradouro', 'street', typeof body.street === 'string' ? body.street.trim() : null, true)
  if (body.number !== undefined) trackChange('Número', 'number', typeof body.number === 'string' ? body.number.trim() : null, true)
  if (body.complement !== undefined) trackChange('Complemento', 'complement', typeof body.complement === 'string' ? body.complement.trim() : null, true)
  if (body.neighborhood !== undefined) trackChange('Bairro', 'neighborhood', typeof body.neighborhood === 'string' ? body.neighborhood.trim() : null, true)
  if (body.city !== undefined) trackChange('Cidade', 'city', typeof body.city === 'string' ? body.city.trim() : null, true)
  if (body.state !== undefined) trackChange('Estado', 'state', typeof body.state === 'string' ? body.state.trim() : null, true)
  if (body.country !== undefined) trackChange('País', 'country', typeof body.country === 'string' ? body.country.trim() : 'Brasil', true)

  if (body.registrationNumber !== undefined) trackChange('Matrícula', 'registration_number', typeof body.registrationNumber === 'string' ? body.registrationNumber.trim() : null)
  if (body.departmentId !== undefined) trackChange('Departamento', 'department_id', typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : null)
  if (body.positionId !== undefined) trackChange('Cargo', 'position_id', typeof body.positionId === 'string' && body.positionId ? body.positionId : null)
  if (body.professionalLevelId !== undefined) trackChange('Nível', 'professional_level_id', typeof body.professionalLevelId === 'string' && body.professionalLevelId ? body.professionalLevelId : null)
  if (body.managerId !== undefined) trackChange('Gestor', 'manager_id', typeof body.managerId === 'string' && body.managerId ? body.managerId : null)
  if (body.admissionDate !== undefined) trackChange('Admissão', 'admission_date', typeof body.admissionDate === 'string' && body.admissionDate ? body.admissionDate : null)
  if (body.contractType !== undefined) trackChange('Contratação', 'contract_type', typeof body.contractType === 'string' && ['CLT', 'PJ', 'estagio', 'freelancer', 'temporario', 'outro'].includes(body.contractType) ? body.contractType : 'CLT')
  if (body.workModality !== undefined) trackChange('Modalidade', 'work_modality', typeof body.workModality === 'string' && ['presencial', 'remoto', 'hibrido'].includes(body.workModality) ? body.workModality : 'hibrido')
  if (body.notes !== undefined) trackChange('Observações', 'notes', typeof body.notes === 'string' ? body.notes.trim() : null)

  // Status e desligamento
  if (body.status !== undefined && typeof body.status === 'string' && ['active', 'inactive', 'vacation', 'leave', 'terminated'].includes(body.status)) {
    const oldStatus = existing ? existing.status : null
    trackChange('Status', 'status', body.status)
    if (body.status === 'terminated' && oldStatus !== 'terminated') {
      const termDate = typeof body.terminationDate === 'string' && body.terminationDate ? body.terminationDate : now.slice(0, 10)
      const termReason = typeof body.terminationReason === 'string' ? body.terminationReason.trim() : 'Desligamento realizado.'
      trackChange('Data de Desligamento', 'termination_date', termDate)
      trackChange('Motivo de Desligamento', 'termination_reason', termReason)
      
      // Se houver usuário vinculado, desativa o login
      if (existing?.user_id) {
        await env.DB.prepare("UPDATE users SET status = 'inactive' WHERE id = ? AND organization_id = ?")
          .bind(existing.user_id, user.organizationId)
          .run()
      }
    }
  }

  if (updates.length === 1) {
    return Response.json({ success: true, message: 'Nenhuma alteração detectada.' })
  }

  values.push(employeeId, user.organizationId)
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE employees SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`).bind(...values),
  ]

  for (const log of auditLogs) {
    statements.push(
      env.DB.prepare(`
        INSERT INTO employee_audit_logs (
          id, organization_id, employee_id, actor_user_id, action, field_name, old_value, new_value, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), user.organizationId, employeeId, user.id, log.action, log.field, log.oldVal, log.newVal, log.detail, now)
    )
  }

  await env.DB.batch(statements)

  return Response.json({ success: true, message: 'Dados atualizados com sucesso.' })
}
