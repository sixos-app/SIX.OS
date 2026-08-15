import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, getPermissionScope, type Bindings } from './_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const scope = await getPermissionScope(env, request, user, 'clients.view')
  if (!scope) return permissionRequiredResponse()

  let scopeFilter = ''
  const binds: any[] = [user.organizationId]

  if (scope === 'assigned_clients') {
    scopeFilter = ' AND account_manager_id = ?'
    binds.push(user.id)
  } else if (scope === 'participating_projects') {
    scopeFilter = ' AND id IN (SELECT client_id FROM missions JOIN mission_assignees ON mission_assignees.mission_id = missions.id WHERE mission_assignees.user_id = ?)'
    binds.push(user.id)
  } else if (scope !== 'all') {
    return Response.json({ clients: [] })
  }

  const clients = await env.DB.prepare(`
    SELECT id, name, short_code AS shortCode, image_url AS imageUrl, description
    FROM clients
    WHERE organization_id = ?${scopeFilter}
    ORDER BY name
  `).bind(...binds).all()

  return Response.json({ clients: clients.results })
}
