import { hasPermission, type AccessUser, type Bindings } from '../_access'

export async function canAccessProjectLibrary(env: Bindings, user: AccessUser, projectId: string) {
  if (hasPermission(user, 'library.manage')) return true

  const assignment = await env.DB.prepare(`
    SELECT mission_assignees.user_id
    FROM mission_assignees
    JOIN missions ON missions.id = mission_assignees.mission_id
    WHERE mission_assignees.user_id = ? AND missions.project_id = ?
    LIMIT 1
  `).bind(user.id, projectId).first<{ user_id: string }>()

  return Boolean(assignment)
}
