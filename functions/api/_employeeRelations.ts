import type { Bindings } from './_access'

export type EmployeeRelationValues = {
  userId?: string | null
  managerId?: string | null
  departmentId?: string | null
  positionId?: string | null
  professionalLevelId?: string | null
}

export function relationId(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

export async function validateEmployeeRelations(
  env: Bindings,
  organizationId: string,
  relations: EmployeeRelationValues,
): Promise<boolean> {
  const checks = [
    relations.userId == null ? null : env.DB.prepare('SELECT 1 AS valid FROM users WHERE id = ? AND organization_id = ? LIMIT 1').bind(relations.userId, organizationId),
    relations.managerId == null ? null : env.DB.prepare('SELECT 1 AS valid FROM users WHERE id = ? AND organization_id = ? LIMIT 1').bind(relations.managerId, organizationId),
    relations.departmentId == null ? null : env.DB.prepare('SELECT 1 AS valid FROM departments WHERE id = ? AND organization_id = ? LIMIT 1').bind(relations.departmentId, organizationId),
    relations.positionId == null ? null : env.DB.prepare('SELECT 1 AS valid FROM professional_positions WHERE id = ? AND organization_id = ? LIMIT 1').bind(relations.positionId, organizationId),
    relations.professionalLevelId == null ? null : env.DB.prepare('SELECT 1 AS valid FROM professional_levels WHERE id = ? AND organization_id = ? LIMIT 1').bind(relations.professionalLevelId, organizationId),
  ].filter((check): check is D1PreparedStatement => check !== null)

  const results = await Promise.all(checks.map((check) => check.first<{ valid: number }>()))
  return results.every(Boolean)
}
