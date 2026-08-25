import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

export const onRequestDelete: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'finance.manage'))) {
    return permissionRequiredResponse()
  }

  await env.DB.prepare('DELETE FROM cost_centers WHERE id = ? AND organization_id = ?')
    .bind(params.id, user.organizationId).run()

  return new Response(null, { status: 204 })
}
