import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'
import { canAccessMission, canManageMission, getMissionAccess } from './_missionAccess'

type DetailRow = {
  id: string; title: string; description: string; client: string; projectId: string; project: string; assigneeId: string | null; assignee: string | null; status: string; priority: string; dueAt: string | null; xpReward: number; ideasReward: number; rewardLabel: string | null; approvalStatus: string; createdAt: string; completedAt: string | null; approvedAt: string | null
}

export const onRequestGet: PagesFunction<Bindings, { id: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const mission = await getMissionAccess(env, user, params.id)
  if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (!(await canAccessMission(env, request, user, mission))) return permissionRequiredResponse()

  const detail = await env.DB.prepare(`
    SELECT missions.id, missions.title, missions.description, clients.name AS client,
      projects.id AS projectId, projects.name AS project, MIN(mission_assignees.user_id) AS assigneeId,
      MIN(users.name) AS assignee, missions.status, missions.priority, missions.due_at AS dueAt,
      missions.xp_reward AS xpReward, missions.ideas_reward AS ideasReward, missions.reward_label AS rewardLabel,
      missions.approval_status AS approvalStatus, missions.created_at AS createdAt,
      missions.completed_at AS completedAt, missions.approved_at AS approvedAt
    FROM missions
    JOIN projects ON projects.id = missions.project_id
    JOIN clients ON clients.id = missions.client_id
    LEFT JOIN mission_assignees ON mission_assignees.mission_id = missions.id
    LEFT JOIN users ON users.id = mission_assignees.user_id
    WHERE missions.id = ? AND projects.organization_id = ?
    GROUP BY missions.id
    LIMIT 1
  `).bind(params.id, user.organizationId).first<DetailRow>()
  if (!detail) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  const [checklist, comments, attachments, history] = await Promise.all([
    env.DB.prepare('SELECT id, label, is_completed AS isCompleted, position FROM mission_checklist_items WHERE mission_id = ? ORDER BY position, created_at').bind(mission.id).all(),
    env.DB.prepare('SELECT comments.id, comments.body, comments.created_at AS createdAt, users.name AS author FROM mission_comments comments JOIN users ON users.id = comments.user_id WHERE comments.mission_id = ? ORDER BY comments.created_at DESC').bind(mission.id).all(),
    env.DB.prepare('SELECT attachments.id, attachments.library_file_id AS libraryFileId, attachments.file_name AS fileName, attachments.file_version AS fileVersion, attachments.created_at AS createdAt FROM mission_attachments attachments WHERE attachments.mission_id = ? ORDER BY attachments.created_at DESC').bind(mission.id).all(),
    env.DB.prepare('SELECT history.id, history.action, history.detail, history.created_at AS createdAt, users.name AS actor FROM mission_history history LEFT JOIN users ON users.id = history.actor_user_id WHERE history.mission_id = ? ORDER BY history.created_at DESC LIMIT 30').bind(mission.id).all(),
  ])
  const [canInteract, canManage, canApprove] = await Promise.all([
    canAccessMission(env, request, user, mission),
    canManageMission(env, request, user),
    hasPermissionV2(env, request, user, 'missions.approve')
  ])
  return Response.json({ mission: detail, checklist: checklist.results, comments: comments.results, attachments: attachments.results, history: history.results, permissions: { canInteract, canManage, canApprove } })
}

type UpdateMissionInput = {
  title?: unknown
  projectId?: unknown
  assigneeId?: unknown
  dueAt?: unknown
  priority?: unknown
  description?: unknown
  xpReward?: unknown
  rewardLabel?: unknown
}

const priorities = new Set(['low', 'normal', 'high', 'urgent'])

export const onRequestPatch: PagesFunction<Bindings, { id: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const current = await getMissionAccess(env, user, params.id)
  if (!current) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (!(await canManageMission(env, request, user))) return permissionRequiredResponse()
  const body = await request.json().catch(() => null) as UpdateMissionInput | null
  if (!body) return Response.json({ error: 'Atualização inválida' }, { status: 400 })

  const stored = await env.DB.prepare(`SELECT title, description, priority, due_at AS dueAt, xp_reward AS xpReward, reward_label AS rewardLabel FROM missions WHERE id = ?`).bind(current.id).first<{ title: string; description: string; priority: string; dueAt: string | null; xpReward: number; rewardLabel: string | null }>()
  if (!stored) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : stored.title
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 4000) : stored.description
  const priority = typeof body.priority === 'string' ? body.priority : stored.priority
  const dueAt = typeof body.dueAt === 'string' ? body.dueAt : stored.dueAt
  const xpReward = typeof body.xpReward === 'number' ? body.xpReward : stored.xpReward
  const rewardLabel = typeof body.rewardLabel === 'string' ? body.rewardLabel.trim().slice(0, 120) || null : stored.rewardLabel
  if (!title || !priorities.has(priority) || !dueAt || Number.isNaN(Date.parse(dueAt)) || !Number.isInteger(xpReward) || xpReward < 0 || xpReward > 10000) return Response.json({ error: 'Dados da missão inválidos' }, { status: 400 })

  const nextProjectId = typeof body.projectId === 'string' ? body.projectId : current.projectId
  const project = await env.DB.prepare('SELECT id, client_id AS clientId FROM projects WHERE id = ? AND organization_id = ? LIMIT 1').bind(nextProjectId, user.organizationId).first<{ id: string; clientId: string }>()
  if (!project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })
  const nextAssigneeId = typeof body.assigneeId === 'string' ? body.assigneeId : current.assigneeId
  if (!nextAssigneeId) return Response.json({ error: 'Responsável obrigatório' }, { status: 400 })
  const assignee = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? LIMIT 1').bind(nextAssigneeId, user.organizationId).first<{ id: string }>()
  if (!assignee) return Response.json({ error: 'Responsável não encontrado' }, { status: 404 })
  if (project.id !== current.projectId) {
    const attachment = await env.DB.prepare('SELECT id FROM mission_attachments WHERE mission_id = ? LIMIT 1').bind(current.id).first<{ id: string }>()
    if (attachment) return Response.json({ error: 'Remova os anexos antes de mover a missão para outro projeto' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const changes = ['updated']
  if (project.id !== current.projectId) changes.push('project_changed')
  if (assignee.id !== current.assigneeId) changes.push('reassigned')
  const statements = [
    env.DB.prepare(`UPDATE missions SET project_id = ?, client_id = ?, title = ?, description = ?, priority = ?, due_at = ?, xp_reward = ?, reward_label = ?, updated_at = ? WHERE id = ?`).bind(project.id, project.clientId, title, description, priority, new Date(dueAt).toISOString(), xpReward, rewardLabel, now, current.id),
  ]
  if (assignee.id !== current.assigneeId) statements.push(env.DB.prepare('DELETE FROM mission_assignees WHERE mission_id = ?').bind(current.id), env.DB.prepare('INSERT INTO mission_assignees (mission_id, user_id) VALUES (?, ?)').bind(current.id, assignee.id))
  for (const action of changes) statements.push(env.DB.prepare('INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), current.id, user.id, action, action === 'reassigned' ? 'Responsável atualizado.' : action === 'project_changed' ? 'Projeto atualizado.' : 'Dados da missão atualizados.', now))
  await env.DB.batch(statements)
  return Response.json({ mission: { id: current.id, title, projectId: project.id, assigneeId: assignee.id, dueAt: new Date(dueAt).toISOString(), priority, description, xpReward, rewardLabel } })
}
