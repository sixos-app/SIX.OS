import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../../_access'

export async function onRequestPut({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.competencies.manage')
  if (!hasAccess) return permissionRequiredResponse()

  const payload = await request.json() as any
  
  const category = await env.DB.prepare('SELECT id FROM competency_categories WHERE id = ? AND organization_id = ?').bind(params.id, user.organizationId).first()
  if (!category) return Response.json({ error: 'Categoria não encontrada' }, { status: 404 })

  await env.DB.prepare(`
    UPDATE competency_categories 
    SET name = ?, description = ?, sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    payload.name,
    payload.description || null,
    payload.sortOrder || 0,
    payload.isActive === undefined ? 1 : (payload.isActive ? 1 : 0),
    params.id
  ).run()

  return Response.json({ success: true })
}
