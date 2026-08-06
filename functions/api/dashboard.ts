import { accessRequiredResponse, getAccessUser, type Bindings } from './_access'

type MissionRow = {
  id: string
  title: string
  client: string
  projectId: string
  assigneeId: string | null
  deadline: string
  xp: number
  ideas: number
  tone: 'lime' | 'purple' | 'orange'
  urgent: number
  status: 'open' | 'in_progress' | 'completed'
  approvalStatus: 'not_requested' | 'pending' | 'approved'
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const profile = await env.DB.prepare(`
    SELECT xp, ideas, level
    FROM gamification_profiles
    WHERE user_id = ?
    LIMIT 1
  `).bind(user.id).first<{ xp: number; ideas: number; level: string }>()

  if (!profile) return Response.json({ error: 'Nenhum perfil disponível' }, { status: 404 })

  const { results } = await env.DB.prepare(`
    SELECT
      missions.id,
      missions.title,
      clients.name AS client,
      missions.project_id AS projectId,
      MIN(mission_assignees.user_id) AS assigneeId,
      CASE
        WHEN date(missions.due_at) = date('now', 'localtime') THEN 'Hoje · ' || time(missions.due_at, 'localtime')
        WHEN date(missions.due_at) = date('now', 'localtime', '+1 day') THEN 'Amanhã · ' || time(missions.due_at, 'localtime')
        ELSE strftime('%d/%m · %H:%M', missions.due_at, 'localtime')
      END AS deadline,
      missions.xp_reward AS xp,
      missions.ideas_reward AS ideas,
      missions.visual_tone AS tone,
      CASE WHEN missions.priority = 'urgent' THEN 1 ELSE 0 END AS urgent,
      missions.status,
      missions.approval_status AS approvalStatus
    FROM missions
    JOIN clients ON clients.id = missions.client_id
    JOIN projects ON projects.id = missions.project_id
    LEFT JOIN mission_assignees ON mission_assignees.mission_id = missions.id
    WHERE missions.status IN ('open', 'in_progress', 'completed')
      AND projects.organization_id = ?
    GROUP BY missions.id, missions.title, clients.name, missions.project_id, missions.due_at, missions.xp_reward, missions.ideas_reward, missions.visual_tone, missions.priority, missions.status, missions.approval_status
    ORDER BY CASE WHEN missions.status = 'completed' THEN 1 ELSE 0 END, missions.due_at ASC
    LIMIT 20
  `).bind(user.organizationId).all<MissionRow>()

  let levelConfig = null
  try {
    const orgSettings = await env.DB.prepare(`
      SELECT level_config
      FROM organization_settings
      WHERE organization_id = ?
      LIMIT 1
    `).bind(user.organizationId).first<{ level_config: string | null }>()
    if (orgSettings?.level_config) {
      levelConfig = JSON.parse(orgSettings.level_config)
    }
  } catch {}

  return Response.json({
    profile: { ...profile, levelConfig },
    missions: results.map((mission) => ({ ...mission, urgent: Boolean(mission.urgent) })),
  })
}
