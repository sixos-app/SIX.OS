import { accessRequiredResponse, getAccessUser, hasPermission, permissionRequiredResponse, type Bindings } from '../_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!hasPermission(user, 'users.manage')) return permissionRequiredResponse()

  const [team, roles, clients] = await Promise.all([
    env.DB.prepare(`
      SELECT users.id, users.name, users.email, users.username, COALESCE(user_role_assignments.role_code, users.role) AS role
      FROM users
      LEFT JOIN user_role_assignments ON user_role_assignments.user_id = users.id
      WHERE users.organization_id = ?
      ORDER BY users.name
    `).bind(user.organizationId).all(),
    env.DB.prepare(`
      SELECT role_definitions.code, role_definitions.name, role_definitions.description, COUNT(role_permissions.permission) AS permissionCount
      FROM role_definitions
      LEFT JOIN role_permissions ON role_permissions.role_code = role_definitions.code
      GROUP BY role_definitions.code, role_definitions.name, role_definitions.description
      ORDER BY role_definitions.code
    `).all(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM clients WHERE organization_id = ?').bind(user.organizationId).first<{ count: number }>(),
  ])

  return Response.json({ team: team.results, roles: roles.results, clientCount: clients?.count ?? 0 })
}
