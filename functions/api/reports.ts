import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, getPermissionScope, type Bindings } from './_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const scope = await getPermissionScope(env, request, user, 'reports.view')
  if (!scope) return permissionRequiredResponse()

  const url = new URL(request.url)
  const reportType = url.searchParams.get('type') || 'client'

  if (reportType === 'client') {
    let scopeFilter = ''
    let binds: any[] = [user.organizationId]
    if (scope === 'assigned_clients') {
      scopeFilter = ' AND c.account_manager_id = ?'
      binds.push(user.id)
    } else if (scope === 'department') {
      scopeFilter = ' AND c.account_manager_id IN (SELECT id FROM users WHERE department_id = ?)'
      binds.push(user.departmentId || 'none')
    } else if (scope !== 'all') {
      return Response.json([])
    }

    const { results } = await env.DB.prepare(`
      WITH demand_stats AS (
        SELECT client_id,
          COUNT(*) AS totalDemands,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedDemands,
          SUM(CASE WHEN scope_type = 'extra' THEN 1 ELSE 0 END) AS extraDemands,
          SUM(CASE WHEN complexity = 'urgent' THEN 1 ELSE 0 END) AS urgentDemands
        FROM demands
        WHERE organization_id = ?
        GROUP BY client_id
      ), time_stats AS (
        SELECT client_id, SUM(hours + minutes / 60.0) AS totalHoursSpent
        FROM time_entries
        WHERE organization_id = ?
        GROUP BY client_id
      )
      SELECT 
        c.id AS clientId,
        c.name AS clientName,
        COALESCE(ds.totalDemands, 0) AS totalDemands,
        COALESCE(ds.completedDemands, 0) AS completedDemands,
        COALESCE(ds.extraDemands, 0) AS extraDemands,
        COALESCE(ds.urgentDemands, 0) AS urgentDemands,
        COALESCE(ts.totalHoursSpent, 0) AS totalHoursSpent
      FROM clients c
      LEFT JOIN demand_stats ds ON ds.client_id = c.id
      LEFT JOIN time_stats ts ON ts.client_id = c.id
      WHERE c.organization_id = ?${scopeFilter}
      ORDER BY c.name
    `).bind(user.organizationId, user.organizationId, ...binds).all()

    return Response.json(results ?? [])
  }

  if (reportType === 'collaborator') {
    let scopeFilter = ''
    let binds: any[] = [user.organizationId]
    if (scope === 'team') {
      scopeFilter = ' AND u.manager_id = ?'
      binds.push(user.id)
    } else if (scope === 'department') {
      scopeFilter = ' AND u.department_id = ?'
      binds.push(user.departmentId || 'none')
    } else if (scope === 'own') {
      scopeFilter = ' AND u.id = ?'
      binds.push(user.id)
    } else if (scope !== 'all') {
      return Response.json([])
    }

    const { results } = await env.DB.prepare(`
      WITH task_stats AS (
        SELECT t.assignee_id AS user_id,
          COUNT(*) AS totalTasks,
          SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completedTasks
        FROM tasks t
        JOIN demands d ON d.id = t.demand_id
        WHERE d.organization_id = ?
        GROUP BY t.assignee_id
      ), time_stats AS (
        SELECT user_id, SUM(hours + minutes / 60.0) AS totalHoursLogged
        FROM time_entries
        WHERE organization_id = ?
        GROUP BY user_id
      )
      SELECT 
        u.id AS userId,
        u.name AS userName,
        u.role AS userRole,
        COALESCE(tasks.totalTasks, 0) AS totalTasks,
        COALESCE(tasks.completedTasks, 0) AS completedTasks,
        COALESCE(times.totalHoursLogged, 0) AS totalHoursLogged
      FROM users u
      LEFT JOIN task_stats tasks ON tasks.user_id = u.id
      LEFT JOIN time_stats times ON times.user_id = u.id
      WHERE u.organization_id = ?${scopeFilter}
      ORDER BY u.name
    `).bind(user.organizationId, user.organizationId, ...binds).all()

    return Response.json(results ?? [])
  }

  // Directory / Executive Summary
  if (scope !== 'all' && scope !== 'department') return Response.json({})

  let depFilter = ''
  let depBinds: any[] = []
  if (scope === 'department') {
    depFilter = ' AND department = ?'
    depBinds = [user.departmentId || 'none']
  }

  const { results: executive } = await env.DB.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM clients WHERE organization_id = ?) AS activeClients,
      (SELECT COUNT(*) FROM demands WHERE organization_id = ? AND status != 'completed'${depFilter}) AS activeDemands,
      (SELECT COUNT(*) FROM demands WHERE organization_id = ? AND complexity = 'urgent'${depFilter}) AS urgentCount,
      (SELECT COALESCE(SUM(hours + minutes / 60.0), 0) FROM time_entries WHERE organization_id = ?) AS totalHoursMonth
  `).bind(user.organizationId, user.organizationId, ...depBinds, user.organizationId, ...depBinds, user.organizationId).all()

  return Response.json(executive?.[0] ?? {})
}
