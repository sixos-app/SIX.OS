import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../_access'
import { canManageCostCenters } from '../_costCenterAccess'

export const onRequestDelete: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await canManageCostCenters(env, request, user))) {
    return permissionRequiredResponse()
  }

  await env.DB.prepare('DELETE FROM cost_centers WHERE id = ? AND organization_id = ?')
    .bind(params.id, user.organizationId).run()

  return new Response(null, { status: 204 })
}
