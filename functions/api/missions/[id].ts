import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'
import { canAccessMission, canManageMission, getMissionAccess } from './_missionAccess'
import { closeActiveTimers } from './_missionWorkflow'

type DetailRow = {
  id: string
  title: string
  description: string
  client: string
  projectId: string
  project: string
  assigneeId: string | null
  assignee: string | null
  status: string
  priority: string
  dueAt: string | null
  expectedMinutes: number | null
  xpReward: number
  ideasReward: number
  rewardLabel: string | null
  approvalStatus: string
  realizedCost: number
  billingValue: number
  costCenterId: string | null
  currentWorkflowPosition: number
  createdAt: string
  completedAt: string | null
  approvedAt: string | null
  startedAt: string | null
  boardId: string | null
  stageId: string | null
  stageName: string | null
  stageType: string | null
}

type WorkflowStepRow = {
  id: string
  position: number
  departmentName: string
  status: string
  responsibleUserId: string | null
  responsibleName: string | null
  completedByUserId: string | null
  completedByName: string | null
  completedAt: string | null
  stepType: string | null
  expectedMinutes: number | null
  reviewNotes: string | null
}

type TimeEntryRow = {
  id: string
  userId: string
  userName: string
  durationSeconds: number
  startedAt: string | null
  endedAt: string | null
  entryType: string
}

