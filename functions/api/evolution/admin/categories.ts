import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../_access'

export async function onRequestPost({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.competencies.manage')
  if (!hasAccess) return permissionRequiredResponse()

  const payload = await request.json() as any
  const id = crypto.randomUUID()

  await env.DB.prepare(`
    INSERT INTO competency_categories (id, organization_id, name, description, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    id,
    user.organizationId,
    payload.name,
    payload.description || null,
    payload.sortOrder || 0
  ).run()

  return Response.json({ success: true, id })
}
