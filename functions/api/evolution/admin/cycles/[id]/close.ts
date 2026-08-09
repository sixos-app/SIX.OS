import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../../../_access'

export async function onRequestPost({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.close_cycle')
  if (!hasAccess) return permissionRequiredResponse()

  const cycle = await env.DB.prepare(`
    SELECT status FROM evaluation_cycles WHERE id = ? AND organization_id = ?
  `).bind(params.id, user.organizationId).first<{ status: string }>()

  if (!cycle) return Response.json({ error: 'Ciclo não encontrado' }, { status: 404 })
  if (cycle.status === 'closed' || cycle.status === 'archived') {
    return Response.json({ error: 'Ciclo já está encerrado.' }, { status: 400 })
  }

  await env.DB.prepare(`
    UPDATE evaluation_cycles SET status = 'closed', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(params.id).run()

  return Response.json({ success: true })
}
