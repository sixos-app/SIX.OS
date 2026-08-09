import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../_access'

export async function onRequestGet({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.competencies.manage')
  if (!hasAccess) return permissionRequiredResponse()

  const templates = await env.DB.prepare(`
    SELECT id, name, scale_id AS scaleId
    FROM evaluation_templates
    WHERE organization_id = ?
    ORDER BY created_at DESC
  `).bind(user.organizationId).all()

  // For this overview, we don't fetch all questions to save bandwidth, just the templates
  return Response.json(templates.results)
}

export async function onRequestPost({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.competencies.manage')
  if (!hasAccess) return permissionRequiredResponse()

  const payload = await request.json() as any
  const id = crypto.randomUUID()

  await env.DB.prepare(`
    INSERT INTO evaluation_templates (id, organization_id, name, scale_id)
    VALUES (?, ?, ?, ?)
  `).bind(
    id,
    user.organizationId,
    payload.name,
    payload.scaleId || null
  ).run()

  return Response.json({ success: true, id })
}
