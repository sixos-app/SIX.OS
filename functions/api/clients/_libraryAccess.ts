import { getPermissionScope, hasPermissionV2, type AccessUser, type Bindings } from '../_access'

export async function canAccessClientLibrary(
  env: Bindings,
  request: Request,
  user: AccessUser,
  clientId: string,
): Promise<boolean> {
  if (await hasPermissionV2(env, request, user, 'library.manage')) return true

  const scope = await getPermissionScope(env, request, user, 'library.view')
  if (!scope) return false
  if (scope === 'all') return true

  if (scope === 'assigned_clients') {
    const assigned = await env.DB.prepare(`
      SELECT id
      FROM clients
      WHERE id = ? AND organization_id = ? AND account_manager_id = ?
      LIMIT 1
    `).bind(clientId, user.organizationId, user.id).first()
    return Boolean(assigned)
  }

  if (scope === 'participating_projects') {
    const participating = await env.DB.prepare(`
      SELECT clients.id
      FROM clients
      JOIN missions ON missions.client_id = clients.id
      JOIN mission_assignees ON mission_assignees.mission_id = missions.id
      WHERE clients.id = ? AND clients.organization_id = ? AND mission_assignees.user_id = ?
      LIMIT 1
    `).bind(clientId, user.organizationId, user.id).first()
    return Boolean(participating)
  }

  return false
}
