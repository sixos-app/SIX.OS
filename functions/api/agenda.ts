import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from './_access'

type AgendaScope = 'mine' | 'team'
type EventType = 'meeting' | 'deadline' | 'appointment' | 'vacation' | 'birthday'
type Visibility = 'personal' | 'team'

type CalendarRow = {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  eventType: EventType
  visibility: Visibility
  description: string
  location: string | null
  projectId: string | null
  projectName: string | null
  clientId: string | null
  clientName: string | null
  ownerUserId: string | null
  ownerName: string | null
}

type CreateAgendaInput = {
  title?: unknown
  startsAt?: unknown
  endsAt?: unknown
  eventType?: unknown
  visibility?: unknown
  description?: unknown
  location?: unknown
  projectId?: unknown
  ownerUserId?: unknown
}

const eventTypes = new Set<EventType>(['meeting', 'deadline', 'appointment', 'vacation', 'birthday'])

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function date(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null
  return new Date(value).toISOString()
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const search = new URL(request.url).searchParams
  const scope = search.get('scope') === 'team' ? 'team' : 'mine' as AgendaScope
  const ownerUserId = search.get('ownerUserId')
  const canViewTeam = await hasPermissionV2(env, request, user, 'agenda.team.view')
  if (scope === 'team' && !canViewTeam) return permissionRequiredResponse()

  const filter = scope === 'team'
    ? ownerUserId ? 'calendar_events.owner_user_id = ?' : '1 = 1'
    : 'calendar_events.owner_user_id = ?'
  const statement = env.DB.prepare(`
    SELECT
      calendar_events.id,
      calendar_events.title,
      calendar_events.starts_at AS startsAt,
      calendar_events.ends_at AS endsAt,
      calendar_events.event_type AS eventType,
      calendar_events.visibility,
      calendar_events.description,
      calendar_events.location,
      calendar_events.project_id AS projectId,
      projects.name AS projectName,
      calendar_events.client_id AS clientId,
      clients.name AS clientName,
      calendar_events.owner_user_id AS ownerUserId,
      users.name AS ownerName
    FROM calendar_events
    LEFT JOIN projects ON projects.id = calendar_events.project_id
    LEFT JOIN clients ON clients.id = calendar_events.client_id
    LEFT JOIN users ON users.id = calendar_events.owner_user_id
    WHERE calendar_events.organization_id = ? AND ${filter}
    ORDER BY calendar_events.starts_at ASC
    LIMIT 100
  `)
  const { results } = scope === 'team' && !ownerUserId
    ? await statement.bind(user.organizationId).all<CalendarRow>()
    : await statement.bind(user.organizationId, scope === 'team' ? ownerUserId : user.id).all<CalendarRow>()

  return Response.json({ events: results, permissions: { canViewTeam, canCreateTeam: canViewTeam } })
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const input = await request.json().catch(() => null) as CreateAgendaInput | null
  const title = text(input?.title, 160)
  const startsAt = date(input?.startsAt)
  const endsAt = input?.endsAt === undefined || input?.endsAt === '' ? null : date(input?.endsAt)
  const eventType = typeof input?.eventType === 'string' && eventTypes.has(input.eventType as EventType) ? input.eventType as EventType : 'appointment'
  const requestedVisibility = input?.visibility === 'team' ? 'team' : 'personal'
  const canCreateTeam = await hasPermissionV2(env, request, user, 'agenda.team.view')
  const visibility = requestedVisibility === 'team' && canCreateTeam ? 'team' : 'personal'
  const description = text(input?.description, 2000)
  const location = text(input?.location, 160) || null
  const projectId = typeof input?.projectId === 'string' && input.projectId ? input.projectId : null
  const requestedOwnerId = typeof input?.ownerUserId === 'string' && input.ownerUserId ? input.ownerUserId : user.id
  const ownerUserId = requestedOwnerId !== user.id && canCreateTeam ? requestedOwnerId : user.id

  if (!title || !startsAt || (input?.endsAt && !endsAt) || (endsAt && Date.parse(endsAt) < Date.parse(startsAt))) {
    return Response.json({ error: 'Título, início e período do evento são inválidos' }, { status: 400 })
  }
  if (requestedVisibility === 'team' && visibility !== 'team') return permissionRequiredResponse()
  const owner = await env.DB.prepare('SELECT id, name FROM users WHERE id = ? AND organization_id = ? AND status = \'active\' LIMIT 1').bind(ownerUserId, user.organizationId).first<{ id: string; name: string }>()
  if (!owner) return Response.json({ error: 'Colaborador da agenda não encontrado' }, { status: 404 })

  const project = projectId ? await env.DB.prepare('SELECT id, client_id AS clientId FROM projects WHERE id = ? AND organization_id = ? LIMIT 1').bind(projectId, user.organizationId).first<{ id: string; clientId: string }>() : null
  if (projectId && !project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })

  const id = crypto.randomUUID(), now = new Date().toISOString()
  await env.DB.prepare(`
    INSERT INTO calendar_events (
      id, organization_id, project_id, client_id, owner_user_id, title, starts_at, ends_at,
      event_type, description, location, visibility, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.organizationId, project?.id ?? null, project?.clientId ?? null, owner.id, title, startsAt, endsAt, eventType, description, location, visibility, now, now).run()

  return Response.json({ event: { id, title, startsAt, endsAt, eventType, visibility, description, location, projectId: project?.id ?? null, clientId: project?.clientId ?? null, ownerUserId: owner.id, ownerName: owner.name } }, { status: 201 })
}
