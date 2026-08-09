import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../_access'

export async function onRequestGet({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.assign_reviewers')
  if (!hasAccess) return permissionRequiredResponse()

  const url = new URL(request.url)
  const cycleId = url.searchParams.get('cycleId')
  
  if (!cycleId) return Response.json({ error: 'cycleId é obrigatório' }, { status: 400 })

  const assignments = await env.DB.prepare(`
    SELECT ea.id, ea.subject_user_id AS subjectUserId, ea.reviewer_user_id AS reviewerUserId, 
           ea.relationship_type AS relationshipType, ea.status,
           u1.name AS subjectName, u2.name AS reviewerName
    FROM evaluation_assignments ea
    JOIN evaluation_cycles ec ON ec.id = ea.cycle_id
    JOIN users u1 ON u1.id = ea.subject_user_id
    JOIN users u2 ON u2.id = ea.reviewer_user_id
    WHERE ea.cycle_id = ? AND ec.organization_id = ?
    ORDER BY u1.name ASC
  `).bind(cycleId, user.organizationId).all()

  return Response.json(assignments.results)
}

export async function onRequestPost({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.assign_reviewers')
  if (!hasAccess) return permissionRequiredResponse()

  const payload = await request.json() as { cycleId: string, subjectUserId: string, reviewerUserId: string, type: string }
  
  if (payload.subjectUserId === payload.reviewerUserId) {
    return Response.json({ error: 'Subject and Reviewer cannot be the same' }, { status: 400 })
  }

  // Cross-org and existence validation
  const cycle = await env.DB.prepare('SELECT id FROM evaluation_cycles WHERE id = ? AND organization_id = ?').bind(payload.cycleId, user.organizationId).first()
  if (!cycle) return Response.json({ error: 'Ciclo não encontrado' }, { status: 404 })

  const subj = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ?').bind(payload.subjectUserId, user.organizationId).first()
  const rev = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ?').bind(payload.reviewerUserId, user.organizationId).first()
  if (!subj || !rev) return Response.json({ error: 'Usuários inválidos ou de outra organização' }, { status: 400 })

  try {
    await env.DB.prepare(`
      INSERT INTO evaluation_assignments (id, cycle_id, subject_user_id, reviewer_user_id, relationship_type, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(crypto.randomUUID(), payload.cycleId, payload.subjectUserId, payload.reviewerUserId, payload.type || 'peer').run()
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return Response.json({ error: 'Assignment already exists' }, { status: 409 })
    }
    throw err
  }

  return Response.json({ success: true })
}
