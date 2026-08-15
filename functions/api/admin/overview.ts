import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'users.manage'))) return permissionRequiredResponse()

  const [team, roles, clients] = await Promise.all([
    env.DB.prepare(`
      SELECT users.id, users.name, users.email, users.username, users.role,
        COALESCE((SELECT GROUP_CONCAT(ura.role_code) FROM user_role_assignments ura WHERE ura.user_id = users.id), users.role) AS roles_csv
      FROM users
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

  return Response.json({
    team: team.results.map((row: any) => {
      const { roles_csv, ...member } = row
      return { ...member, roles: String(roles_csv || '').split(',').filter(Boolean) }
    }),
    roles: roles.results,
    clientCount: clients?.count ?? 0,
  })
}
