import {
  accessRequiredResponse,
  getAccessUser,
  hasPermissionV2,
  permissionRequiredResponse,
  type Bindings,
} from '../../_access'

type AuditLogRow = {
  id: string
  organizationId: string
  employeeId: string
  actorUserId: string | null
  actorName: string | null
  action: string
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  details: string | null
  createdAt: string
}

export const onRequestGet: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.history.view'))) {
    return permissionRequiredResponse()
  }

  const employeeId = params.id as string

  const logs = await env.DB.prepare(`
    SELECT
      log.id,
      log.organization_id AS organizationId,
      log.employee_id AS employeeId,
      log.actor_user_id AS actorUserId,
      u.name AS actorName,
      log.action,
      log.field_name AS fieldName,
      log.old_value AS oldValue,
      log.new_value AS newValue,
      log.details,
      log.created_at AS createdAt
    FROM employee_audit_logs log
    LEFT JOIN users u ON u.id = log.actor_user_id
    WHERE log.employee_id = ? AND log.organization_id = ?
    ORDER BY log.created_at DESC
    LIMIT 100
  `).bind(employeeId, user.organizationId).all<AuditLogRow>()

  return Response.json(logs.results)
}
