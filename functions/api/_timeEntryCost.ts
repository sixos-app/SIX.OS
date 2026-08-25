import type { D1Database } from '@cloudflare/workers-types'

export type TimeEntryCostSnapshot = {
  cost: number
  hourlyRate: number
  compensationHistoryId: string | null
}

/**
 * Resolves the immutable cost snapshot for an entry at its effective business
 * date. Callers must provide that date explicitly; this helper never uses now.
 */
export async function resolveTimeEntryCost(
  db: D1Database,
  userId: string,
  organizationId: string,
  effectiveDate: string,
  durationSeconds: number,
): Promise<TimeEntryCostSnapshot> {
  const compensation = await db.prepare(`
    SELECT comp.id, comp.hourly_cost AS hourlyCost
    FROM employee_compensation_history comp
    JOIN employees emp ON emp.id = comp.employee_id
    WHERE emp.user_id = ? AND emp.organization_id = ?
      AND comp.valid_from <= ?
      AND (comp.valid_until IS NULL OR comp.valid_until >= ?)
    ORDER BY comp.valid_from DESC
    LIMIT 1
  `).bind(userId, organizationId, effectiveDate, effectiveDate).first<{ id: string; hourlyCost: number }>()

  let hourlyRate = compensation?.hourlyCost ?? 0
  if (hourlyRate <= 0) {
    const user = await db.prepare(`
      SELECT hourly_rate AS hourlyRate
      FROM users
      WHERE id = ? AND organization_id = ?
      LIMIT 1
    `).bind(userId, organizationId).first<{ hourlyRate: number }>()
    hourlyRate = user?.hourlyRate ?? 0
  }

  return {
    cost: (durationSeconds / 3600) * hourlyRate,
    hourlyRate,
    compensationHistoryId: compensation?.id ?? null,
  }
}
