import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../_access'

export async function onRequestGet({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.cycles.view')
  if (!hasAccess) return permissionRequiredResponse()

  const cycles = await env.DB.prepare(`
    SELECT id, name, description, cycle_type AS cycleType, status, starts_at AS startsAt, responses_due_at AS responsesDueAt, results_available_at AS resultsAvailableAt, closed_at AS closedAt
    FROM evaluation_cycles
    WHERE organization_id = ?
    ORDER BY created_at DESC
  `).bind(user.organizationId).all()

  return Response.json(cycles.results)
}

export async function onRequestPost({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.cycles.manage')
  if (!hasAccess) return permissionRequiredResponse()

  const payload = await request.json() as any
  const id = crypto.randomUUID()

  await env.DB.prepare(`
    INSERT INTO evaluation_cycles (
      id, organization_id, name, description, cycle_type, status, template_id, 
      starts_at, responses_due_at, results_available_at, created_by,
      auto_assign_self, auto_assign_manager, auto_assign_direct_report,
      self_confidential, manager_confidential, peer_confidential, direct_report_confidential
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    user.organizationId,
    payload.name,
    payload.description || null,
    payload.cycleType || '360',
    'draft',
    payload.templateId || null,
    payload.startsAt || null,
    payload.responsesDueAt || null,
    payload.resultsAvailableAt || null,
    user.id,
    payload.autoAssignSelf ?? 1,
    payload.autoAssignManager ?? 1,
    payload.autoAssignDirectReport ?? 1,
    payload.selfConfidential ?? 0,
    payload.managerConfidential ?? 0,
    payload.peerConfidential ?? 1,
    payload.directReportConfidential ?? 1
  ).run()

  return Response.json({ success: true, id })
}
