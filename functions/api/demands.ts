import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, getPermissionScope, hasPermissionV2, type Bindings } from './_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const scope = await getPermissionScope(env, request, user, 'demands.view')
  if (!scope) return permissionRequiredResponse()

  let scopeFilter = ''
  const binds: any[] = [user.organizationId]

  if (scope === 'assigned_clients') {
    scopeFilter = ' AND d.client_id IN (SELECT id FROM clients WHERE account_manager_id = ?)'
    binds.push(user.id)
  } else if (scope === 'participating_projects') {
    scopeFilter = ' AND d.project_id IN (SELECT project_id FROM missions JOIN mission_assignees ON mission_assignees.mission_id = missions.id WHERE mission_assignees.user_id = ?)'
    binds.push(user.id)
  } else if (scope === 'department') {
    scopeFilter = ' AND (d.department = ? OR d.department IN (SELECT name FROM departments WHERE id = ?))'
    binds.push(user.departmentId || 'none', user.departmentId || 'none')
  } else if (scope !== 'all') {
    return Response.json([])
  }

  const { results: demands } = await env.DB.prepare(`
    SELECT 
      d.id, d.project_id AS projectId, d.client_id AS clientId, d.title, d.description,
      d.demand_type AS demandType, d.department, d.requester_id AS requesterId,
      d.requested_at AS requestedAt, d.client_due_at AS clientDueAt, d.internal_due_at AS internalDueAt,
      d.estimated_hours AS estimatedHours, d.complexity, d.scope_type AS scopeType,
      d.urgency_reason AS urgencyReason, d.status, d.workflow_stage AS workflowStage,
      d.piece_count AS pieceCount, d.piece_formats AS pieceFormats, d.tags, d.created_at AS createdAt,
      c.name AS clientName, p.name AS projectName
    FROM demands d
    JOIN clients c ON d.client_id = c.id
    LEFT JOIN projects p ON d.project_id = p.id
    WHERE d.organization_id = ?${scopeFilter}
    ORDER BY d.created_at DESC
  `).bind(...binds).all()

  return Response.json(demands ?? [])
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const canCreate = await hasPermissionV2(env, request, user, 'demands.create')
  if (!canCreate) return permissionRequiredResponse()

  const body = await request.json().catch(() => null) as any
  if (!body || !body.title || !body.clientId) {
    return Response.json({ error: 'Título e cliente são obrigatórios' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO demands (
      id, organization_id, project_id, client_id, title, description,
      demand_type, department, requester_id, requested_at, client_due_at,
      internal_due_at, estimated_hours, complexity, scope_type, urgency_reason,
      status, workflow_stage, piece_count, piece_formats, tags, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    user.organizationId,
    body.projectId || null,
    body.clientId,
    body.title.trim(),
    body.description || null,
    body.demandType || 'social_media',
    body.department || 'design',
    user.id,
    now,
    body.clientDueAt || null,
    body.internalDueAt || null,
    body.estimatedHours || 0,
    body.complexity || 'medium',
    body.scopeType || 'contracted',
    body.urgencyReason || null,
    'open',
    'briefing',
    body.pieceCount || 1,
    body.pieceFormats || null,
    body.tags || null,
    now,
    now
  ).run()

  return Response.json({ id, ...body, status: 'open', workflowStage: 'briefing' }, { status: 201 })
}
