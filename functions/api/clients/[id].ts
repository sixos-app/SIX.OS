import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

type UpdateClientPayload = { description?: unknown }

export const onRequestPatch: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'clients.manage'))) return permissionRequiredResponse()

  const payload = await request.json().catch(() => null) as UpdateClientPayload | null
  if (!payload || typeof payload.description !== 'string') {
    return Response.json({ error: 'Descrição inválida' }, { status: 400 })
  }

  const normalizedDescription = payload.description.trim()
  if (normalizedDescription.length > 1200) {
    return Response.json({ error: 'A descrição deve ter no máximo 1.200 caracteres' }, { status: 400 })
  }

  const description = normalizedDescription || null
  const result = await env.DB.prepare(`
    UPDATE clients
    SET description = ?
    WHERE id = ? AND organization_id = ?
  `).bind(description, params.id, user.organizationId).run()

  if (result.meta.changes !== 1) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  return Response.json({ description })
}