export const onRequestGet: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const mission = await getMissionAccess(env, user, params.id as string)
  if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (!(await canAccessMission(env, request, user, mission))) return permissionRequiredResponse()

  const detail = await env.DB.prepare(`
    SELECT missions.id, missions.title, missions.description, clients.name AS client,
      projects.id AS projectId, projects.name AS project, MIN(mission_assignees.user_id) AS assigneeId,
      MIN(users.name) AS assignee, missions.status, missions.priority, missions.due_at AS dueAt,
      missions.expected_minutes AS expectedMinutes,
      missions.xp_reward AS xpReward, missions.ideas_reward AS ideasReward, missions.reward_label AS rewardLabel,
      missions.approval_status AS approvalStatus, missions.current_workflow_position AS currentWorkflowPosition,
      missions.realized_cost AS realizedCost, missions.billing_value AS billingValue, missions.cost_center_id AS costCenterId,
      missions.created_at AS createdAt, missions.completed_at AS completedAt, missions.approved_at AS approvedAt,
      missions.started_at AS startedAt, missions.board_id AS boardId, missions.stage_id AS stageId,
      workflow_stages.name AS stageName, workflow_stages.type AS stageType
    FROM missions
    JOIN projects ON projects.id = missions.project_id
    JOIN clients ON clients.id = missions.client_id
    LEFT JOIN mission_assignees ON mission_assignees.mission_id = missions.id
    LEFT JOIN users ON users.id = mission_assignees.user_id
    LEFT JOIN workflow_stages ON workflow_stages.id = missions.stage_id
    WHERE missions.id = ? AND projects.organization_id = ?
    GROUP BY missions.id
    LIMIT 1
  `).bind(params.id, user.organizationId).first<DetailRow>()
  if (!detail) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })

  const [checklist, comments, attachments, history, activeTimer, workflowSteps, timeEntriesSummary, timeEntriesList] = await Promise.all([
    env.DB.prepare('SELECT id, label, is_completed AS isCompleted, position FROM mission_checklist_items WHERE mission_id = ? ORDER BY position, created_at').bind(mission.id).all(),
    env.DB.prepare('SELECT comments.id, comments.body, comments.created_at AS createdAt, users.name AS author FROM mission_comments comments JOIN users ON users.id = comments.user_id WHERE comments.mission_id = ? ORDER BY comments.created_at DESC').bind(mission.id).all(),
    env.DB.prepare('SELECT attachments.id, attachments.library_file_id AS libraryFileId, attachments.file_name AS fileName, attachments.file_version AS fileVersion, attachments.created_at AS createdAt FROM mission_attachments attachments WHERE attachments.mission_id = ? ORDER BY attachments.created_at DESC').bind(mission.id).all(),
    env.DB.prepare('SELECT history.id, history.action, history.detail, history.created_at AS createdAt, users.name AS actor FROM mission_history history LEFT JOIN users ON users.id = history.actor_user_id WHERE history.mission_id = ? ORDER BY history.created_at DESC LIMIT 50').bind(mission.id).all(),
    env.DB.prepare(`
      SELECT id, started_at AS startedAt
      FROM time_entries
      WHERE mission_id = ? AND user_id = ? AND organization_id = ?
        AND entry_type = 'timer' AND started_at IS NOT NULL AND ended_at IS NULL
      LIMIT 1
    `).bind(mission.id, user.id, user.organizationId).first<{ id: string; startedAt: string }>(),
    env.DB.prepare(`
      SELECT
        steps.id,
        steps.position,
        steps.department_name AS departmentName,
        steps.status,
        steps.responsible_user_id AS responsibleUserId,
        responsible.name AS responsibleName,
        steps.completed_by_user_id AS completedByUserId,
        completer.name AS completedByName,
        steps.completed_at AS completedAt,
        steps.step_type AS stepType,
        steps.expected_minutes AS expectedMinutes,
        steps.review_notes AS reviewNotes
      FROM mission_workflow_steps steps
      LEFT JOIN users responsible ON responsible.id = steps.responsible_user_id
      LEFT JOIN users completer ON completer.id = steps.completed_by_user_id
      WHERE steps.mission_id = ?
      ORDER BY steps.position ASC
    `).bind(mission.id).all<WorkflowStepRow>(),
    env.DB.prepare(`
      SELECT SUM(COALESCE(duration_seconds, 0)) AS totalSeconds, COUNT(*) AS entriesCount
      FROM time_entries
      WHERE mission_id = ? AND organization_id = ?
    `).bind(mission.id, user.organizationId).first<{ totalSeconds: number | null; entriesCount: number }>(),
    env.DB.prepare(`
      SELECT
        time_entries.id,
        time_entries.user_id AS userId,
        users.name AS userName,
        COALESCE(time_entries.duration_seconds, 0) AS durationSeconds,
        time_entries.started_at AS startedAt,
        time_entries.ended_at AS endedAt,
        time_entries.entry_type AS entryType
      FROM time_entries
      JOIN users ON users.id = time_entries.user_id
      WHERE time_entries.mission_id = ? AND time_entries.organization_id = ?
      ORDER BY time_entries.started_at DESC
      LIMIT 15
    `).bind(mission.id, user.organizationId).all<TimeEntryRow>(),
  ])

  const [canInteract, canManage, canApprove, canTrackTime] = await Promise.all([
    canAccessMission(env, request, user, mission),
    canManageMission(env, request, user),
    hasPermissionV2(env, request, user, 'missions.approve'),
    hasPermissionV2(env, request, user, 'time_entries.create'),
  ])

  return Response.json({
    mission: detail,
    checklist: checklist.results,
    comments: comments.results,
    attachments: attachments.results,
    history: history.results,
    workflowSteps: workflowSteps.results,
    timeTracking: {
      totalSeconds: timeEntriesSummary?.totalSeconds ?? 0,
      entriesCount: timeEntriesSummary?.entriesCount ?? 0,
      recentEntries: timeEntriesList.results,
    },
    activeTimer: activeTimer ?? null,
    permissions: {
      canInteract,
      canManage,
      canApprove,
      canTrackTime: canInteract && canTrackTime,
    },
  })
}

type UpdateMissionInput = {
  title?: unknown
  projectId?: unknown
  assigneeId?: unknown
  dueAt?: unknown
  expectedMinutes?: unknown
  priority?: unknown
  description?: unknown
  xpReward?: unknown
  rewardLabel?: unknown
  xpRuleId?: unknown
  costCenterId?: unknown
  billingValue?: unknown
}

