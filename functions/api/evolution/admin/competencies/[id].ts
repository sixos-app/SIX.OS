import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../../_access'

export async function onRequestPut({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.competencies.manage')
  if (!hasAccess) return permissionRequiredResponse()

  const payload = await request.json() as any
  
  const comp = await env.DB.prepare('SELECT id FROM competencies WHERE id = ? AND organization_id = ?').bind(params.id, user.organizationId).first()
  if (!comp) return Response.json({ error: 'Competência não encontrada' }, { status: 404 })

  await env.DB.prepare(`
    UPDATE competencies 
    SET category_id = ?, name = ?, description = ?, guidance = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    payload.categoryId || null,
    payload.name,
    payload.description || null,
    payload.guidance || null,
    payload.isActive === undefined ? 1 : (payload.isActive ? 1 : 0),
    params.id
  ).run()

  return Response.json({ success: true })
}
