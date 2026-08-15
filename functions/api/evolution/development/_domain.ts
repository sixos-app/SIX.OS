import type { D1Database } from '@cloudflare/workers-types'
import { getPermissionScope, type AccessUser } from '../../_access'

/**
 * Validates if the user has permission to access a specific subject user's data
 * based on their RBAC V2 scope (own, team, department, all) and manager_id hierarchy.
 */
export async function validateDevelopmentScope(
  env: { DB: D1Database },
  request: Request,
  user: AccessUser,
  subjectUserId: string,
  permissionCode: string
): Promise<boolean> {
  // If the user is the subject themselves, they need the 'own' scope (or higher).
  // Wait, if they are the subject, we check if they have any scope that allows it.
  const scope = await getPermissionScope(env, request, user, permissionCode)
  if (!scope) return false

  if (scope === 'all') return true

  // 'own' scope
  if (user.id === subjectUserId) {
    return true
  }

  // If the request is for someone else, 'own' scope is not enough
  if (scope === 'own') return false

  // Determine the subject user's organization and manager hierarchy
  const subject = await env.DB.prepare(`
    SELECT organization_id as organizationId, department_id as departmentId, manager_id as managerId
    FROM users 
    WHERE id = ? AND status = 'active'
    LIMIT 1
  `).bind(subjectUserId).first<{ organizationId: string; departmentId: string; managerId: string | null }>()

  if (!subject) return false

  // Multi-org boundary check (Critical Invariant)
  if (subject.organizationId !== user.organizationId) {
    return false
  }

  if (scope === 'department') {
    return user.departmentId === subject.departmentId && user.departmentId !== null
  }

  if (scope === 'team') {
    // Check if the current user is the direct manager of the subject.
    if (subject.managerId === user.id) {
      return true
    }
    
    // Check if there is an indirect reporting line (one level up for example)
    // For full tree, CTE could be used. Let's implement a CTE to find all subordinates up to 5 levels.
    const tree = await env.DB.prepare(`
      WITH RECURSIVE subordinate_tree(id, manager_id, level) AS (
        SELECT id, manager_id, 0 FROM users WHERE manager_id = ?
        UNION ALL
        SELECT u.id, u.manager_id, st.level + 1
        FROM users u
        JOIN subordinate_tree st ON u.manager_id = st.id
        WHERE st.level < 5
      )
      SELECT id FROM subordinate_tree WHERE id = ?
      LIMIT 1
    `).bind(user.id, subjectUserId).first<{ id: string }>()

    if (tree) return true
  }

  return false
}

/**
 * Shared helper to enforce domain logic related to debrief immutability
 */
export async function assertDebriefMutable(env: { DB: D1Database }, debriefId: string): Promise<void> {
  const debrief = await env.DB.prepare(
    'SELECT status FROM evaluation_debriefs WHERE id = ?'
  ).bind(debriefId).first<{ status: string }>()

  if (debrief && debrief.status === 'completed') {
    throw new Error('Debrief is completed and immutable.')
  }
}
