import { getPermissionScope, type AccessUser, type Bindings } from '../_access'

/**
 * Resolves client access from the permission's existing RBAC V2 scope.
 * Client mutations must use this instead of treating a granted permission as
 * organization-wide access.
 */
export async function canAccessClient(
  env: Bindings,
  request: Request,
  user: AccessUser,
  clientId: string,
  permissionCode: string,
): Promise<boolean> {
  const scope = await getPermissionScope(env, request, user, permissionCode)
  if (!scope) return false

  if (scope === 'all') {
    const client = await env.DB.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ? LIMIT 1').bind(clientId, user.organizationId).first()
    return Boolean(client)
  }

  if (scope === 'assigned_clients') {
    const client = await env.DB.prepare(`
      SELECT id
      FROM clients
      WHERE id = ? AND organization_id = ? AND account_manager_id = ?
      LIMIT 1
    `).bind(clientId, user.organizationId, user.id).first()
    return Boolean(client)
  }

  if (scope === 'participating_projects') {
    const client = await env.DB.prepare(`
      SELECT clients.id
      FROM clients
      JOIN missions ON missions.client_id = clients.id
      JOIN mission_assignees ON mission_assignees.mission_id = missions.id
      WHERE clients.id = ? AND clients.organization_id = ? AND mission_assignees.user_id = ?
      LIMIT 1
    `).bind(clientId, user.organizationId, user.id).first()
    return Boolean(client)
  }

  if (scope === 'department' && user.departmentId) {
    const client = await env.DB.prepare(`
      SELECT clients.id
      FROM clients
      JOIN users ON users.id = clients.account_manager_id
      WHERE clients.id = ? AND clients.organization_id = ? AND users.department_id = ?
      LIMIT 1
    `).bind(clientId, user.organizationId, user.departmentId).first()
    return Boolean(client)
  }

  return false
}

/** Creation has no resource to scope, so only organization-wide management may create it. */
export async function canCreateClient(env: Bindings, request: Request, user: AccessUser): Promise<boolean> {
  return (await getPermissionScope(env, request, user, 'clients.manage')) === 'all'
}