const priorities = new Set(['low', 'normal', 'high', 'urgent'])

export const onRequestPatch: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const current = await getMissionAccess(env, user, params.id as string)
  if (!current) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (!(await canManageMission(env, request, user))) return permissionRequiredResponse()
  const body = await request.json().catch(() => null) as UpdateMissionInput | null
  if (!body) return Response.json({ error: 'Atualização inválida' }, { status: 400 })

  const stored = await env.DB.prepare(`SELECT title, description, priority, due_at AS dueAt, expected_minutes AS expectedMinutes, xp_reward AS xpReward, reward_label AS rewardLabel, xp_rule_id AS xpRuleId, cost_center_id AS costCenterId, billing_value AS billingValue FROM missions WHERE id = ?`).bind(current.id).first<{ title: string; description: string; priority: string; dueAt: string | null; expectedMinutes: number | null; xpReward: number; rewardLabel: string | null; xpRuleId: string | null; costCenterId: string | null; billingValue: number }>()
  if (!stored) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : stored.title
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 4000) : stored.description
  const priority = typeof body.priority === 'string' ? body.priority : stored.priority
  const dueAt = typeof body.dueAt === 'string' ? body.dueAt : stored.dueAt
  const expectedMinutes = typeof body.expectedMinutes === 'number' && Number.isInteger(body.expectedMinutes) && body.expectedMinutes >= 0 ? body.expectedMinutes : stored.expectedMinutes
  const xpReward = typeof body.xpReward === 'number' ? body.xpReward : stored.xpReward
  const rewardLabel = typeof body.rewardLabel === 'string' ? body.rewardLabel.trim().slice(0, 120) || null : stored.rewardLabel
  const xpRuleId = body.xpRuleId === null || body.xpRuleId === '' ? null : typeof body.xpRuleId === 'string' ? body.xpRuleId : stored.xpRuleId
  let costCenterId = stored.costCenterId
  if (Object.prototype.hasOwnProperty.call(body, 'costCenterId')) {
    if (body.costCenterId === null || body.costCenterId === '') costCenterId = null
    else if (typeof body.costCenterId === 'string' && body.costCenterId) costCenterId = body.costCenterId
    else return Response.json({ error: 'Centro de custos inválido' }, { status: 400 })
  }
  let billingValue = stored.billingValue
  if (Object.prototype.hasOwnProperty.call(body, 'billingValue')) {
    if (typeof body.billingValue !== 'number' || !Number.isFinite(body.billingValue) || body.billingValue < 0) {
      return Response.json({ error: 'Valor de faturamento inválido' }, { status: 400 })
    }
    billingValue = body.billingValue
  }
  if (!title || !priorities.has(priority) || !dueAt || Number.isNaN(Date.parse(dueAt)) || !Number.isInteger(xpReward) || xpReward < 0 || xpReward > 10000) return Response.json({ error: 'Dados da missão inválidos' }, { status: 400 })

  const nextProjectId = typeof body.projectId === 'string' ? body.projectId : current.projectId
  const project = await env.DB.prepare('SELECT id, client_id AS clientId FROM projects WHERE id = ? AND organization_id = ? LIMIT 1').bind(nextProjectId, user.organizationId).first<{ id: string; clientId: string }>()
  if (!project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })
  const nextAssigneeId = typeof body.assigneeId === 'string' ? body.assigneeId : current.assigneeId
  if (!nextAssigneeId) return Response.json({ error: 'Responsável obrigatório' }, { status: 400 })
  const assignee = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? LIMIT 1').bind(nextAssigneeId, user.organizationId).first<{ id: string }>()
  if (!assignee) return Response.json({ error: 'Responsável não encontrado' }, { status: 404 })
  if (costCenterId) {
    const costCenter = await env.DB.prepare('SELECT id FROM cost_centers WHERE id = ? AND organization_id = ? LIMIT 1').bind(costCenterId, user.organizationId).first<{ id: string }>()
    if (!costCenter) return Response.json({ error: 'Centro de custos não encontrado' }, { status: 404 })
  }
  const xpRule = xpRuleId ? await env.DB.prepare('SELECT id, base_xp AS baseXp FROM xp_rules WHERE id = ? AND organization_id = ? AND is_active = 1').bind(xpRuleId, user.organizationId).first<{ id: string; baseXp: number }>() : null
  if (xpRuleId && !xpRule) return Response.json({ error: 'Regra de XP não encontrada ou inativa' }, { status: 404 })
  if (project.id !== current.projectId) {
    const attachment = await env.DB.prepare('SELECT id FROM mission_attachments WHERE mission_id = ? LIMIT 1').bind(current.id).first<{ id: string }>()
    if (attachment) return Response.json({ error: 'Remova os anexos antes de mover a missão para outro projeto' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const changes = ['updated']
  if (project.id !== current.projectId) changes.push('project_changed')
  if (assignee.id !== current.assigneeId) changes.push('reassigned')
  const statements = [
    env.DB.prepare(`UPDATE missions SET project_id = ?, client_id = ?, title = ?, description = ?, priority = ?, due_at = ?, expected_minutes = ?, xp_reward = ?, reward_label = ?, xp_rule_id = ?, cost_center_id = ?, billing_value = ?, updated_at = ? WHERE id = ?`).bind(project.id, project.clientId, title, description, priority, new Date(dueAt).toISOString(), expectedMinutes, xpRule?.baseXp ?? xpReward, rewardLabel, xpRule?.id ?? null, costCenterId, billingValue, now, current.id),
  ]
  if (assignee.id !== current.assigneeId) statements.push(env.DB.prepare('DELETE FROM mission_assignees WHERE mission_id = ?').bind(current.id), env.DB.prepare('INSERT INTO mission_assignees (mission_id, user_id) VALUES (?, ?)').bind(current.id, assignee.id))
  for (const action of changes) statements.push(env.DB.prepare('INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), current.id, user.id, action, action === 'reassigned' ? 'Responsável atualizado.' : action === 'project_changed' ? 'Projeto atualizado.' : 'Dados da missão atualizados.', now))
  await env.DB.batch(statements)
  return Response.json({ mission: { id: current.id, title, projectId: project.id, assigneeId: assignee.id, dueAt: new Date(dueAt).toISOString(), expectedMinutes, priority, description, xpReward: xpRule?.baseXp ?? xpReward, xpRuleId: xpRule?.id ?? null, rewardLabel } })
}

export const onRequestDelete: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'missions.delete'))) return permissionRequiredResponse()
  const mission = await env.DB.prepare(`SELECT missions.id, missions.title, missions.status FROM missions JOIN projects ON projects.id = missions.project_id WHERE missions.id = ? AND projects.organization_id = ?`).bind(params.id, user.organizationId).first<{ id: string; title: string; status: string }>()
  if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (mission.status === 'completed') return Response.json({ error: 'Missões concluídas não podem ser excluídas porque já possuem histórico e XP. Cancele antes da conclusão.' }, { status: 409 })
  if (mission.status === 'cancelled') return new Response(null, { status: 204 })
  const nowDate = new Date()
  const now = nowDate.toISOString()
  const { statements: timerStatements } = await closeActiveTimers(env.DB, mission.id, user.organizationId, nowDate)
  await env.DB.batch([
    env.DB.prepare(`UPDATE missions SET status = 'cancelled', updated_at = ? WHERE id = ?`).bind(now, mission.id),
    env.DB.prepare(`INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, 'cancelled', 'Missão cancelada e removida das visões operacionais.', ?)`).bind(crypto.randomUUID(), mission.id, user.id, now),
    ...timerStatements,
  ])
  return new Response(null, { status: 204 })
}
