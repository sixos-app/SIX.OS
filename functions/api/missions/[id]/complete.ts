import { accessRequiredResponse, getAccessUser, hasPermission, permissionRequiredResponse, type Bindings } from '../../_access'

type MissionReward = {
  id: string
  xp_reward: number
  ideas_reward: number
  status: string
  assigneeId: string | null
}

export const onRequestPost: PagesFunction<Bindings, { id: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const mission = await env.DB.prepare(`
    SELECT missions.id, missions.xp_reward, missions.ideas_reward, missions.status, MIN(mission_assignees.user_id) AS assigneeId
    FROM missions
    JOIN projects ON projects.id = missions.project_id
    LEFT JOIN mission_assignees ON mission_assignees.mission_id = missions.id
    WHERE missions.id = ? AND projects.organization_id = ?
    GROUP BY missions.id, missions.xp_reward, missions.ideas_reward, missions.status
  `).bind(params.id, user.organizationId).first<MissionReward>()

  if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (mission.status === 'completed') return Response.json({ error: 'Missão já concluída' }, { status: 409 })

  const canApprove = hasPermission(user, 'missions.approve')
  const isAssignee = mission.assigneeId === user.id && hasPermission(user, 'missions.update_own')
  if (!canApprove && !isAssignee) return permissionRequiredResponse()

  const completedAt = new Date().toISOString()
  if (!canApprove) {
    await env.DB.batch([
      env.DB.prepare(`UPDATE missions SET status = 'in_progress', approval_status = 'pending', approval_requested_at = ?, updated_at = ? WHERE id = ?`).bind(completedAt, completedAt, mission.id),
      env.DB.prepare(`INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, 'approval_requested', 'Entrega enviada para aprovação.', ?)`)
        .bind(crypto.randomUUID(), mission.id, user.id, completedAt),
    ])
    return Response.json({ missionId: mission.id, status: 'pending_approval' })
  }

  const recipientId = mission.assigneeId ?? user.id
  const profile = await env.DB.prepare(`
    SELECT user_id
    FROM gamification_profiles
    WHERE user_id = ?
    LIMIT 1
  `).bind(recipientId).first<{ user_id: string }>()

  if (!profile) return Response.json({ error: 'Perfil de gamificação não encontrado' }, { status: 404 })

  await env.DB.batch([
    env.DB.prepare(`UPDATE missions SET status = 'completed', approval_status = 'approved', completed_at = ?, approved_at = ?, approved_by_user_id = ?, updated_at = ? WHERE id = ?`).bind(completedAt, completedAt, user.id, completedAt, mission.id),
    env.DB.prepare(`UPDATE gamification_profiles SET xp = xp + ?, ideas = ideas + ?, updated_at = ? WHERE user_id = ?`).bind(mission.xp_reward, mission.ideas_reward, completedAt, recipientId),
    env.DB.prepare(`INSERT INTO xp_events (id, user_id, mission_id, xp, ideas, event_type, created_at) VALUES (?, ?, ?, ?, ?, 'mission_completed', ?)`)
      .bind(crypto.randomUUID(), recipientId, mission.id, mission.xp_reward, mission.ideas_reward, completedAt),
    env.DB.prepare(`INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, 'approved', 'Missão aprovada e XP liberado.', ?)`)
      .bind(crypto.randomUUID(), mission.id, user.id, completedAt),
  ])

  return Response.json({ missionId: mission.id, xp: mission.xp_reward, ideas: mission.ideas_reward })
}
