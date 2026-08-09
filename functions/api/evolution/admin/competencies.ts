import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../_access'

export async function onRequestGet({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.competencies.manage')
  if (!hasAccess) return permissionRequiredResponse()

  const categories = await env.DB.prepare(`
    SELECT id, name, description, sort_order AS sortOrder, is_active AS isActive
    FROM competency_categories
    WHERE organization_id = ?
    ORDER BY sort_order ASC
  `).bind(user.organizationId).all()

  const competencies = await env.DB.prepare(`
    SELECT id, category_id AS categoryId, name, description, guidance, is_active AS isActive
    FROM competencies
    WHERE organization_id = ?
    ORDER BY name ASC
  `).bind(user.organizationId).all()

  return Response.json({
    categories: categories.results,
    competencies: competencies.results
  })
}

export async function onRequestPost({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.competencies.manage')
  if (!hasAccess) return permissionRequiredResponse()

  const payload = await request.json() as any
  const id = crypto.randomUUID()

  await env.DB.prepare(`
    INSERT INTO competencies (id, organization_id, category_id, name, description, guidance)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    user.organizationId,
    payload.categoryId || null,
    payload.name,
    payload.description || null,
    payload.guidance || null
  ).run()

  return Response.json({ success: true, id })
}
