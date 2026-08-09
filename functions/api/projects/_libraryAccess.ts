import { hasPermissionV2, getPermissionScope, type AccessUser, type Bindings } from '../_access'

export async function canAccessProjectLibrary(env: Bindings, request: Request, user: AccessUser, projectId: string) {
  const canManage = await hasPermissionV2(env, request, user, 'library.manage')
  if (canManage) return true

  const scope = await getPermissionScope(env, request, user, 'library.view')
  if (!scope) return false

  if (scope === 'all') return true

  if (scope === 'assigned_clients') {
    const isClientManager = await env.DB.prepare(`
      SELECT clients.id
      FROM projects
      JOIN clients ON clients.id = projects.client_id
      WHERE projects.id = ? AND clients.account_manager_id = ?
      LIMIT 1
    `).bind(projectId, user.id).first()
    if (isClientManager) return true
  }

  // default / participating_projects check
  const assignment = await env.DB.prepare(`
    SELECT mission_assignees.user_id
    FROM mission_assignees
    JOIN missions ON missions.id = mission_assignees.mission_id
    WHERE mission_assignees.user_id = ? AND missions.project_id = ?
    LIMIT 1
  `).bind(user.id, projectId).first<{ user_id: string }>()

  return Boolean(assignment)
}
