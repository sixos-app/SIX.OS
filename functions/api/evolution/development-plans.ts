import { getAccessUser, hasPermissionV2, getPermissionScope, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../_access'

export async function onRequestGet({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const scope = await getPermissionScope(env, request, user, 'development.plans.view')
  const monitorScope = await getPermissionScope(env, request, user, 'development.monitor')

  if (!scope && !monitorScope) return permissionRequiredResponse()

  // Build query based on max scope available
  let whereClause = `dp.organization_id = ? AND (dp.deleted_at IS NULL)`
  let params: any[] = [user.organizationId]

  const maxScope = scope === 'all' || monitorScope === 'all' ? 'all' 
                 : scope === 'department' || monitorScope === 'department' ? 'department'
                 : scope === 'team' || monitorScope === 'team' ? 'team'
                 : 'own'

  if (maxScope === 'department') {
    whereClause += ` AND u.department_id = ?`
    params.push(user.departmentId)
  } else if (maxScope === 'team') {
    // Direct subordinates + self for simplicity in this view
    whereClause += ` AND (u.manager_id = ? OR u.id = ?)`
    params.push(user.id, user.id)
  } else if (maxScope === 'own') {
    whereClause += ` AND dp.subject_user_id = ?`
    params.push(user.id)
  }

  const plans = await env.DB.prepare(`
    SELECT 
      dp.id,
      dp.title,
      dp.status,
      dp.start_date AS startDate,
      dp.end_date AS endDate,
      dp.subject_user_id AS subjectUserId,
      u.name AS subjectName,
      u.email AS subjectEmail
    FROM development_plans dp
    JOIN users u ON u.id = dp.subject_user_id
    WHERE ${whereClause}
    ORDER BY dp.created_at DESC
  `).bind(...params).all()

  return Response.json(plans.results)
}

export async function onRequestPost({ request, env }: { request: Request; env: Bindings }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'development.plans.create')
  if (!hasAccess) return permissionRequiredResponse()

  const body = await request.json() as { title: string; description?: string; subjectUserId?: string; sourceCycleId?: string; sourceDebriefId?: string; startDate?: string; endDate?: string }
  
  if (!body.title) {
    return Response.json({ error: 'Title is required' }, { status: 400 })
  }

  // Determine subject. If not provided, it's the creator.
  const targetSubjectId = body.subjectUserId || user.id
  const subject = await env.DB.prepare(`SELECT id, department_id, manager_id FROM users WHERE id = ? AND organization_id = ? AND status = 'active'`)
    .bind(targetSubjectId, user.organizationId).first<{ id: string; department_id: string | null; manager_id: string | null }>()
  if (!subject) return Response.json({ error: 'Subject not found in this organization' }, { status: 404 })

  // If creating for someone else, check if they have team/department/all scope
  if (targetSubjectId !== user.id) {
    const scope = await getPermissionScope(env, request, user, 'development.plans.create')
    if (scope !== 'all') {
      if (scope === 'department' && subject.department_id !== user.departmentId) {
        return permissionRequiredResponse()
      } else if (scope === 'team' && subject.manager_id !== user.id) {
        return permissionRequiredResponse()
      } else if (scope === 'own') {
        return permissionRequiredResponse()
      }
    }
  }

  // Confidentiality Check (Obscured)
  if (body.sourceCycleId) {
    const cycle = await env.DB.prepare(`SELECT results_available_at FROM evaluation_cycles WHERE id = ? AND organization_id = ?`).bind(body.sourceCycleId, user.organizationId).first<{ results_available_at: string | null }>()
    if (!cycle) return Response.json({ error: 'Cycle not found in this organization' }, { status: 404 })
    if (!cycle.results_available_at || new Date(cycle.results_available_at).getTime() > Date.now()) {
      return Response.json({ error: 'Cycle results are obscured and not available yet' }, { status: 403 })
    }
  }
  if (body.sourceDebriefId) {
    const debrief = await env.DB.prepare(`SELECT cycle_id, subject_user_id FROM evaluation_debriefs WHERE id = ? AND organization_id = ?`).bind(body.sourceDebriefId, user.organizationId).first<{ cycle_id: string | null; subject_user_id: string }>()
    if (!debrief || debrief.subject_user_id !== targetSubjectId) return Response.json({ error: 'Debrief does not belong to this subject' }, { status: 404 })
    if (body.sourceCycleId && debrief.cycle_id !== body.sourceCycleId) return Response.json({ error: 'Debrief and cycle do not match' }, { status: 400 })
    if (debrief && debrief.cycle_id) {
      const cycle = await env.DB.prepare(`SELECT results_available_at FROM evaluation_cycles WHERE id = ? AND organization_id = ?`).bind(debrief.cycle_id, user.organizationId).first<{ results_available_at: string | null }>()
      if (!cycle?.results_available_at || new Date(cycle.results_available_at).getTime() > Date.now()) {
        return Response.json({ error: 'Debrief results are obscured and not available yet' }, { status: 403 })
      }
    }
  }

  const id = crypto.randomUUID()

  await env.DB.prepare(`
    INSERT INTO development_plans (
      id, organization_id, subject_user_id, created_by, source_cycle_id, source_debrief_id, 
      title, description, start_date, end_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, user.organizationId, targetSubjectId, user.id, body.sourceCycleId || null, body.sourceDebriefId || null,
    body.title, body.description || null, body.startDate || null, body.endDate || null
  ).run()

  return Response.json({ id }, { status: 201 })
}
