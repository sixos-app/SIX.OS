import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'roles.manage'))) return permissionRequiredResponse()

  const { results } = await env.DB.prepare('SELECT code, module, action, description, sensitivity FROM permissions ORDER BY module ASC, code ASC').all()
  return Response.json(results)
}
