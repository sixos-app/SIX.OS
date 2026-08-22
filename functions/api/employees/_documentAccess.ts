import { getPermissionScope, type AccessUser, type Bindings, type PermissionScope } from '../_access'

type EmployeeRecord = { id: string; name?: string }

function employeeScopeClause(scope: PermissionScope, user: AccessUser) {
  switch (scope) {
    case 'all':
      return { sql: '', binds: [] as string[] }
    case 'own':
      return { sql: ' AND employees.user_id = ?', binds: [user.id] }
    case 'team':
      return { sql: ' AND employee_users.team_id = ?', binds: [user.teamId ?? 'none'] }
    case 'department':
    case 'unit':
      return { sql: ' AND employees.department_id = ?', binds: [user.departmentId ?? 'none'] }
    default:
      return { sql: ' AND 1 = 0', binds: [] as string[] }
  }
}
export async function getEmployeeWithinScope(
  env: Bindings,
  request: Request,
  user: AccessUser,
  employeeId: string,
  permissionCode: string,
): Promise<EmployeeRecord | null> {
  const scope = await getPermissionScope(env, request, user, permissionCode)
  if (!scope) return null

  const filter = employeeScopeClause(scope, user)
  return env.DB.prepare(`
    SELECT employees.id, employees.name
    FROM employees
    LEFT JOIN users AS employee_users ON employee_users.id = employees.user_id
    WHERE employees.id = ? AND employees.organization_id = ?${filter.sql}
    LIMIT 1
  `).bind(employeeId, user.organizationId, ...filter.binds).first<EmployeeRecord>()
}
