import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../_access'
import { canAccessMission, getMissionAccess } from '../_missionAccess'
import { closeActiveTimers, getStageForType } from '../_missionWorkflow'

type TimerInput = { action?: unknown }

type TimerRow = {
  id: string
  missionId: string
  missionTitle: string
  startedAt: string
}

function activeTimerResponse(timer: TimerRow, now = Date.now()) {
  return {
    active: true,
    id: timer.id,
    missionId: timer.missionId,
    missionTitle: timer.missionTitle,
    startedAt: timer.startedAt,
    elapsedSeconds: Math.max(0, Math.floor((now - Date.parse(timer.startedAt)) / 1000)),
  }
}

export const onRequestPost: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'time_entries.create'))) return permissionRequiredResponse()

  const missionAccess = await getMissionAccess(env, user, params.id as string)
  if (!missionAccess) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (!(await canAccessMission(env, request, user, missionAccess))) return permissionRequiredResponse()

  const body = await request.json().catch(() => null) as TimerInput | null
  const action = body?.action === 'stop' ? 'stop' : body?.action === 'start' ? 'start' : null
  if (!action) return Response.json({ error: 'Ação de timer inválida' }, { status: 400 })

  const mission = await env.DB.prepare(`
    SELECT missions.id, missions.title, missions.client_id AS clientId, missions.board_id AS boardId,
      missions.stage_id AS stageId, missions.status, stages.type AS stageType
    FROM missions
    JOIN projects ON projects.id = missions.project_id
    LEFT JOIN workflow_stages stages ON stages.id = missions.stage_id
    WHERE missions.id = ? AND projects.organization_id = ?
    LIMIT 1
  `).bind(missionAccess.id, user.organizationId).first<{
    id: string
    title: string
    clientId: string
    boardId: string | null
    stageId: string | null
    status: string
    stageType: string | null
  }>()
  if (!mission || mission.status === 'cancelled') return Response.json({ error: 'Missão não encontrada ou cancelada' }, { status: 404 })

  const active = await env.DB.prepare(`
    SELECT entries.id, entries.mission_id AS missionId, missions.title AS missionTitle,
      entries.started_at AS startedAt
    FROM time_entries entries
    JOIN missions ON missions.id = entries.mission_id
    WHERE entries.organization_id = ? AND entries.user_id = ?
      AND entries.entry_type = 'timer' AND entries.started_at IS NOT NULL AND entries.ended_at IS NULL
    LIMIT 1
  `).bind(user.organizationId, user.id).first<TimerRow>()

  if (action === 'stop') {
    if (!active || active.missionId !== mission.id) return Response.json({ active: false, missionId: mission.id })
    const now = new Date()
    const durationSeconds = Math.max(0, Math.floor((now.getTime() - Date.parse(active.startedAt)) / 1000))

    const { statements } = await closeActiveTimers(env.DB, mission.id, user.organizationId, now)
    statements.push(
      env.DB.prepare(`
        INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at)
        VALUES (?, ?, ?, 'timer_stopped', 'Cronômetro pausado.', ?)
      `).bind(crypto.randomUUID(), mission.id, user.id, now.toISOString()),
    )

    await env.DB.batch(statements)
    return Response.json({ active: false, missionId: mission.id, elapsedSeconds: durationSeconds })
  }

  if (mission.status === 'completed' || mission.stageType === 'done') {
    return Response.json({ error: 'Missões concluídas não podem ser iniciadas' }, { status: 409 })
  }
  if (mission.stageType === 'review' || mission.stageType === 'approval') {
    return Response.json({ error: 'Esta missão está em revisão ou aprovação' }, { status: 409 })
  }
  if (active) {
    if (active.missionId === mission.id) return Response.json(activeTimerResponse(active))
    return Response.json({ error: `Pause “${active.missionTitle}” antes de iniciar outra missão`, activeTimer: activeTimerResponse(active) }, { status: 409 })
  }

  const doingStage = await getStageForType(env, user.organizationId, mission.boardId, 'doing')
  if (!doingStage) return Response.json({ error: 'O quadro não possui uma etapa de produção' }, { status: 409 })

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const statements = [
    env.DB.prepare(`
      INSERT INTO time_entries
        (id, organization_id, mission_id, client_id, user_id, hours, minutes, date,
         description, entry_type, started_at, duration_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, 'timer', ?, 0, ?)
    `).bind(id, user.organizationId, mission.id, mission.clientId, user.id, now.slice(0, 10), `Missão: ${mission.title}`, now, now),
    env.DB.prepare(`
      UPDATE missions
      SET board_id = ?, stage_id = ?, status = 'in_progress', started_at = COALESCE(started_at, ?), updated_at = ?
      WHERE id = ?
    `).bind(doingStage.boardId, doingStage.id, now, now, mission.id),
    env.DB.prepare(`
      INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at)
      VALUES (?, ?, ?, 'started', 'Missão iniciada e cronômetro ativado.', ?)
    `).bind(crypto.randomUUID(), mission.id, user.id, now),
  ]
  if (mission.stageId !== doingStage.id) {
    statements.push(env.DB.prepare(`
      INSERT INTO mission_stage_history
        (id, mission_id, board_id, from_stage_id, to_stage_id, actor_user_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Missão iniciada.', ?)
    `).bind(crypto.randomUUID(), mission.id, doingStage.boardId, mission.stageId, doingStage.id, user.id, now))
  }
  await env.DB.batch(statements)

  return Response.json(activeTimerResponse({ id, missionId: mission.id, missionTitle: mission.title, startedAt: now }), { status: 201 })
}
