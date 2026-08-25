import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { onRequestPost as createMission } from '../functions/api/missions.ts'

type Value = string | number | null
type Scope = 'all' | 'department'

class Statement {
  constructor(private readonly db: MissionDb, readonly sql: string, readonly values: Value[] = []) {}
  bind(...values: Value[]) { return new Statement(this.db, this.sql, values) }
  first<T>() { return this.db.first<T>(this.sql, this.values) }
  all<T>() { return this.db.all<T>(this.sql, this.values) }
  run() { return this.db.run(this.sql, this.values) }
}

class MissionDb {
  permissions = new Map<string, Scope>()
  costCenters = new Set(['cc-1'])
  insertedMissions: Array<{ costCenterId: string | null; billingValue: number }> = []

  prepare(sql: string) { return new Statement(this, sql) }
  async batch(statements: Statement[]) { for (const statement of statements) await statement.run() }

  async first<T>(sql: string, values: Value[]): Promise<T | null> {
    if (sql.includes('FROM auth_sessions')) {
      return {
        expiresAt: '2099-01-01T00:00:00.000Z', id: 'user-1', organizationId: 'org-1', teamId: null,
        departmentId: null, accessProfileId: 'profile-1', managerId: null, name: 'User', email: 'user@six.os', role: 'specialist',
      } as T
    }
    if (sql.includes('FROM user_permission_overrides')) return null
    if (sql.includes('FROM profile_permissions')) {
      const scope = this.permissions.get(values[0] as string)
      return scope ? { scope } as T : null
    }
    if (sql.includes('FROM projects WHERE')) return { id: 'project-1', clientId: 'client-1' } as T
    if (sql.includes('FROM users WHERE')) return { id: 'user-1' } as T
    if (sql.includes('FROM cost_centers')) return this.costCenters.has(values[0] as string) ? { id: values[0] } as T : null
    if (sql.includes('FROM xp_rules')) return null
    if (sql.includes('FROM workflow_boards')) return { id: 'board-1', name: 'Fluxo' } as T
    return null
  }

  async all<T>(sql: string, _values: Value[]): Promise<{ results: T[] }> {
    if (sql.includes('FROM workflow_stages')) {
      return { results: [{ id: 'stage-1', boardId: 'board-1', name: 'A Fazer', position: 0, type: 'ready', color: 'purple', isInitial: 1, isFinal: 0, requiresApproval: 0 } as T] }
    }
    return { results: [] }
  }

  async run(sql: string, values: Value[]) {
    if (sql.includes('INSERT INTO missions')) {
      this.insertedMissions.push({ costCenterId: values[17] as string | null, billingValue: values[18] as number })
    }
    return { success: true, meta: { changes: 1 } }
  }
}

function request(body: Record<string, unknown>) {
  return new Request('https://sixos.app/api/missions', {
    method: 'POST', headers: { Cookie: 'sixos_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

function baseMission() {
  return { title: 'Missão financeira', projectId: 'project-1', assigneeId: 'user-1', dueAt: '2026-08-30T12:00:00.000Z' }
}

async function post(db: MissionDb, body: Record<string, unknown>) {
  db.permissions.set('missions.assign', 'all')
  return createMission({ env: { DB: db }, request: request(body) } as never)
}

async function runTests() {
  // M1: operational creation stays available without finance permissions.
  {
    const db = new MissionDb()
    const response = await post(db, baseMission())
    assert.equal(response.status, 201)
    assert.deepEqual(db.insertedMissions, [{ costCenterId: null, billingValue: 0 }])
  }

  // M2/M3: direct payload injection is explicitly denied.
  for (const financialField of [{ costCenterId: 'cc-1' }, { billingValue: 1000 }]) {
    const db = new MissionDb()
    const response = await post(db, { ...baseMission(), ...financialField })
    assert.equal(response.status, 403)
    assert.equal(db.insertedMissions.length, 0)
  }

  // M4: finance.manage/all persists the accepted values and returns their contract.
  {
    const db = new MissionDb()
    db.permissions.set('finance.manage', 'all')
    const response = await post(db, { ...baseMission(), costCenterId: 'cc-1', billingValue: 1250.5 })
    assert.equal(response.status, 201)
    assert.deepEqual(db.insertedMissions, [{ costCenterId: 'cc-1', billingValue: 1250.5 }])
    const saved = await response.json() as { costCenterId?: string; billingValue?: number }
    assert.equal(saved.costCenterId, 'cc-1')
    assert.equal(saved.billingValue, 1250.5)
  }

  // M5: a cost center outside the current organization cannot be attached.
  {
    const db = new MissionDb()
    db.permissions.set('finance.manage', 'all')
    const response = await post(db, { ...baseMission(), costCenterId: 'cc-foreign' })
    assert.equal(response.status, 404)
    assert.equal(db.insertedMissions.length, 0)
  }

  // M6/M7: invalid numeric inputs are rejected before persistence.
  for (const billingValue of [-1, 'invalid', null]) {
    const db = new MissionDb()
    db.permissions.set('finance.manage', 'all')
    const response = await post(db, { ...baseMission(), billingValue })
    assert.equal(response.status, 400)
    assert.equal(db.insertedMissions.length, 0)
  }

  const [dashboard, dashboardTypes, modal, details, appShell] = await Promise.all([
    readFile(new URL('../functions/api/dashboard.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/data/dashboard.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/missions/MissionCreateModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/missions/MissionDetailsModal.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/AppShell.tsx', import.meta.url), 'utf8'),
  ])

  // D1-D4: dashboard aliases and optional client contract preserve nullability.
  assert.match(dashboard, /missions\.billing_value AS billingValue/)
  assert.match(dashboard, /missions\.cost_center_id AS costCenterId/)
  assert.match(dashboardTypes, /billingValue\?: number/)
  assert.match(dashboardTypes, /costCenterId\?: string \| null/)

  // MC1-MC6: modal uses existing capabilities, fetches only for eligible users,
  // and keeps creation independent from list errors.
  assert.match(modal, /can\('finance\.manage'\) && hasScope\('finance\.manage', 'all'\)/)
  assert.match(modal, /fetch\('\/api\/cost-centers'/)
  assert.match(modal, /if \(!canManageFinancials\)/)
  assert.match(modal, /catch\(\(\) =>/)
  assert.match(modal, /\.\.\.financialInput/)

  // Details and optimistic insertion use server-approved financial values.
  assert.match(details, /typeof realizedCost === 'number'/)
  assert.match(details, /typeof billingValue === 'number'/)
  assert.match(appShell, /billingValue: saved\.billingValue/)
  assert.match(appShell, /costCenterId: saved\.costCenterId/)

  console.log('Mission financial contracts: PASS')
}

runTests().catch((error) => {
  console.error(error)
  process.exit(1)
})
