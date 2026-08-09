import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../../_access'

export async function onRequestGet({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.cycles.view')
  if (!hasAccess) return permissionRequiredResponse()

  const cycle = await env.DB.prepare(`
    SELECT id, name, description, cycle_type AS cycleType, status, starts_at AS startsAt, responses_due_at AS responsesDueAt, results_available_at AS resultsAvailableAt, closed_at AS closedAt
    FROM evaluation_cycles
    WHERE id = ? AND organization_id = ?
  `).bind(params.id, user.organizationId).first()

  if (!cycle) return Response.json({ error: 'Ciclo não encontrado' }, { status: 404 })

  return Response.json(cycle)
}

export async function onRequestPut({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.cycles.manage')
  if (!hasAccess) return permissionRequiredResponse()

  const cycle = await env.DB.prepare('SELECT status FROM evaluation_cycles WHERE id = ? AND organization_id = ?').bind(params.id, user.organizationId).first<{ status: string }>()
  if (!cycle) return Response.json({ error: 'Ciclo não encontrado' }, { status: 404 })
  if (cycle.status !== 'draft' && cycle.status !== 'scheduled') return Response.json({ error: 'Apenas ciclos em rascunho ou agendados podem ser alterados estruturalmente.' }, { status: 403 })

  const payload = await request.json() as any

  await env.DB.prepare(`
    UPDATE evaluation_cycles
    SET name = ?, description = ?, cycle_type = ?, starts_at = ?, responses_due_at = ?, results_available_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).bind(
    payload.name,
    payload.description || null,
    payload.cycleType || '360',
    payload.startsAt || null,
    payload.responsesDueAt || null,
    payload.resultsAvailableAt || null,
    params.id,
    user.organizationId
  ).run()

  return Response.json({ success: true })
}
