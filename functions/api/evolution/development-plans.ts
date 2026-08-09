import { getAccessUser, hasPermissionV2, getPermissionScope, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../_access'

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

  // If creating for someone else, check if they have team/department/all scope
  if (targetSubjectId !== user.id) {
    const scope = await getPermissionScope(env, request, user, 'development.plans.create')
    if (scope !== 'all') {
      const subject = await env.DB.prepare(`SELECT department_id, manager_id FROM users WHERE id = ?`).bind(targetSubjectId).first<{ department_id: string, manager_id: string }>()
      if (!subject) return Response.json({ error: 'Subject not found' }, { status: 404 })

      if (scope === 'department' && subject.department_id !== user.departmentId) {
        return permissionRequiredResponse()
      } else if (scope === 'team' && subject.manager_id !== user.id) {
        return permissionRequiredResponse()
      } else if (scope === 'own') {
        return permissionRequiredResponse()
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
