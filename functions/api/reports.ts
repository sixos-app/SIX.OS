import { accessRequiredResponse, getAccessUser, type Bindings } from './_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const url = new URL(request.url)
  const reportType = url.searchParams.get('type') || 'client'

  if (reportType === 'client') {
    const { results } = await env.DB.prepare(`
      SELECT 
        c.id AS clientId,
        c.name AS clientName,
        COUNT(DISTINCT d.id) AS totalDemands,
        SUM(CASE WHEN d.status = 'completed' THEN 1 ELSE 0 END) AS completedDemands,
        SUM(CASE WHEN d.scope_type = 'extra' THEN 1 ELSE 0 END) AS extraDemands,
        SUM(CASE WHEN d.complexity = 'urgent' THEN 1 ELSE 0 END) AS urgentDemands,
        COALESCE(SUM(te.hours + te.minutes / 60.0), 0) AS totalHoursSpent
      FROM clients c
      LEFT JOIN demands d ON d.client_id = c.id
      LEFT JOIN time_entries te ON te.client_id = c.id
      WHERE c.organization_id = ?
      GROUP BY c.id, c.name
    `).bind(user.organizationId).all()

    return Response.json(results ?? [])
  }

  if (reportType === 'collaborator') {
    const { results } = await env.DB.prepare(`
      SELECT 
        u.id AS userId,
        u.name AS userName,
        u.role AS userRole,
        COUNT(DISTINCT t.id) AS totalTasks,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completedTasks,
        COALESCE(SUM(te.hours + te.minutes / 60.0), 0) AS totalHoursLogged
      FROM users u
      LEFT JOIN tasks t ON t.assignee_id = u.id
      LEFT JOIN time_entries te ON te.user_id = u.id
      WHERE u.organization_id = ?
      GROUP BY u.id, u.name, u.role
    `).bind(user.organizationId).all()

    return Response.json(results ?? [])
  }

  // Directory / Executive Summary
  const { results: executive } = await env.DB.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM clients WHERE organization_id = ?) AS activeClients,
      (SELECT COUNT(*) FROM demands WHERE organization_id = ? AND status != 'completed') AS activeDemands,
      (SELECT COUNT(*) FROM demands WHERE organization_id = ? AND complexity = 'urgent') AS urgentCount,
      (SELECT COALESCE(SUM(hours + minutes / 60.0), 0) FROM time_entries WHERE organization_id = ?) AS totalHoursMonth
  `).bind(user.organizationId, user.organizationId, user.organizationId, user.organizationId).all()

  return Response.json(executive?.[0] ?? {})
}
