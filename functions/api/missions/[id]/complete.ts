type Bindings = { DB: D1Database }

type MissionReward = {
  id: string
  xp_reward: number
  ideas_reward: number
  status: string
}

export const onRequestPost: PagesFunction<Bindings, { id: string }> = async ({ env, params }) => {
  const mission = await env.DB.prepare(`
    SELECT id, xp_reward, ideas_reward, status
    FROM missions
    WHERE id = ?
  `).bind(params.id).first<MissionReward>()

  if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (mission.status === 'completed') return Response.json({ error: 'Missão já concluída' }, { status: 409 })

  const profile = await env.DB.prepare(`
    SELECT user_id
    FROM gamification_profiles
    ORDER BY updated_at DESC
    LIMIT 1
  `).first<{ user_id: string }>()

  if (!profile) return Response.json({ error: 'Perfil de gamificação não encontrado' }, { status: 404 })

  const completedAt = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(`UPDATE missions SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`).bind(completedAt, completedAt, mission.id),
    env.DB.prepare(`UPDATE gamification_profiles SET xp = xp + ?, ideas = ideas + ?, updated_at = ? WHERE user_id = ?`).bind(mission.xp_reward, mission.ideas_reward, completedAt, profile.user_id),
    env.DB.prepare(`INSERT INTO xp_events (id, user_id, mission_id, xp, ideas, event_type, created_at) VALUES (?, ?, ?, ?, ?, 'mission_completed', ?)`)
      .bind(crypto.randomUUID(), profile.user_id, mission.id, mission.xp_reward, mission.ideas_reward, completedAt),
  ])

  return Response.json({ missionId: mission.id, xp: mission.xp_reward, ideas: mission.ideas_reward })
}
