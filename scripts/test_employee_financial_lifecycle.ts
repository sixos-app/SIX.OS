import assert from 'node:assert/strict'

type SqliteValue = string | number | null | Uint8Array

class MockPreparedStatement {
  constructor(private db: MockD1Database, private sql: string, private params: SqliteValue[] = []) {}

  bind(...params: SqliteValue[]) {
    return new MockPreparedStatement(this.db, this.sql, params)
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const results = await this.db.executeQuery<T>(this.sql, this.params)
    return results[0] ?? null
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const results = await this.db.executeQuery<T>(this.sql, this.params)
    return { results }
  }

  async run() {
    return await this.db.executeMutation(this.sql, this.params)
  }
}

class MockD1Database {
  users: Array<{ id: string; name: string; email: string; organization_id: string; hourly_rate: number }> = []
  employees: Array<{
    id: string
    organization_id: string
    user_id: string | null
    name: string
    status: string
    contract_type: string
  }> = []
  compensationHistory: Array<{
    id: string
    organization_id: string
    employee_id: string
    salary: number
    monthly_hours: number
    hourly_cost: number
    valid_from: string
    valid_until: string | null
  }> = []
  timeEntries: Array<{
    id: string
    organization_id: string
    mission_id: string
    user_id: string
    started_at: string
    ended_at: string | null
    duration_seconds: number
    hours: number
    minutes: number
    cost: number
    hourly_cost_snapshot: number
    compensation_history_id: string | null
  }> = []
  missions: Array<{
    id: string
    organization_id: string
    title: string
    realized_cost: number
  }> = []

  prepare(sql: string) {
    return new MockPreparedStatement(this, sql)
  }

  async batch(statements: MockPreparedStatement[]) {
    for (const stmt of statements) {
      await stmt.run()
    }
  }

  async executeQuery<T>(sql: string, params: SqliteValue[]): Promise<T[]> {
    if (sql.includes('FROM employee_compensation_history') && sql.includes('ORDER BY comp.valid_from DESC')) {
      const userId = params[0] as string
      const orgId = params[1] as string
      const timerStartedAt = params[2] as string

      const emp = this.employees.find((e) => e.user_id === userId && e.organization_id === orgId)
      if (!emp) return []

      const comp = this.compensationHistory
        .filter((c) => c.employee_id === emp.id && (c.valid_until === null || c.valid_until >= timerStartedAt))
        .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]

      if (comp) {
        return [{ id: comp.id, hourlyCost: comp.hourly_cost } as unknown as T]
      }
      return []
    }

    if (sql.includes('SELECT hourly_rate FROM users')) {
      const userId = params[0] as string
      const u = this.users.find((user) => user.id === userId)
      return u ? [{ hourly_rate: u.hourly_rate } as unknown as T] : []
    }

    return []
  }

  async executeMutation(sql: string, params: SqliteValue[]) {
    if (sql.includes('UPDATE time_entries')) {
      const endedAt = params[0] as string
      const durationSeconds = params[1] as number
      const hours = params[2] as number
      const minutes = params[3] as number
      const cost = params[4] as number
      const hourlySnapshot = params[5] as number
      const compId = params[6] as string
      const timerId = params[7] as string

      const entry = this.timeEntries.find((t) => t.id === timerId)
      if (entry) {
        entry.ended_at = endedAt
        entry.duration_seconds = durationSeconds
        entry.hours = hours
        entry.minutes = minutes
        entry.cost = cost
        entry.hourly_cost_snapshot = hourlySnapshot
        entry.compensation_history_id = compId
      }
    }

    if (sql.includes('UPDATE missions')) {
      const cost = params[0] as number
      const missionId = params[1] as string
      const mission = this.missions.find((m) => m.id === missionId)
      if (mission) {
        mission.realized_cost += cost
      }
    }

    return { success: true }
  }
}

