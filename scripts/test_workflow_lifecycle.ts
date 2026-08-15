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
  users: Array<{ id: string; name: string; organization_id: string; department_id: string | null }> = []
  missions: Array<{
    id: string
    project_id: string
    title: string
    status: string
    approval_status: string
    current_workflow_position: number
    xp_reward: number
    ideas_reward: number
    due_at: string | null
    xp_rule_id: string | null
    xp_recipient_user_id: string | null
    started_at: string | null
    completed_at: string | null
    approved_at: string | null
    approved_by_user_id: string | null
    updated_at: string
  }> = []
  missionAssignees: Array<{ mission_id: string; user_id: string }> = []
  missionWorkflowSteps: Array<{
    id: string
    mission_id: string
    department_name: string
    position: number
    status: string
    responsible_user_id: string | null
    completed_by_user_id: string | null
    completed_at: string | null
  }> = []
  timeEntries: Array<{
    id: string
    organization_id: string
    mission_id: string
    client_id: string
    user_id: string
    hours: number
    minutes: number
    started_at: string | null
    ended_at: string | null
    duration_seconds: number
    entry_type: string
  }> = []
  gamificationProfiles: Array<{
    user_id: string
    xp: number
    ideas: number
    level: string
    streak_days: number
    updated_at: string
  }> = []
  xpAwards: Array<{
    id: string
    organization_id: string
    mission_id: string
    user_id: string
    base_xp: number
    bonus_xp: number
    final_xp: number
  }> = []
  missionHistory: Array<{
    id: string
    mission_id: string
    actor_user_id: string
    action: string
    detail: string
    created_at: string
  }> = []

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

    if (normalized.includes('FROM missions JOIN projects')) {
      const missionId = params[0] as string
      const mission = this.missions.find((m) => m.id === missionId)
      if (!mission) return []

      const currentStep = this.missionWorkflowSteps.find((s) => s.mission_id === mission.id && s.position === mission.current_workflow_position)
      const nextStep = this.missionWorkflowSteps.find((s) => s.mission_id === mission.id && s.position === mission.current_workflow_position + 1)
      const currentResponsible = currentStep?.responsible_user_id ? this.users.find((u) => u.id === currentStep.responsible_user_id) : null
      const nextResponsible = nextStep?.responsible_user_id ? this.users.find((u) => u.id === nextStep.responsible_user_id) : null
      const assignee = this.missionAssignees.find((a) => a.mission_id === mission.id)

      return [{
        id: mission.id,
        title: mission.title,
        xpReward: mission.xp_reward,
        ideasReward: mission.ideas_reward,
        status: mission.status,
        dueAt: mission.due_at,
        xpRuleId: mission.xp_rule_id,
        assigneeId: assignee?.user_id ?? null,
        xpRecipientId: mission.xp_recipient_user_id ?? assignee?.user_id ?? null,
        currentPosition: mission.current_workflow_position,
        currentDepartment: currentStep?.department_name ?? null,
        nextDepartment: nextStep?.department_name ?? null,
        currentResponsibleId: currentStep?.responsible_user_id ?? null,
        currentResponsibleName: currentResponsible?.name ?? null,
        nextResponsibleId: nextStep?.responsible_user_id ?? null,
        nextResponsibleName: nextResponsible?.name ?? null,
      } as unknown as T]
    }

    if (normalized.includes('FROM mission_workflow_steps steps JOIN users')) {
      const missionId = params[0] as string
      const completedSteps = this.missionWorkflowSteps.filter((s) => s.mission_id === missionId && s.status === 'completed' && s.completed_by_user_id)
      const userMap = new Map<string, { id: string; name: string; completedAt: string | null }>()
      for (const step of completedSteps) {
        const user = this.users.find((u) => u.id === step.completed_by_user_id)
        if (user) {
          userMap.set(user.id, { id: user.id, name: user.name, completedAt: step.completed_at })
        }
      }
      return Array.from(userMap.values()) as unknown as T[]
    }

    if (normalized.includes('SELECT users.id, users.name FROM users WHERE users.id = ?')) {
      const userId = params[0] as string
      const user = this.users.find((u) => u.id === userId)
      return (user ? [{ id: user.id, name: user.name }] : []) as unknown as T[]
    }

    if (normalized.includes('SELECT department_name AS name FROM mission_workflow_steps')) {
      const missionId = params[0] as string
      const position = params[1] as number
      const step = this.missionWorkflowSteps.find((s) => s.mission_id === missionId && s.position === position)
      return (step ? [{ name: step.department_name }] : []) as unknown as T[]
    }

    return []
  }

  async executeMutation(sql: string, params: SqliteValue[]) {
    const normalized = sql.replace(/\s+/g, ' ').trim()

    if (normalized.includes('UPDATE mission_workflow_steps SET status = \'completed\'')) {
      const completedById = params[0] as string
      const completedAt = params[1] as string
      const missionId = params[2] as string
      const position = params[3] as number
      const step = this.missionWorkflowSteps.find((s) => s.mission_id === missionId && s.position === position)
      if (step) {
        step.status = 'completed'
        step.completed_by_user_id = completedById
        step.completed_at = completedAt
      }
      return { meta: { changes: 1 } }
    }

    if (normalized.includes('UPDATE mission_workflow_steps SET status = \'active\'')) {
      const missionId = params[0] as string
      const position = params[1] as number
      const step = this.missionWorkflowSteps.find((s) => s.mission_id === missionId && s.position === position)
      if (step) {
        step.status = 'active'
      }
      return { meta: { changes: 1 } }
    }

    if (normalized.includes('UPDATE missions SET status = \'in_progress\'')) {
      const now = params[0] as string
      const missionId = params[1] as string
      const mission = this.missions.find((m) => m.id === missionId)
      if (mission) {
        mission.status = 'in_progress'
        mission.current_workflow_position += 1
        mission.updated_at = now
      }
      return { meta: { changes: 1 } }
    }

    if (normalized.includes('DELETE FROM mission_assignees WHERE mission_id = ?')) {
      const missionId = params[0] as string
      this.missionAssignees = this.missionAssignees.filter((a) => a.mission_id !== missionId)
      return { meta: { changes: 1 } }
    }

    if (normalized.includes('INSERT OR IGNORE INTO mission_assignees (mission_id, user_id)')) {
      const missionId = params[0] as string
      const userId = params[1] as string
      this.missionAssignees.push({ mission_id: missionId, user_id: userId })
      return { meta: { changes: 1 } }
    }

    if (normalized.includes('UPDATE time_entries SET ended_at = ?')) {
      const endedAt = params[0] as string
      const missionId = params[5] as string
      for (const entry of this.timeEntries) {
        if (entry.mission_id === missionId && !entry.ended_at) {
          entry.ended_at = endedAt
          entry.duration_seconds = 1800
          entry.minutes = 30
        }
      }
      return { meta: { changes: 1 } }
    }

    if (normalized.includes('UPDATE missions SET status = \'completed\'')) {
      const now = params[0] as string
      const approvedBy = params[2] as string
      const missionId = params[4] as string
      const mission = this.missions.find((m) => m.id === missionId)
      if (mission) {
        mission.status = 'completed'
        mission.approval_status = 'approved'
        mission.completed_at = now
        mission.approved_at = now
        mission.approved_by_user_id = approvedBy
      }
      return { meta: { changes: 1 } }
    }

    if (normalized.includes('INSERT OR IGNORE INTO gamification_profiles')) {
      const userId = params[0] as string
      const now = params[1] as string
      if (!this.gamificationProfiles.some((p) => p.user_id === userId)) {
        this.gamificationProfiles.push({ user_id: userId, xp: 0, ideas: 0, level: 'Criador', streak_days: 0, updated_at: now })
      }
      return { meta: { changes: 1 } }
    }

    if (normalized.includes('UPDATE gamification_profiles SET xp = xp + ?')) {
      const xp = params[0] as number
      const ideas = params[1] as number
      const now = params[2] as string
      const userId = params[3] as string
      const profile = this.gamificationProfiles.find((p) => p.user_id === userId)
      if (profile) {
        profile.xp += xp
        profile.ideas += ideas
        profile.updated_at = now
      }
      return { meta: { changes: 1 } }
    }

    if (normalized.includes('INSERT INTO xp_awards')) {
      const id = params[0] as string
      const orgId = params[1] as string
      const missionId = params[2] as string
      const userId = params[3] as string
      const baseXp = params[7] as number
      const bonusXp = params[8] as number
      const finalXp = params[9] as number
      this.xpAwards.push({ id, organization_id: orgId, mission_id: missionId, user_id: userId, base_xp: baseXp, bonus_xp: bonusXp, final_xp: finalXp })
      return { meta: { changes: 1 } }
    }

    return { meta: { changes: 0 } }
  }
}

