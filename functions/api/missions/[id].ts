import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../_access'
import { canAccessMission, canManageMission, getMissionAccess } from './_missionAccess'

type DetailRow = {
  id: string; title: string; description: string; client: string; projectId: string; project: string; assigneeId: string | null; assignee: string | null; status: string; priority: string; dueAt: string | null; xpReward: number; ideasReward: number; rewardLabel: string | null; approvalStatus: string; createdAt: string; completedAt: string | null; approvedAt: string | null
}

export const onRequestGet: PagesFunction<Bindings, { id: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const mission = await getMissionAccess(env, user, params.id)
  if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (!canAccessMission(user, mission)) return permissionRequiredResponse()

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
  return Response.json({ mission: detail, checklist: checklist.results, comments: comments.results, attachments: attachments.results, history: history.results, permissions: { canManage: canManageMission(user), canApprove: canManageMission(user) } })
}
