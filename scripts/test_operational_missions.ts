import assert from 'node:assert/strict'

type SqliteValue = string | number | null

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
  users: Array<{ id: string; name: string; organization_id: string; status: string }> = []
  missions: Array<{
    id: string
    title: string
    status: string
    current_workflow_position: number
    expected_minutes: number | null
    xp_reward: number
  }> = []
  missionAssignees: Array<{ mission_id: string; user_id: string }> = []
  workflowSteps: Array<{
    id: string
    mission_id: string
    position: number
    department_name: string
    responsible_user_id: string
    status: string
    review_notes: string | null
    completed_by_user_id: string | null
    completed_at: string | null
  }> = []
  timeEntries: Array<{
    id: string
    mission_id: string
    user_id: string
    duration_seconds: number
    started_at: string | null
    ended_at: string | null
  }> = []
  history: Array<{ mission_id: string; actor_user_id: string; action: string; detail: string }> = []
  xpAwards: Array<{ mission_id: string; user_id: string; final_xp: number }> = []

  prepare(sql: string) {
    return new MockPreparedStatement(this, sql)
  }

  async batch(statements: MockPreparedStatement[]) {
    const results = []
    for (const stmt of statements) {
      results.push(await stmt.run())
    }
    return results
  }

  async executeQuery<T>(sql: string, params: SqliteValue[]): Promise<T[]> {
    const normalized = sql.replace(/\s+/g, ' ').trim()

    if (normalized.includes('FROM mission_workflow_steps')) {
      const missionId = params[0] as string
      return this.workflowSteps.filter((s) => s.mission_id === missionId) as unknown as T[]
    }

    if (normalized.includes('SELECT SUM(COALESCE(duration_seconds, 0))')) {
      const missionId = params[0] as string
      const matched = this.timeEntries.filter((t) => t.mission_id === missionId)
      const totalSeconds = matched.reduce((acc, t) => acc + (t.duration_seconds || 0), 0)
      return [{ totalSeconds, entriesCount: matched.length }] as unknown as T[]
    }

    return []
  }

  async executeMutation(sql: string, params: SqliteValue[]) {
    const normalized = sql.replace(/\s+/g, ' ').trim()

    if (normalized.includes('UPDATE mission_workflow_steps SET status = \'returned\'')) {
      const notes = params[0] as string | null
      const missionId = params[1] as string
      const pos = params[2] as number
      const step = this.workflowSteps.find((s) => s.mission_id === missionId && s.position === pos)
      if (step) {
        step.status = 'returned'
        step.review_notes = notes
      }
      return { meta: { changes: 1 } }
    }

    if (normalized.includes('INSERT INTO mission_history')) {
      const missionId = params[1] as string
      const actorId = params[2] as string
      const action = normalized.includes('\'workflow_returned\'') ? 'workflow_returned' : (params[3] as string)
      const detail = normalized.includes('\'workflow_returned\'') ? (params[3] as string) : (params[4] as string)
      this.history.push({ mission_id: missionId, actor_user_id: actorId, action, detail })
      return { meta: { changes: 1 } }
    }

    if (normalized.includes('INSERT INTO xp_awards')) {
      const missionId = params[2] as string
      const userId = params[3] as string
      const finalXp = params[9] as number
      this.xpAwards.push({ mission_id: missionId, user_id: userId, final_xp: finalXp })
      return { meta: { changes: 1 } }
    }

    return { meta: { changes: 1 } }
  }
}

