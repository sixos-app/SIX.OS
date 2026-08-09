import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../_access'

export async function onRequestGet({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.view')
  if (!hasAccess) return permissionRequiredResponse()

  // Get active cycles
  const activeCycles = await env.DB.prepare(`
    SELECT id, name, cycle_type AS cycleType, responses_due_at AS responsesDueAt
    FROM evaluation_cycles
    WHERE organization_id = ? AND status = 'active'
    ORDER BY responses_due_at ASC
  `).bind(user.organizationId).all()

  // Get pending assignments
  const pendingAssignmentsCount = await env.DB.prepare(`
    SELECT COUNT(*) as total
    FROM evaluation_assignments ea
    JOIN evaluation_cycles ec ON ec.id = ea.cycle_id
    WHERE ea.reviewer_user_id = ? AND ea.status IN ('pending', 'in_progress') AND ec.status = 'active'
  `).bind(user.id).first<{ total: number }>()

  // Get results available count
  const resultsAvailableCount = await env.DB.prepare(`
    SELECT COUNT(DISTINCT ea.cycle_id) as total
    FROM evaluation_assignments ea
    JOIN evaluation_cycles ec ON ec.id = ea.cycle_id
    WHERE ea.subject_user_id = ? AND ec.results_available_at IS NOT NULL AND datetime(ec.results_available_at) <= datetime('now')
  `).bind(user.id).first<{ total: number }>()

  return Response.json({
    activeCycles: activeCycles.results,
    pendingAssignments: pendingAssignmentsCount?.total || 0,
    resultsAvailable: resultsAvailableCount?.total || 0
  })
}