async function runWorkflowLifecycleTests() {
  console.log('=== INICIANDO TESTES DO CICLO DE WORKFLOW SETORIAL & TIMERS ===')

  const db = new MockD1Database()
  const orgId = 'org-six-test'

  // Configuração dos usuários do teste
  db.users = [
    { id: 'user-redator', name: 'Ana Redatora', organization_id: orgId, department_id: 'dept-redacao' },
    { id: 'user-criador', name: 'Carlos Designer', organization_id: orgId, department_id: 'dept-criacao' },
    { id: 'user-atendimento', name: 'Beatriz Atendimento', organization_id: orgId, department_id: 'dept-atendimento' },
  ]

  // 1. Criação de missão multi-setor
  const missionId = 'mission-workflow-01'
  db.missions = [{
    id: missionId,
    project_id: 'project-01',
    title: 'Campanha de Lançamento Q3',
    status: 'open',
    approval_status: 'not_requested',
    current_workflow_position: 0,
    xp_reward: 100,
    ideas_reward: 25,
    due_at: '2026-12-31T18:00:00.000Z',
    xp_rule_id: null,
    xp_recipient_user_id: null,
    started_at: null,
    completed_at: null,
    approved_at: null,
    approved_by_user_id: null,
    updated_at: new Date().toISOString(),
  }]

  db.missionAssignees = [
    { mission_id: missionId, user_id: 'user-redator' },
  ]

  db.missionWorkflowSteps = [
    { id: 'step-0', mission_id: missionId, department_name: 'Redação', position: 0, status: 'active', responsible_user_id: 'user-redator', completed_by_user_id: null, completed_at: null },
    { id: 'step-1', mission_id: missionId, department_name: 'Criação', position: 1, status: 'pending', responsible_user_id: 'user-criador', completed_by_user_id: null, completed_at: null },
    { id: 'step-2', mission_id: missionId, department_name: 'Atendimento', position: 2, status: 'pending', responsible_user_id: 'user-atendimento', completed_by_user_id: null, completed_at: null },
  ]

  // Início de timer do redator
  db.timeEntries = [{
    id: 'timer-01',
    organization_id: orgId,
    mission_id: missionId,
    client_id: 'client-01',
    user_id: 'user-redator',
    hours: 0,
    minutes: 0,
    started_at: '2026-08-15T14:00:00.000Z',
    ended_at: null,
    duration_seconds: 0,
    entry_type: 'timer',
  }]

  console.log('[1/4] Estado Inicial: Redação ativa, assignee Ana Redatora, timer rodando.')
  assert.equal(db.missionAssignees[0]?.user_id, 'user-redator')
  assert.equal(db.timeEntries[0]?.ended_at, null)

  // 2. Redator conclui etapa 0 -> Avança para Criação
  const now = new Date().toISOString()
  await db.batch([
    db.prepare('UPDATE mission_workflow_steps SET status = \'completed\' WHERE mission_id = ? AND position = ?').bind('user-redator', now, missionId, 0),
    db.prepare('UPDATE mission_workflow_steps SET status = \'active\' WHERE mission_id = ? AND position = ?').bind(missionId, 1),
    db.prepare('UPDATE missions SET status = \'in_progress\' WHERE updated_at = ? AND id = ?').bind(now, missionId),
    db.prepare('UPDATE time_entries SET ended_at = ? WHERE id = ?').bind(now, now, now, now, now, missionId, orgId),
    db.prepare('DELETE FROM mission_assignees WHERE mission_id = ?').bind(missionId),
    db.prepare('INSERT OR IGNORE INTO mission_assignees (mission_id, user_id) VALUES (?, ?)').bind(missionId, 'user-criador'),
  ])

  console.log('[2/4] Avanço de Etapa: Timer pausado, assignee transferido para Carlos Designer.')
  assert.equal(db.missionWorkflowSteps[0]?.status, 'completed')
  assert.equal(db.missionWorkflowSteps[1]?.status, 'active')
  assert.equal(db.missionAssignees[0]?.user_id, 'user-criador')
  assert.ok(db.timeEntries[0]?.ended_at !== null)

  // 3. Criador conclui etapa 1 -> Avança para Atendimento
  await db.batch([
    db.prepare('UPDATE mission_workflow_steps SET status = \'completed\' WHERE mission_id = ? AND position = ?').bind('user-criador', now, missionId, 1),
    db.prepare('UPDATE mission_workflow_steps SET status = \'active\' WHERE mission_id = ? AND position = ?').bind(missionId, 2),
    db.prepare('UPDATE missions SET status = \'in_progress\' WHERE updated_at = ? AND id = ?').bind(now, missionId),
    db.prepare('DELETE FROM mission_assignees WHERE mission_id = ?').bind(missionId),
    db.prepare('INSERT OR IGNORE INTO mission_assignees (mission_id, user_id) VALUES (?, ?)').bind(missionId, 'user-atendimento'),
  ])

  console.log('[3/4] Avanço para Aprovação: Atendimento ativo, assignee Beatriz Atendimento.')
  assert.equal(db.missionWorkflowSteps[1]?.status, 'completed')
  assert.equal(db.missionWorkflowSteps[2]?.status, 'active')
  assert.equal(db.missionAssignees[0]?.user_id, 'user-atendimento')

  // 4. Atendimento aprova e conclui missão -> XP creditado a Ana e Carlos
  const participants = [
    { id: 'user-redator', name: 'Ana Redatora' },
    { id: 'user-criador', name: 'Carlos Designer' },
  ]

  const completionStatements = [
    db.prepare('UPDATE missions SET status = \'completed\'').bind(now, now, 'user-atendimento', now, missionId),
  ]

  for (const p of participants) {
    completionStatements.push(
      db.prepare('INSERT OR IGNORE INTO gamification_profiles').bind(p.id, now),
      db.prepare('UPDATE gamification_profiles SET xp = xp + ?').bind(100, 25, now, p.id),
      db.prepare('INSERT INTO xp_awards').bind(`award-${p.id}`, orgId, missionId, p.id, null, 1, 'Base', 100, 0, 100, 'user-atendimento', now),
    )
  }

  await db.batch(completionStatements)

  console.log('[4/4] Missão Concluída: XP distribuído com sucesso para todos os participantes.')
  assert.equal(db.missions[0]?.status, 'completed')
  assert.equal(db.xpAwards.length, 2)
  assert.equal(db.gamificationProfiles.find((p) => p.user_id === 'user-redator')?.xp, 100)
  assert.equal(db.gamificationProfiles.find((p) => p.user_id === 'user-criador')?.xp, 100)

  console.log('✅ TODOS OS TESTES DE CICLO DE WORKFLOW E TIMERS PASSARAM COM SUCESSO!')
}

runWorkflowLifecycleTests().catch((err) => {
  console.error('❌ ERRO NO TESTE:', err)
  process.exit(1)
})
