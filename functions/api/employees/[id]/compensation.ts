import {
  accessRequiredResponse,
  getAccessUser,
  hasPermissionV2,
  permissionRequiredResponse,
  type Bindings,
} from '../../_access'

type CompensationRow = {
  id: string
  organizationId: string
  employeeId: string
  salary: number
  monthlyHours: number
  hourlyCost: number
  currency: string
  validFrom: string
  validUntil: string | null
  reason: string | null
  createdByName: string | null
  createdAt: string
}

export const onRequestGet: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.salary.view'))) {
    return permissionRequiredResponse()
  }

  const employeeId = params.id as string

  const history = await env.DB.prepare(`
    SELECT
      comp.id,
      comp.organization_id AS organizationId,
      comp.employee_id AS employeeId,
      comp.salary,
      comp.monthly_hours AS monthlyHours,
      comp.hourly_cost AS hourlyCost,
      comp.currency,
      comp.valid_from AS validFrom,
      comp.valid_until AS validUntil,
      comp.reason,
      u.name AS createdByName,
      comp.created_at AS createdAt
    FROM employee_compensation_history comp
    LEFT JOIN users u ON u.id = comp.created_by_user_id
    WHERE comp.employee_id = ? AND comp.organization_id = ?
    ORDER BY comp.valid_from DESC, comp.created_at DESC
  `).bind(employeeId, user.organizationId).all<CompensationRow>()

  return Response.json(history.results)
}

export const onRequestPost: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.salary.edit'))) {
    return permissionRequiredResponse()
  }

  const employeeId = params.id as string
  const employee = await env.DB.prepare('SELECT id, user_id FROM employees WHERE id = ? AND organization_id = ? LIMIT 1')
    .bind(employeeId, user.organizationId)
    .first<{ id: string; user_id: string | null }>()

  if (!employee) return Response.json({ error: 'Colaborador não encontrado.' }, { status: 404 })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return Response.json({ error: 'Dados inválidos.' }, { status: 400 })

  const salary = typeof body.salary === 'number' && body.salary >= 0 ? body.salary : Number(body.salary)
  if (isNaN(salary) || salary < 0) return Response.json({ error: 'Salário base inválido.' }, { status: 400 })

  const monthlyHours = typeof body.monthlyHours === 'number' && body.monthlyHours > 0 ? body.monthlyHours : Number(body.monthlyHours) || 220
  const hourlyCost = Math.round((salary / monthlyHours) * 100) / 100
  const validFrom = typeof body.validFrom === 'string' && body.validFrom ? body.validFrom : new Date().toISOString().slice(0, 10)
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Reajuste / alteração salarial.'
  const now = new Date().toISOString()
  const newCompId = crypto.randomUUID()

  // Buscar última vigência aberta
  const activeComp = await env.DB.prepare(`
    SELECT id, salary, hourly_cost
    FROM employee_compensation_history
    WHERE employee_id = ? AND organization_id = ? AND valid_until IS NULL
    ORDER BY valid_from DESC LIMIT 1
  `).bind(employeeId, user.organizationId).first<{ id: string; salary: number; hourly_cost: number }>()

  const statements: D1PreparedStatement[] = []

  // Encerrar vigência anterior se existir
  if (activeComp) {
    statements.push(
      env.DB.prepare(`
        UPDATE employee_compensation_history
        SET valid_until = ?
        WHERE id = ? AND organization_id = ?
      `).bind(validFrom, activeComp.id, user.organizationId)
    )
  }

  // Inserir nova vigência
  statements.push(
    env.DB.prepare(`
      INSERT INTO employee_compensation_history (
        id, organization_id, employee_id, salary, monthly_hours, hourly_cost, currency, valid_from, valid_until, reason, created_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'BRL', ?, NULL, ?, ?, ?)
    `).bind(newCompId, user.organizationId, employeeId, salary, monthlyHours, hourlyCost, validFrom, reason, user.id, now),
    env.DB.prepare(`
      INSERT INTO employee_audit_logs (
        id, organization_id, employee_id, actor_user_id, action, field_name, old_value, new_value, details, created_at
      ) VALUES (?, ?, ?, ?, 'salary_updated', 'salary', ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.organizationId,
      employeeId,
      user.id,
      activeComp ? `R$ ${activeComp.salary.toFixed(2)} (R$ ${activeComp.hourly_cost.toFixed(2)}/h)` : null,
      `R$ ${salary.toFixed(2)} (R$ ${hourlyCost.toFixed(2)}/h)`,
      `Novo salário vigente a partir de ${validFrom}. Motivo: ${reason}`,
      now,
    )
  )

  // Sincronizar fallback em users.hourly_rate se houver usuário vinculado
  if (employee.user_id) {
    statements.push(
      env.DB.prepare('UPDATE users SET hourly_rate = ? WHERE id = ? AND organization_id = ?')
        .bind(hourlyCost, employee.user_id, user.organizationId)
    )
  }

  await env.DB.batch(statements)

  return Response.json({
    id: newCompId,
    salary,
    monthlyHours,
    hourlyCost,
    validFrom,
    message: 'Histórico salarial atualizado com sucesso.',
  }, { status: 201 })
}
