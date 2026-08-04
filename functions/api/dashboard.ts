type Bindings = { DB: D1Database }

type MissionRow = {
  id: number
  title: string
  client: string
  deadline: string
  xp: number
  ideas: number
  tone: 'lime' | 'purple' | 'orange'
  urgent: number
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env }) => {
  const profile = await env.DB.prepare(`
    SELECT xp, ideas, level
    FROM gamification_profiles
    ORDER BY updated_at DESC
    LIMIT 1
  `).first<{ xp: number; ideas: number; level: string }>()

  if (!profile) return Response.json({ error: 'Nenhum perfil disponível' }, { status: 404 })

  const { results } = await env.DB.prepare(`
    SELECT
      missions.id,
      missions.title,
      clients.name AS client,
      CASE
        WHEN date(missions.due_at) = date('now', 'localtime') THEN 'Hoje · ' || time(missions.due_at, 'localtime')
        WHEN date(missions.due_at) = date('now', 'localtime', '+1 day') THEN 'Amanhã · ' || time(missions.due_at, 'localtime')
        ELSE strftime('%d/%m · %H:%M', missions.due_at, 'localtime')
      END AS deadline,
      missions.xp_reward AS xp,
      missions.ideas_reward AS ideas,
      missions.visual_tone AS tone,
      CASE WHEN missions.priority = 'urgent' THEN 1 ELSE 0 END AS urgent
    FROM missions
    JOIN clients ON clients.id = missions.client_id
    WHERE missions.status IN ('open', 'in_progress')
    ORDER BY missions.due_at ASC
    LIMIT 8
  `).all<MissionRow>()

  return Response.json({
    profile,
    missions: results.map((mission) => ({ ...mission, urgent: Boolean(mission.urgent) })),
  })
}
