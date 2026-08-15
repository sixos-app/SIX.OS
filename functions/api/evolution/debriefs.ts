import { getAccessUser, hasPermissionV2, getPermissionScope, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../_access'

export async function onRequestGet({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const scope = await getPermissionScope(env, request, user, 'development.debriefs.view')
  
  if (!scope) return permissionRequiredResponse()

  let whereClause = `ed.organization_id = ?`
  let params: any[] = [user.organizationId]

  if (scope === 'department') {
    whereClause += ` AND u.department_id = ?`
    params.push(user.departmentId)
  } else if (scope === 'team') {
    whereClause += ` AND (u.manager_id = ? OR u.id = ?)`
    params.push(user.id, user.id)
  } else if (scope === 'own') {
    whereClause += ` AND ed.subject_user_id = ?`
    params.push(user.id)
  }

  const debriefs = await env.DB.prepare(`
    SELECT 
      ed.id,
      ed.cycle_id AS cycleId,
      c.name AS cycleName,
      ed.subject_user_id AS subjectUserId,
      u.name AS subjectName,
      ed.status,
      ed.meeting_date AS meetingDate
    FROM evaluation_debriefs ed
    JOIN users u ON u.id = ed.subject_user_id
    LEFT JOIN evaluation_cycles c ON c.id = ed.cycle_id
    WHERE ${whereClause}
    ORDER BY ed.created_at DESC
  `).bind(...params).all()

  return Response.json(debriefs.results)
}

export async function onRequestPost({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'development.debriefs.edit')
  if (!hasAccess) return permissionRequiredResponse()

  const body = await request.json() as { subjectUserId: string; cycleId?: string; meetingDate?: string }
  
  if (!body.subjectUserId) return Response.json({ error: 'Subject is required' }, { status: 400 })

  const subject = await env.DB.prepare(`SELECT id, department_id, manager_id FROM users WHERE id = ? AND organization_id = ? AND status = 'active'`)
    .bind(body.subjectUserId, user.organizationId).first<{ id: string; department_id: string | null; manager_id: string | null }>()
  if (!subject) return Response.json({ error: 'Subject not found in this organization' }, { status: 404 })

  const scope = await getPermissionScope(env, request, user, 'development.debriefs.edit')
  if (scope !== 'all') {
    if (scope === 'department' && subject.department_id !== user.departmentId) {
      return permissionRequiredResponse()
    } else if (scope === 'team' && subject.manager_id !== user.id) {
      return permissionRequiredResponse()
    } else if (scope === 'own' && body.subjectUserId !== user.id) {
      return permissionRequiredResponse()
    }
  }

  // Confidentiality Check (Obscured)
  if (body.cycleId) {
    const cycle = await env.DB.prepare(`SELECT results_available_at FROM evaluation_cycles WHERE id = ? AND organization_id = ?`).bind(body.cycleId, user.organizationId).first<{ results_available_at: string | null }>()
    if (!cycle) return Response.json({ error: 'Cycle not found in this organization' }, { status: 404 })
    if (!cycle.results_available_at || new Date(cycle.results_available_at).getTime() > Date.now()) {
      return Response.json({ error: 'Cycle results are obscured and not available yet' }, { status: 403 })
    }
  }

  const id = crypto.randomUUID()

  await env.DB.prepare(`
    INSERT INTO evaluation_debriefs (
      id, organization_id, cycle_id, author_user_id, subject_user_id, meeting_date
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id, user.organizationId, body.cycleId || null, user.id, body.subjectUserId, body.meetingDate || null
  ).run()

  return Response.json({ id }, { status: 201 })
}
