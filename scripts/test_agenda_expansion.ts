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
  events: Array<{
    id: string
    organization_id: string
    owner_user_id: string
    title: string
    starts_at: string
    ends_at: string | null
    event_type: string
    visibility: string
    description: string
    location: string | null
    project_id: string | null
    created_at: string
    updated_at: string
  }> = []

  users: Array<{ id: string; name: string; organization_id: string; status: string }> = []
  projects: Array<{ id: string; name: string; client_id: string; organization_id: string }> = []
  clients: Array<{ id: string; name: string; organization_id: string }> = []

  prepare(sql: string) {
    return new MockPreparedStatement(this, sql)
  }

  async executeQuery<T>(sql: string, params: SqliteValue[]): Promise<T[]> {
    const normalized = sql.replace(/\s+/g, ' ').trim()

    if (normalized.includes('FROM calendar_events')) {
      const orgId = params[0] as string
      let matched = this.events.filter((e) => e.organization_id === orgId)

      if (params.length > 1 && params[1]) {
        const ownerId = params[1] as string
        matched = matched.filter((e) => e.owner_user_id === ownerId)
      }

      return matched.map((e) => {
        const owner = this.users.find((u) => u.id === e.owner_user_id)
        const project = e.project_id ? this.projects.find((p) => p.id === e.project_id) : null
        const client = project ? this.clients.find((c) => c.id === project.client_id) : null

        return {
          id: e.id,
          title: e.title,
          startsAt: e.starts_at,
          endsAt: e.ends_at,
          eventType: e.event_type,
          visibility: e.visibility,
          description: e.description,
          location: e.location,
          projectId: e.project_id,
          projectName: project?.name ?? null,
          clientId: client?.id ?? null,
          clientName: client?.name ?? null,
          ownerUserId: e.owner_user_id,
          ownerName: owner?.name ?? null,
        }
      }) as unknown as T[]
    }

    if (normalized.includes('SELECT id, name FROM users WHERE id = ?')) {
      const id = params[0] as string
      const user = this.users.find((u) => u.id === id)
      return (user ? [{ id: user.id, name: user.name }] : []) as unknown as T[]
    }

    if (normalized.includes('SELECT id, client_id AS clientId FROM projects WHERE id = ?')) {
      const id = params[0] as string
      const project = this.projects.find((p) => p.id === id)
      return (project ? [{ id: project.id, clientId: project.client_id }] : []) as unknown as T[]
    }

    return []
  }

  async executeMutation(sql: string, params: SqliteValue[]) {
    const normalized = sql.replace(/\s+/g, ' ').trim()

    if (normalized.includes('INSERT INTO calendar_events')) {
      const id = params[0] as string
      const orgId = params[1] as string
      const projectId = params[2] as string | null
      const ownerId = params[4] as string
      const title = params[5] as string
      const startsAt = params[6] as string
      const endsAt = params[7] as string | null
      const eventType = params[8] as string
      const description = params[9] as string
      const location = params[10] as string | null
      const visibility = params[11] as string
      const now = params[12] as string

      this.events.push({
        id,
        organization_id: orgId,
        project_id: projectId,
        owner_user_id: ownerId,
        title,
        starts_at: startsAt,
        ends_at: endsAt,
        event_type: eventType,
        description,
        location,
        visibility,
        created_at: now,
        updated_at: now,
      })

      return { meta: { changes: 1 } }
    }

    if (normalized.includes('DELETE FROM calendar_events WHERE id = ?')) {
      const id = params[0] as string
      this.events = this.events.filter((e) => e.id !== id)
      return { meta: { changes: 1 } }
    }

    return { meta: { changes: 0 } }
  }
}

async function runAgendaExpansionTests() {
  console.log('=== INICIANDO TESTES DA AGENDA EXPANDIDA (TIPOS, ESCOPO E ANIVERSÁRIOS) ===')

  const db = new MockD1Database()
  const orgId = 'org-six-test'

  db.users = [
    { id: 'user-01', name: 'Lucas Mendes', organization_id: orgId, status: 'active' },
    { id: 'user-02', name: 'Mariana Lima', organization_id: orgId, status: 'active' },
  ]
  db.clients = [{ id: 'client-01', name: 'Cliente Prime', organization_id: orgId }]
  db.projects = [{ id: 'proj-01', name: 'Campanha Q3', client_id: 'client-01', organization_id: orgId }]

  // 1. Criar eventos de diferentes tipos (Reunião, Prazo, Férias, Aniversário)
  const eventTypes = ['meeting', 'deadline', 'appointment', 'vacation', 'birthday'] as const

  for (const type of eventTypes) {
    const id = `event-${type}`
    await db.prepare(`
      INSERT INTO calendar_events (
        id, organization_id, project_id, client_id, owner_user_id, title, starts_at, ends_at,
        event_type, description, location, visibility, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId, 'proj-01', 'client-01', 'user-01',
      `Evento ${type}`, '2026-08-20T10:00:00.000Z', '2026-08-20T11:00:00.000Z',
      type, `Descrição do evento ${type}`, 'Sala 1', 'team',
      new Date().toISOString(), new Date().toISOString()
    ).run()
  }

  console.log('[1/4] Criação de eventos de todos os tipos (incluindo birthday): OK')
  assert.equal(db.events.length, 5)

  // 2. Consulta de eventos em escopo individual (mine)
  const myEvents = await db.prepare('SELECT * FROM calendar_events WHERE organization_id = ? AND owner_user_id = ?').bind(orgId, 'user-01').all()
  console.log('[2/4] Consulta em escopo individual (mine): OK')
  assert.equal(myEvents.results.length, 5)

  // 3. Consulta de eventos em escopo da equipe (team)
  await db.prepare(`
    INSERT INTO calendar_events (
      id, organization_id, project_id, client_id, owner_user_id, title, starts_at, ends_at,
      event_type, description, location, visibility, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    'event-user-02', orgId, null, null, 'user-02',
    'Aniversário Mariana', '2026-09-10T00:00:00.000Z', null,
    'birthday', 'Comemoração com a equipe', null, 'team',
    new Date().toISOString(), new Date().toISOString()
  ).run()

  const allTeamEvents = await db.prepare('SELECT * FROM calendar_events WHERE organization_id = ?').bind(orgId).all()
  console.log('[3/4] Consulta em escopo de equipe (team com múltiplos usuários): OK')
  assert.equal(allTeamEvents.results.length, 6)

  // 4. Exclusão de evento
  await db.prepare('DELETE FROM calendar_events WHERE id = ?').bind('event-birthday').run()
  assert.equal(db.events.length, 5)
  console.log('[4/4] Exclusão e limpeza de evento: OK')

  console.log('✅ TODOS OS TESTES DA AGENDA EXPANDIDA PASSARAM COM SUCESSO!')
}

runAgendaExpansionTests().catch((err) => {
  console.error('❌ ERRO NO TESTE DA AGENDA:', err)
  process.exit(1)
})