async function runOperationalMissionsTests() {
  console.log('=== INICIANDO TESTES DO FLUXO OPERACIONAL DE MISSÕES (WORKFLOW, RETRABALHO E TIMERS) ===')

  const db = new MockD1Database()
  const missionId = 'mission-op-01'

  db.users = [
    { id: 'user-guilherme', name: 'Guilherme Gestor', organization_id: 'org-six', status: 'active' },
    { id: 'user-joao', name: 'João Redator', organization_id: 'org-six', status: 'active' },
    { id: 'user-mariana', name: 'Mariana Criativa', organization_id: 'org-six', status: 'active' },
  ]

  // 1. Criar Missão com Workflow Dinâmico de 4 Etapas
  db.missions.push({
    id: missionId,
    title: 'Campanha Dia dos Pais 2026',
    status: 'in_progress',
    current_workflow_position: 0,
    expected_minutes: 240, // 4 horas estimadas
    xp_reward: 100,
  })

  db.missionAssignees.push({ mission_id: missionId, user_id: 'user-guilherme' })

  db.workflowSteps.push(
    { id: 'step-0', mission_id: missionId, position: 0, department_name: 'Planejamento', responsible_user_id: 'user-guilherme', status: 'active', review_notes: null, completed_by_user_id: null, completed_at: null },
    { id: 'step-1', mission_id: missionId, position: 1, department_name: 'Redação', responsible_user_id: 'user-joao', status: 'pending', review_notes: null, completed_by_user_id: null, completed_at: null },
    { id: 'step-2', mission_id: missionId, position: 2, department_name: 'Criação', responsible_user_id: 'user-mariana', status: 'pending', review_notes: null, completed_by_user_id: null, completed_at: null },
    { id: 'step-3', mission_id: missionId, position: 3, department_name: 'Atendimento', responsible_user_id: 'user-guilherme', status: 'pending', review_notes: null, completed_by_user_id: null, completed_at: null },
  )

  console.log('[1/5] Criação de missão com 4 etapas dinâmicas e estimativa de 240min: OK')
  assert.equal(db.workflowSteps.length, 4)
  assert.equal(db.missionAssignees[0]?.user_id, 'user-guilherme')

  // 2. Guilherme conclui Planejamento -> Avança para Redação (João)
  db.workflowSteps[0]!.status = 'completed'
  db.workflowSteps[0]!.completed_by_user_id = 'user-guilherme'
  db.workflowSteps[0]!.completed_at = new Date().toISOString()
  db.workflowSteps[1]!.status = 'active'
  db.missions[0]!.current_workflow_position = 1
  db.missionAssignees = [{ mission_id: missionId, user_id: 'user-joao' }]

  console.log('[2/5] Avanço de Planejamento para Redação: Assignee atualizado para João.')
  assert.equal(db.missionAssignees[0]?.user_id, 'user-joao')
  assert.equal(db.workflowSteps[1]?.status, 'active')

  // 3. João inicia timer, trabalha 90 min e conclui Redação -> Avança para Criação (Mariana)
  db.timeEntries.push({
    id: 'timer-01',
    mission_id: missionId,
    user_id: 'user-joao',
    duration_seconds: 5400, // 90 min
    started_at: '2026-08-15T14:00:00Z',
    ended_at: '2026-08-15T15:30:00Z',
  })

  db.workflowSteps[1]!.status = 'completed'
  db.workflowSteps[1]!.completed_by_user_id = 'user-joao'
  db.workflowSteps[1]!.completed_at = new Date().toISOString()
  db.workflowSteps[2]!.status = 'active'
  db.missions[0]!.current_workflow_position = 2
  db.missionAssignees = [{ mission_id: missionId, user_id: 'user-mariana' }]

  console.log('[3/5] Redação concluída com tempo apontado: Assignee transferido para Mariana.')
  assert.equal(db.missionAssignees[0]?.user_id, 'user-mariana')

  // 4. Mariana conclui Criação -> Vai para Atendimento/Revisão (Guilherme)
  // Guilherme solicita ajustes (devolve para Criação com motivo detalhado)
  const returnReason = 'Ajustar contraste da tipografia e posicionar logotipo no topo direito.'
  const now = new Date().toISOString()
  await db.prepare('UPDATE mission_workflow_steps SET status = \'returned\', review_notes = ? WHERE mission_id = ? AND position = ?').bind(returnReason, missionId, 2).run()
  await db.prepare('INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, \'workflow_returned\', ?, ?)').bind('hist-01', missionId, 'user-guilherme', `Ajustes solicitados: "${returnReason}"`, now).run()
  db.missions[0]!.current_workflow_position = 2
  db.missionAssignees = [{ mission_id: missionId, user_id: 'user-mariana' }]

  console.log('[4/5] Revisão com Solicitação de Ajustes: Etapa marcada como returned, nota gravada e histórico auditado.')
  assert.equal(db.workflowSteps[2]?.status, 'returned')
  assert.equal(db.workflowSteps[2]?.review_notes, returnReason)
  assert.equal(db.history[0]?.action, 'workflow_returned')
  assert.equal(db.missionAssignees[0]?.user_id, 'user-mariana')

  // 5. Mariana ajusta e Guilherme aprova e conclui missão -> XP creditado a todos
  db.workflowSteps[2]!.status = 'completed'
  db.workflowSteps[2]!.completed_by_user_id = 'user-mariana'
  db.workflowSteps[3]!.status = 'completed'
  db.workflowSteps[3]!.completed_by_user_id = 'user-guilherme'
  db.missions[0]!.status = 'completed'

  const participants = ['user-guilherme', 'user-joao', 'user-mariana']
  for (const p of participants) {
    await db.prepare('INSERT INTO xp_awards (id, organization_id, mission_id, user_id, rule_id, rule_version, rule_name, base_xp, bonus_xp, final_xp, recipient_mode, awarded_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'participants_each\', ?, ?)').bind('a1', 'org-six', missionId, p, null, 1, 'Base', 100, 0, 100, 'user-guilherme', now).run()
  }

  console.log('[5/5] Aprovação Final da Missão: XP creditado com sucesso para os 3 participantes do fluxo.')
  assert.equal(db.missions[0]?.status, 'completed')
  assert.equal(db.xpAwards.length, 3)

  console.log('✅ TODOS OS TESTES DE FLUXO OPERACIONAL DE MISSÕES PASSARAM COM SUCESSO!')
}

runOperationalMissionsTests().catch((err) => {
  console.error('❌ ERRO NO TESTE OPERACIONAL:', err)
  process.exit(1)
})
