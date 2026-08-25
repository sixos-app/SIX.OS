import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { onRequestPost as createTimeEntry } from '../functions/api/time_entries.ts'
import { onRequestDelete as deleteCostCenter } from '../functions/api/cost-centers/[id].ts'
import { onRequestGet as listCostCenters, onRequestPost as createCostCenter } from '../functions/api/cost-centers.ts'

type Value = string | number | null
type Permission = 'all' | 'department' | 'team' | 'own' | 'assigned_clients' | 'participating_projects' | 'unit'

class Statement {
  constructor(private readonly db: FinanceDb, readonly sql: string, readonly values: Value[] = []) {}

  bind(...values: Value[]) {
    return new Statement(this.db, this.sql, values)
  }

  first<T>() {
    return this.db.first<T>(this.sql, this.values)
  }

  all<T>() {
    return this.db.all<T>(this.sql, this.values)
  }

  run() {
    return this.db.run(this.sql, this.values)
  }
}

class FinanceDb {
  permissions = new Map<string, Permission>()
  mission: { id: string; clientId: string } | null = { id: 'mission-1', clientId: 'client-1' }
  compensation = new Map<string, { id: string; hourlyCost: number }>([
    ['2026-01-15', { id: 'comp-jan', hourlyCost: 20 }],
    ['2026-08-15', { id: 'comp-aug', hourlyCost: 30 }],
  ])
  timeEntries: Array<{ missionId: string | null; cost: number; compensationHistoryId: string | null }> = []
  realizedCost = 0
  costCenters = [{ id: 'cc-1', organizationId: 'org-1', name: 'Operações', code: 'OPS', type: 'general' }]
  private previousInsertAccepted = false

  prepare(sql: string) {
    return new Statement(this, sql)
  }

  async batch(statements: Statement[]) {
    for (const statement of statements) await statement.run()
  }

  async first<T>(sql: string, values: Value[]): Promise<T | null> {
    if (sql.includes('FROM auth_sessions')) {
      return {
        expiresAt: '2099-01-01T00:00:00.000Z',
        id: 'user-1', organizationId: 'org-1', teamId: null, departmentId: null,
        accessProfileId: 'profile-1', managerId: null, name: 'User', email: 'user@six.os', role: 'specialist',
      } as T
    }
    if (sql.includes('FROM user_permission_overrides')) return null
    if (sql.includes('FROM profile_permissions')) {
      const scope = this.permissions.get(values[0] as string)
      return scope ? { scope } as T : null
    }
    if (sql.includes('SELECT id FROM users WHERE id = ?')) return { id: 'user-1' } as T
    if (sql.includes('SELECT id FROM clients WHERE id = ?')) return values[0] === 'client-1' ? { id: 'client-1' } as T : null
    if (sql.includes('FROM missions') && sql.includes('JOIN projects')) return this.mission as T | null
    if (sql.includes('FROM employee_compensation_history')) {
      const compensation = this.compensation.get(values[2] as string)
      return compensation ? compensation as T : null
    }
    if (sql.includes('SELECT hourly_rate AS hourlyRate')) return { hourlyRate: 10 } as T
    return null
  }

  async all<T>(sql: string, _values: Value[]): Promise<{ results: T[] }> {
    if (sql.includes('FROM cost_centers')) {
      return { results: this.costCenters.map(({ organizationId: _organizationId, ...center }) => center as T) }
    }
    return { results: [] }
  }

  async run(sql: string, values: Value[]) {
    if (sql.includes('INSERT INTO time_entries')) {
      this.timeEntries.push({
        missionId: values[4] as string | null,
        cost: values[12] as number,
        compensationHistoryId: values[14] as string | null,
      })
      this.previousInsertAccepted = true
    } else if (sql.includes('UPDATE missions SET realized_cost')) {
      if (this.previousInsertAccepted) this.realizedCost += values[0] as number
      this.previousInsertAccepted = false
    } else if (sql.includes('INSERT INTO cost_centers')) {
      this.costCenters.push({ id: values[0] as string, organizationId: values[1] as string, name: values[2] as string, code: values[3] as string, type: values[4] as string })
    } else if (sql.includes('DELETE FROM cost_centers')) {
      const index = this.costCenters.findIndex((center) => center.id === values[0] && center.organizationId === values[1])
      if (index >= 0) this.costCenters.splice(index, 1)
    }
    return { success: true }
  }
}

