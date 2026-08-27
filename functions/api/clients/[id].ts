import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../_access'
import { canAccessClient } from './_clientAccess'

type UpdateClientPayload = { description?: unknown }

export const onRequestPatch: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const client = await env.DB.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').bind(params.id, user.organizationId).first<{ id: string }>()
  if (!client) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  if (!await canAccessClient(env, request, user, client.id, 'clients.manage')) return permissionRequiredResponse()

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
