import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../../_access'
import { notifyMentionedUsers } from '../../_notifications'
import { canAccessMission, getMissionAccess } from '../_missionAccess'

export const onRequestPost: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const mission = await getMissionAccess(env, user, params.id as string)
  if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (!(await canAccessMission(env, request, user, mission))) return permissionRequiredResponse()
  const body = await request.json().catch(() => null) as { body?: unknown } | null
  const commentBody = typeof body?.body === 'string' ? body.body.trim().slice(0, 3000) : ''
  if (!commentBody) return Response.json({ error: 'Escreva um comentário' }, { status: 400 })
  const comment = { id: crypto.randomUUID(), body: commentBody, createdAt: new Date().toISOString(), author: user.name }
  await env.DB.batch([
    env.DB.prepare('INSERT INTO mission_comments (id, mission_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(comment.id, mission.id, user.id, comment.body, comment.createdAt),
    env.DB.prepare('INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), mission.id, user.id, 'commented', 'Comentou na missão.', comment.createdAt),
  ])

  // Notificar colaboradores mencionados no comentário
  await notifyMentionedUsers(env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorName: user.name,
    text: comment.body,
    entityType: 'mission',
    entityId: mission.id,
    entityTitle: mission.title,
  })

  return Response.json({ comment }, { status: 201 })
}