function request(body: Record<string, unknown>) {
  return new Request('https://sixos.app/api/time_entries', {
    method: 'POST', headers: { Cookie: 'sixos_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

function context(db: FinanceDb, body: Record<string, unknown>) {
  return { env: { DB: db }, request: request(body) } as never
}

async function createEntry(db: FinanceDb, body: Record<string, unknown>) {
  db.permissions.set('time_entries.create', 'all')
  return createTimeEntry(context(db, body))
}

async function runTests() {
  const baseBody = { clientId: 'client-1', hours: 2, minutes: 30, date: '2026-01-15', missionId: 'mission-1' }

  // T1, T6 and T7: permitted relation persists exactly one entry and one cost increment.
  {
    const db = new FinanceDb()
    db.permissions.set('missions.assign', 'all')
    const response = await createEntry(db, baseBody)
    assert.equal(response.status, 201)
    assert.equal(db.timeEntries.length, 1)
    assert.equal(db.realizedCost, 50)
  }

  // T2 and T5: a foreign or missing mission is indistinguishable and does not mutate state.
  {
    const db = new FinanceDb()
    db.mission = null
    const response = await createEntry(db, baseBody)
    assert.equal(response.status, 404)
    assert.equal(db.timeEntries.length, 0)
    assert.equal(db.realizedCost, 0)
  }

  // T3 and T8: same-tenant mission with a different client is rejected before the batch.
  {
    const db = new FinanceDb()
    db.permissions.set('missions.assign', 'all')
    db.mission = { id: 'mission-1', clientId: 'client-2' }
    const response = await createEntry(db, baseBody)
    assert.equal(response.status, 400)
    assert.equal(db.timeEntries.length, 0)
    assert.equal(db.realizedCost, 0)
  }

  // T4: time_entries.create alone does not bypass mission access.
  {
    const db = new FinanceDb()
    const response = await createEntry(db, baseBody)
    assert.equal(response.status, 403)
    assert.equal(db.timeEntries.length, 0)
  }

  // T9 and T10: the immutable snapshot follows the entry's effective date.
  {
    const db = new FinanceDb()
    db.permissions.set('missions.assign', 'all')
    const january = await createEntry(db, baseBody)
    const august = await createEntry(db, { ...baseBody, date: '2026-08-15' })
    assert.equal(january.status, 201)
    assert.equal(august.status, 201)
    assert.equal(db.timeEntries[0]?.compensationHistoryId, 'comp-jan')
    assert.equal(db.timeEntries[1]?.compensationHistoryId, 'comp-aug')
    assert.equal(db.timeEntries[1]?.cost, 75)
  }

  // C1/C2: finance.view or finance.manage with all scope can list organization centers.
  for (const permission of ['finance.view', 'finance.manage']) {
    const db = new FinanceDb()
    db.permissions.set(permission, 'all')
    const response = await listCostCenters({ env: { DB: db }, request: request({}) } as never)
    assert.equal(response.status, 200)
    const centers = await response.json()
    assert.ok(Array.isArray(centers))
    assert.equal(centers.length, 1)
  }

  // C3/C4: missing or non-translatable scopes are denied, never widened.
  for (const scope of [undefined, 'department'] as Array<Permission | undefined>) {
    const db = new FinanceDb()
    if (scope) db.permissions.set('finance.view', scope)
    const response = await listCostCenters({ env: { DB: db }, request: request({}) } as never)
    assert.equal(response.status, 403)
  }

  // C5/C8: deletion remains organization-filtered; a foreign id is not removed.
  {
    const db = new FinanceDb()
    db.permissions.set('finance.manage', 'all')
    db.costCenters.push({ id: 'cc-foreign', organizationId: 'org-2', name: 'Foreign', code: 'FRG', type: 'general' })
    const foreign = await deleteCostCenter({ env: { DB: db }, request: request({}), params: { id: 'cc-foreign' } } as never)
    assert.equal(foreign.status, 204)
    assert.ok(db.costCenters.some((center) => center.id === 'cc-foreign'))
    const own = await deleteCostCenter({ env: { DB: db }, request: request({}), params: { id: 'cc-1' } } as never)
    assert.equal(own.status, 204)
    assert.ok(!db.costCenters.some((center) => center.id === 'cc-1'))
  }

  // C6/C7/C9/C10: only finance.manage/all may create a validated center.
  {
    const viewDb = new FinanceDb()
    viewDb.permissions.set('finance.view', 'all')
    assert.equal((await createCostCenter({ env: { DB: viewDb }, request: request({ name: 'Ops', code: 'OPS', type: 'general' }) } as never)).status, 403)

    const manageDb = new FinanceDb()
    manageDb.permissions.set('finance.manage', 'all')
    assert.equal((await createCostCenter({ env: { DB: manageDb }, request: request({ name: 'Ops', code: 'OPS', type: 'general' }) } as never)).status, 201)
    assert.equal((await createCostCenter({ env: { DB: manageDb }, request: request({ name: 'Ops', code: 'OPS-2', type: 'invalid' }) } as never)).status, 400)
    assert.equal((await createCostCenter({ env: { DB: manageDb }, request: request({ name: '', code: 'OPS-3', type: 'general' }) } as never)).status, 400)
  }

  // C11: the route has no untyped escape hatch.
  const source = await readFile(new URL('../functions/api/cost-centers.ts', import.meta.url), 'utf8')
  assert.ok(!/as\s+any/.test(source))

  console.log('Finance backend integrity: PASS')
}

runTests().catch((error) => {
  console.error(error)
  process.exit(1)
})
