import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../_access'

export const onRequestPatch: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const input = await request.json().catch(() => null) as { targetPosition?: unknown } | null
  const targetPosition = typeof input?.targetPosition === 'number' && Number.isInteger(input.targetPosition) ? input.targetPosition : -1
  const mission = await env.DB.prepare(`
    SELECT missions.id, missions.current_workflow_position AS currentPosition,
      (SELECT department_name FROM mission_workflow_steps WHERE mission_id = missions.id AND position = missions.current_workflow_position) AS currentDepartment,
      (SELECT department_name FROM mission_workflow_steps WHERE mission_id = missions.id AND position = ?) AS targetDepartment,
      (SELECT responsible_user_id FROM mission_workflow_steps WHERE mission_id = missions.id AND position = ?) AS targetResponsibleUserId
    FROM missions JOIN projects ON projects.id = missions.project_id
    WHERE missions.id = ? AND projects.organization_id = ? AND missions.status NOT IN ('completed', 'cancelled')
  `).bind(targetPosition, targetPosition, params.id, user.organizationId).first<{
    id: string
    currentPosition: number
    currentDepartment: string | null
    targetDepartment: string | null
    targetResponsibleUserId: string | null
  }>()
  if (!mission) return Response.json({ error: 'Missão não encontrada ou encerrada' }, { status: 404 })
  if (targetPosition < 0 || targetPosition >= mission.currentPosition || !mission.targetDepartment) return Response.json({ error: 'Etapa de retorno inválida' }, { status: 400 })

  const [canManage, department] = await Promise.all([
    hasPermissionV2(env, request, user, 'missions.workflow.manage'),
    user.departmentId ? env.DB.prepare('SELECT name FROM departments WHERE id = ? AND organization_id = ?').bind(user.departmentId, user.organizationId).first<{ name: string }>() : null,
  ])
  const finalDepartmentMember = (mission.currentDepartment === 'Atendimento' || mission.currentDepartment === 'Planejamento') && department?.name === mission.currentDepartment
  if (!canManage && !finalDepartmentMember) return permissionRequiredResponse()

  const now = new Date().toISOString()
  const statements = [
    env.DB.prepare(`UPDATE mission_workflow_steps SET status = 'pending', completed_by_user_id = NULL, completed_at = NULL WHERE mission_id = ? AND position >= ?`).bind(mission.id, targetPosition),
    env.DB.prepare(`UPDATE mission_workflow_steps SET status = 'active' WHERE mission_id = ? AND position = ?`).bind(mission.id, targetPosition),
    env.DB.prepare(`UPDATE missions SET current_workflow_position = ?, status = 'in_progress', approval_status = 'not_requested', updated_at = ? WHERE id = ?`).bind(targetPosition, now, mission.id),
    env.DB.prepare(`INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, 'workflow_returned', ?, ?)`).bind(crypto.randomUUID(), mission.id, user.id, `Missão devolvida para ${mission.targetDepartment}.`, now),
    env.DB.prepare(`
      UPDATE time_entries
      SET ended_at = ?, duration_seconds = CAST((strftime('%s', ?) - strftime('%s', started_at)) AS INTEGER),
          hours = CAST((strftime('%s', ?) - strftime('%s', started_at)) / 3600 AS INTEGER),
          minutes = CAST(((strftime('%s', ?) - strftime('%s', started_at)) % 3600) / 60 AS INTEGER)
      WHERE mission_id = ? AND organization_id = ? AND ended_at IS NULL AND entry_type = 'timer'
    `).bind(now, now, now, now, now, mission.id, user.organizationId),
  ]

  if (mission.targetResponsibleUserId) {
    statements.push(
      env.DB.prepare(`DELETE FROM mission_assignees WHERE mission_id = ?`).bind(mission.id),
      env.DB.prepare(`INSERT OR IGNORE INTO mission_assignees (mission_id, user_id) VALUES (?, ?)`).bind(mission.id, mission.targetResponsibleUserId),
    )
  }

  await env.DB.batch(statements)
  const next = await env.DB.prepare('SELECT department_name AS name FROM mission_workflow_steps WHERE mission_id = ? AND position = ?').bind(mission.id, targetPosition + 1).first<{ name: string }>()
  return Response.json({ missionId: mission.id, status: 'workflow_returned', currentDepartment: mission.targetDepartment, nextDepartment: next?.name ?? null })
}
