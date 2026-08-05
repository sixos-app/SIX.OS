import { accessRequiredResponse, getAccessUser, hasPermission, permissionRequiredResponse, type Bindings } from './_access'

type CreateMissionInput = {
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

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!hasPermission(user, 'missions.assign')) return permissionRequiredResponse()

  const body = await request.json().catch(() => null) as CreateMissionInput | null
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : ''
  const projectId = typeof body?.projectId === 'string' ? body.projectId : ''
  const assigneeId = typeof body?.assigneeId === 'string' ? body.assigneeId : ''
  const dueAt = typeof body?.dueAt === 'string' && !Number.isNaN(Date.parse(body.dueAt)) ? new Date(body.dueAt).toISOString() : ''
  const priority = typeof body?.priority === 'string' && priorities.has(body.priority) ? body.priority : 'normal'
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 4000) : ''
  const xpReward = typeof body?.xpReward === 'number' && Number.isInteger(body.xpReward) && body.xpReward >= 0 && body.xpReward <= 10000 ? body.xpReward : 0
  const rewardLabel = typeof body?.rewardLabel === 'string' ? body.rewardLabel.trim().slice(0, 120) : null
  if (!title || !projectId || !assigneeId || !dueAt) return Response.json({ error: 'Título, projeto, responsável e prazo são obrigatórios' }, { status: 400 })

  const project = await env.DB.prepare('SELECT id, client_id AS clientId FROM projects WHERE id = ? AND organization_id = ? LIMIT 1').bind(projectId, user.organizationId).first<{ id: string; clientId: string }>()
  if (!project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })
  const assignee = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? LIMIT 1').bind(assigneeId, user.organizationId).first<{ id: string }>()
  if (!assignee) return Response.json({ error: 'Responsável não encontrado' }, { status: 404 })

  const missionId = crypto.randomUUID(), now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO missions (id, project_id, client_id, title, description, status, priority, xp_reward, reward_label, due_at, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`)
      .bind(missionId, project.id, project.clientId, title, description, priority, xpReward, rewardLabel, dueAt, user.id, now, now),
    env.DB.prepare('INSERT INTO mission_assignees (mission_id, user_id) VALUES (?, ?)').bind(missionId, assignee.id),
    env.DB.prepare('INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), missionId, user.id, 'created', 'Missão criada e atribuída.', now),
  ])
  return Response.json({ id: missionId, title, projectId: project.id, assigneeId: assignee.id, dueAt, priority, xpReward, description }, { status: 201 })
}
