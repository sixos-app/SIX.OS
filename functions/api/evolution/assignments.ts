import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../_access'

export async function onRequestGet({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.respond')
  if (!hasAccess) return permissionRequiredResponse()

  // Get assignments for the logged user
  const assignments = await env.DB.prepare(`
    SELECT 
      ea.id, 
      ea.status, 
      ea.relationship_type AS relationshipType,
      ea.subject_user_id AS subjectUserId,
      u.name AS subjectName,
      ec.name AS cycleName,
      ec.responses_due_at AS dueDate
    FROM evaluation_assignments ea
    JOIN evaluation_cycles ec ON ec.id = ea.cycle_id
    JOIN users u ON u.id = ea.subject_user_id
    WHERE ea.reviewer_user_id = ? AND ec.organization_id = ? AND ec.status = 'active'
    ORDER BY ec.responses_due_at ASC
  `).bind(user.id, user.organizationId).all()

  return Response.json(assignments.results)
}
