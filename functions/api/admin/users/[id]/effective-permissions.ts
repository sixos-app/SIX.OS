import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, getEffectiveCapabilities, type AccessUser, type Bindings } from '../../../_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request, params }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  
  const hasUsersManage = await hasPermissionV2(env, request, administrator, 'users.manage')
  const hasRolesManage = await hasPermissionV2(env, request, administrator, 'roles.manage')
  if (!hasUsersManage && !hasRolesManage) return permissionRequiredResponse()

  const id = params.id
  if (typeof id !== 'string') return Response.json({ error: 'ID inválido' }, { status: 400 })

  const targetUser = await env.DB.prepare(`
    SELECT
      users.id,
      users.organization_id AS organizationId,
      users.team_id AS teamId,
      users.department_id AS departmentId,
      users.access_profile_id AS accessProfileId,
      users.manager_id AS managerId,
      users.name,
      users.email,
      users.role,
      users.status
    FROM users
    WHERE users.id = ? AND users.organization_id = ?
    LIMIT 1
  `).bind(id, administrator.organizationId).first<AccessUser & { status: string }>()

  if (!targetUser) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 })

  if (targetUser.status !== 'active') {
    return Response.json({ capabilities: {} })
  }

  // Generate effective capabilities using the existing V2 engine
  const capabilities = await getEffectiveCapabilities(env, request, targetUser)

  return Response.json({ capabilities })
}
