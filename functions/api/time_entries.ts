import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, getPermissionScope, hasPermissionV2, type Bindings } from './_access'
import { canAccessMission, getMissionAccess } from './missions/_missionAccess'
import { resolveTimeEntryCost } from './_timeEntryCost'

type TimeEntryInput = {
  clientId?: unknown
  userId?: unknown
  hours?: unknown
  minutes?: unknown
  date?: unknown
  description?: unknown
  entryType?: unknown
  demandId?: unknown
  taskId?: unknown
  missionId?: unknown
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const scope = await getPermissionScope(env, request, user, 'time_entries.view')
  if (!scope) return permissionRequiredResponse()

  let scopeFilter = ''
  const binds: any[] = [user.organizationId]

  if (scope === 'own') {
    scopeFilter = ' AND t.user_id = ?'
    binds.push(user.id)
  } else if (scope === 'team') {
    scopeFilter = ' AND t.user_id IN (SELECT id FROM users WHERE manager_id = ?)'
    binds.push(user.id)
  } else if (scope === 'department') {
    scopeFilter = ' AND t.user_id IN (SELECT id FROM users WHERE department_id = ?)'
    binds.push(user.departmentId || 'none')
  } else if (scope !== 'all') {
    return Response.json([])
  }

  const { results: entries } = await env.DB.prepare(`
    SELECT 
      t.id, t.demand_id AS demandId, t.task_id AS taskId, t.client_id AS clientId,
      t.user_id AS userId, t.hours, t.minutes, t.date, t.description,
      t.entry_type AS entryType, t.created_at AS createdAt,
      u.name AS userName, c.name AS clientName
    FROM time_entries t
    JOIN users u ON t.user_id = u.id AND u.organization_id = t.organization_id
    JOIN clients c ON t.client_id = c.id AND c.organization_id = t.organization_id
    WHERE t.organization_id = ?${scopeFilter}
    ORDER BY t.created_at DESC
  `).bind(...binds).all()

  return Response.json(entries ?? [])
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const canCreate = await hasPermissionV2(env, request, user, 'time_entries.create')
  if (!canCreate) return permissionRequiredResponse()

  const body = await request.json().catch(() => null) as TimeEntryInput | null
  if (!body || typeof body.clientId !== 'string' || !body.clientId || (body.hours === undefined && body.minutes === undefined)) {
    return Response.json({ error: 'Cliente e horas/minutos são obrigatórios' }, { status: 400 })
  }

  let targetUserId = user.id
  if (typeof body.userId === 'string' && body.userId && body.userId !== user.id) {
    const canManage = await hasPermissionV2(env, request, user, 'time_entries.manage')
    if (!canManage) return permissionRequiredResponse()
    targetUserId = body.userId
  }

  const targetUser = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND status = ? LIMIT 1')
    .bind(targetUserId, user.organizationId, 'active').first<{ id: string }>()
  if (!targetUser) return Response.json({ error: 'Colaborador não encontrado nesta organização' }, { status: 404 })

  const client = await env.DB.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ? LIMIT 1')
    .bind(body.clientId, user.organizationId).first<{ id: string }>()
  if (!client) return Response.json({ error: 'Cliente não encontrado nesta organização' }, { status: 404 })
  const hours = Number(body.hours || 0)
  const minutes = Number(body.minutes || 0)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes > 59 || hours + minutes === 0) {
    return Response.json({ error: 'Informe horas e minutos válidos' }, { status: 400 })
  }

  const totalMinutes = (hours * 60) + minutes
  const durationSeconds = totalMinutes * 60

  const now = new Date().toISOString()
  const dateStr = body.date === undefined ? now.slice(0, 10) : body.date
  if (!isDateOnly(dateStr)) return Response.json({ error: 'Data do apontamento inválida' }, { status: 400 })

  const demand = typeof body.demandId === 'string' && body.demandId
    ? await env.DB.prepare('SELECT id, client_id AS clientId FROM demands WHERE id = ? AND organization_id = ? LIMIT 1')
      .bind(body.demandId, user.organizationId).first<{ id: string; clientId: string }>()
    : null
  if (body.demandId && (!demand || demand.clientId !== client.id)) {
    return Response.json({ error: 'Demanda não pertence ao cliente informado' }, { status: 400 })
  }

  const task = typeof body.taskId === 'string' && body.taskId
    ? await env.DB.prepare(`
        SELECT t.id, t.demand_id AS demandId, d.client_id AS clientId
        FROM tasks t
        JOIN demands d ON d.id = t.demand_id
        WHERE t.id = ? AND d.organization_id = ?
        LIMIT 1
      `).bind(body.taskId, user.organizationId).first<{ id: string; demandId: string; clientId: string }>()
    : null
  if (body.taskId && (!task || task.clientId !== client.id || (demand && task.demandId !== demand.id))) {
    return Response.json({ error: 'Tarefa não pertence à demanda ou ao cliente informado' }, { status: 400 })
  }

  const missionId = typeof body.missionId === 'string' && body.missionId ? body.missionId : null
  let mission = null
  if (missionId) {
    mission = await getMissionAccess(env, user, missionId)
    if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
    if (mission.clientId !== client.id) return Response.json({ error: 'Missão não pertence ao cliente informado' }, { status: 400 })
    if (!(await canAccessMission(env, request, user, mission))) return permissionRequiredResponse()
  } else if (body.missionId !== undefined) {
    return Response.json({ error: 'Missão inválida' }, { status: 400 })
  }

  const { cost, hourlyRate, compensationHistoryId } = await resolveTimeEntryCost(
    env.DB,
    targetUser.id,
    user.organizationId,
    dateStr,
    durationSeconds,
  )

  const id = crypto.randomUUID()

  const dbStatements: D1PreparedStatement[] = []

  dbStatements.push(env.DB.prepare(`
    INSERT INTO time_entries (
      id, organization_id, demand_id, task_id, mission_id, client_id, user_id,
      hours, minutes, date, description, entry_type,
      cost, hourly_cost_snapshot, compensation_history_id, duration_seconds,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    user.organizationId,
    demand?.id || task?.demandId || null,
    task?.id || null,
    mission?.id ?? null,
    client.id,
    targetUser.id,
    hours,
    minutes,
    dateStr,
    typeof body.description === 'string' && body.description ? body.description : null,
    typeof body.entryType === 'string' && body.entryType ? body.entryType : 'manual',
    cost,
    hourlyRate,
    compensationHistoryId,
    durationSeconds,
    now
  ))

  if (mission && cost > 0) {
    dbStatements.push(
      env.DB.prepare(`
        UPDATE missions SET realized_cost = realized_cost + ?
        WHERE id = ? AND project_id IN (SELECT id FROM projects WHERE organization_id = ?)
          AND changes() = 1
      `).bind(cost, mission.id, user.organizationId)
    )
  }

  await env.DB.batch(dbStatements)

  return Response.json({ id, ...body, userId: targetUserId, date: dateStr }, { status: 201 })
}