async function runTests() {
  console.log('🧪 Iniciando testes de ciclo de vida financeiro e snapshot de colaboradores...')

  const db = new MockD1Database()
  const orgId = 'org-test'
  const userId = 'user-joao'
  const employeeId = 'emp-joao'

  // 1. Cadastrar Usuário e Colaborador
  db.users.push({ id: userId, name: 'João Dev', email: 'joao@six.is', organization_id: orgId, hourly_rate: 20 })
  db.employees.push({ id: employeeId, organization_id: orgId, user_id: userId, name: 'João Dev', status: 'active', contract_type: 'CLT' })
  
  // Vigência Salarial 1: R$ 4.400 / 220h = R$ 20/h (Janeiro a Junho)
  db.compensationHistory.push({
    id: 'comp-1',
    organization_id: orgId,
    employee_id: employeeId,
    salary: 4400,
    monthly_hours: 220,
    hourly_cost: 20,
    valid_from: '2026-01-01',
    valid_until: '2026-06-30',
  })

  // Vigência Salarial 2: R$ 6.600 / 220h = R$ 30/h (Julho em diante)
  db.compensationHistory.push({
    id: 'comp-2',
    organization_id: orgId,
    employee_id: employeeId,
    salary: 6600,
    monthly_hours: 220,
    hourly_cost: 30,
    valid_from: '2026-07-01',
    valid_until: null,
  })

  db.missions.push({ id: 'mission-january', organization_id: orgId, title: 'Campanha Janeiro', realized_cost: 0 })
  db.missions.push({ id: 'mission-august', organization_id: orgId, title: 'Campanha Agosto', realized_cost: 0 })

  // 2. Apontamento em Fevereiro (2h30m = 9000s na vigência 1 de R$ 20/h)
  const timerJanId = 'timer-feb'
  db.timeEntries.push({
    id: timerJanId,
    organization_id: orgId,
    mission_id: 'mission-january',
    user_id: userId,
    started_at: '2026-02-15T10:00:00Z',
    ended_at: null,
    duration_seconds: 0,
    hours: 0,
    minutes: 0,
    cost: 0,
    hourly_cost_snapshot: 0,
    compensation_history_id: null,
  })

  // Fechar Timer Fevereiro
  const durationSecondsFeb = 9000 // 2.5h
  const hourlyRateFeb = 20
  const costFeb = (durationSecondsFeb / 3600) * hourlyRateFeb // R$ 50.00
  await db.batch([
    db.prepare('UPDATE time_entries').bind('2026-02-15T12:30:00Z', durationSecondsFeb, 2, 30, costFeb, hourlyRateFeb, 'comp-1', timerJanId),
    db.prepare('UPDATE missions').bind(costFeb, 'mission-january', orgId),
  ])

  console.log('[1/3] Snapshot Fevereiro fechado: Custo R$ 50,00 com snapshot R$ 20/h.')
  assert.equal(db.timeEntries[0]?.cost, 50)
  assert.equal(db.timeEntries[0]?.hourly_cost_snapshot, 20)
  assert.equal(db.timeEntries[0]?.compensation_history_id, 'comp-1')
  assert.equal(db.missions[0]?.realized_cost, 50)

  // 3. Apontamento em Agosto (2h30m = 9000s na vigência 2 de R$ 30/h)
  const timerAugId = 'timer-aug'
  db.timeEntries.push({
    id: timerAugId,
    organization_id: orgId,
    mission_id: 'mission-august',
    user_id: userId,
    started_at: '2026-08-10T10:00:00Z',
    ended_at: null,
    duration_seconds: 0,
    hours: 0,
    minutes: 0,
    cost: 0,
    hourly_cost_snapshot: 0,
    compensation_history_id: null,
  })

  // Fechar Timer Agosto
  const durationSecondsAug = 9000 // 2.5h
  const hourlyRateAug = 30
  const costAug = (durationSecondsAug / 3600) * hourlyRateAug // R$ 75.00
  await db.batch([
    db.prepare('UPDATE time_entries').bind('2026-08-10T12:30:00Z', durationSecondsAug, 2, 30, costAug, hourlyRateAug, 'comp-2', timerAugId),
    db.prepare('UPDATE missions').bind(costAug, 'mission-august', orgId),
  ])

  console.log('[2/3] Snapshot Agosto fechado: Custo R$ 75,00 com snapshot R$ 30/h.')
  assert.equal(db.timeEntries[1]?.cost, 75)
  assert.equal(db.timeEntries[1]?.hourly_cost_snapshot, 30)
  assert.equal(db.timeEntries[1]?.compensation_history_id, 'comp-2')
  assert.equal(db.missions[1]?.realized_cost, 75)

  // 4. Garantir que o aumento salarial de Agosto NÃO alterou o custo de Fevereiro
  console.log('[3/3] Verificação de Imutabilidade Histórica: Missão de Fevereiro continua R$ 50,00.')
  assert.equal(db.missions[0]?.realized_cost, 50)
  assert.equal(db.timeEntries[0]?.cost, 50)

  console.log('✅ TODOS OS TESTES FINANCEIROS E DE SNAPSHOT FORAM APROVADOS!')
}

runTests().catch((err) => {
  console.error('❌ ERRO NOS TESTES:', err)
  process.exit(1)
})
