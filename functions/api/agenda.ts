import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from './_access'
import { notifyMentionedUsers } from './_notifications'

type AgendaScope = 'mine' | 'team'
type EventType = 'meeting' | 'deadline' | 'appointment' | 'capture' | 'vacation' | 'birthday'
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
  missionId: string | null
  missionTitle: string | null
  participantUserIds: string | null
  participantNames: string | null
  attachmentName: string | null
  attachmentSize: number | null
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
  missionId?: unknown
  participantUserIds?: unknown
}

const eventTypes = new Set<EventType>(['meeting', 'deadline', 'appointment', 'capture', 'vacation', 'birthday'])

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function date(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null
  return new Date(value).toISOString()
}

function participantIds(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && Boolean(item)).slice(0, 50))]
    : []
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
    : '(calendar_events.owner_user_id = ? OR EXISTS (SELECT 1 FROM calendar_event_participants mine WHERE mine.event_id = calendar_events.id AND mine.user_id = ?))'
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
      users.name AS ownerName,
      calendar_events.mission_id AS missionId,
      missions.title AS missionTitle,
      calendar_events.attachment_name AS attachmentName,
      calendar_events.attachment_size AS attachmentSize,
      (SELECT GROUP_CONCAT(participants.user_id, '||') FROM calendar_event_participants participants WHERE participants.event_id = calendar_events.id) AS participantUserIds,
      (SELECT GROUP_CONCAT(participant_users.name, '||') FROM calendar_event_participants participants JOIN users participant_users ON participant_users.id = participants.user_id WHERE participants.event_id = calendar_events.id) AS participantNames
    FROM calendar_events
    LEFT JOIN projects ON projects.id = calendar_events.project_id
    LEFT JOIN clients ON clients.id = calendar_events.client_id
    LEFT JOIN users ON users.id = calendar_events.owner_user_id
    LEFT JOIN missions ON missions.id = calendar_events.mission_id
    WHERE calendar_events.organization_id = ? AND ${filter}
    ORDER BY calendar_events.starts_at ASC
    LIMIT 100
  `)
  const { results } = scope === 'team' && !ownerUserId
    ? await statement.bind(user.organizationId).all<CalendarRow>()
    : scope === 'team'
      ? await statement.bind(user.organizationId, ownerUserId).all<CalendarRow>()
      : await statement.bind(user.organizationId, user.id, user.id).all<CalendarRow>()

  return Response.json({
    events: results.map((event) => ({
      ...event,
      participantUserIds: event.participantUserIds ? event.participantUserIds.split('||') : [],
      participantNames: event.participantNames ? event.participantNames.split('||') : [],
    })),
    permissions: { canViewTeam, canCreateTeam: canViewTeam },
  })
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
  const missionId = typeof input?.missionId === 'string' && input.missionId ? input.missionId : null
  const requestedOwnerId = typeof input?.ownerUserId === 'string' && input.ownerUserId ? input.ownerUserId : user.id
  const ownerUserId = requestedOwnerId !== user.id && canCreateTeam ? requestedOwnerId : user.id
  const selectedParticipants = participantIds(input?.participantUserIds)

  if (!title || !startsAt || (input?.endsAt && !endsAt) || (endsAt && Date.parse(endsAt) < Date.parse(startsAt))) {
    return Response.json({ error: 'Título, início e período do evento são inválidos' }, { status: 400 })
  }
  if (requestedVisibility === 'team' && visibility !== 'team') return permissionRequiredResponse()
  if ((selectedParticipants.some((id) => id !== user.id) || requestedOwnerId !== user.id) && !canCreateTeam) return permissionRequiredResponse()

  const owner = await env.DB.prepare('SELECT id, name FROM users WHERE id = ? AND organization_id = ? AND status = \'active\' LIMIT 1').bind(ownerUserId, user.organizationId).first<{ id: string; name: string }>()
  if (!owner) return Response.json({ error: 'Colaborador da agenda não encontrado' }, { status: 404 })

  const mission = missionId ? await env.DB.prepare('SELECT missions.id, missions.project_id AS projectId, projects.client_id AS clientId FROM missions JOIN projects ON projects.id = missions.project_id WHERE missions.id = ? AND projects.organization_id = ? LIMIT 1').bind(missionId, user.organizationId).first<{ id: string; projectId: string; clientId: string }>() : null
  if (missionId && !mission) return Response.json({ error: 'Missão vinculada não encontrada' }, { status: 404 })
  if (mission && projectId && mission.projectId !== projectId) return Response.json({ error: 'A missão não pertence ao projeto selecionado' }, { status: 400 })
  const effectiveProjectId = projectId ?? mission?.projectId ?? null
  const project = effectiveProjectId ? await env.DB.prepare('SELECT id, client_id AS clientId FROM projects WHERE id = ? AND organization_id = ? LIMIT 1').bind(effectiveProjectId, user.organizationId).first<{ id: string; clientId: string }>() : null
  if (effectiveProjectId && !project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })

  if (selectedParticipants.length) {
    const placeholders = selectedParticipants.map(() => '?').join(',')
    const participants = await env.DB.prepare(`SELECT id FROM users WHERE organization_id = ? AND status = 'active' AND id IN (${placeholders})`).bind(user.organizationId, ...selectedParticipants).all<{ id: string }>()
    if (participants.results.length !== selectedParticipants.length) return Response.json({ error: 'Um ou mais participantes não estão disponíveis' }, { status: 400 })
  }

  const id = crypto.randomUUID(), now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO calendar_events (
        id, organization_id, project_id, client_id, owner_user_id, mission_id, title, starts_at, ends_at,
        event_type, description, location, visibility, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, user.organizationId, project?.id ?? null, project?.clientId ?? mission?.clientId ?? null, owner.id, mission?.id ?? null, title, startsAt, endsAt, eventType, description, location, visibility, now, now),
    ...selectedParticipants.filter((participantId) => participantId !== owner.id).map((participantId) => env.DB.prepare('INSERT INTO calendar_event_participants (event_id, user_id, organization_id, created_at) VALUES (?, ?, ?, ?)').bind(id, participantId, user.organizationId, now)),
  ])

  if (description) {
    await notifyMentionedUsers(env.DB, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorName: user.name,
      text: description,
      entityType: 'agenda_event',
      entityId: id,
      entityTitle: title,
    })
  }

  return Response.json({
    event: {
      id, title, startsAt, endsAt, eventType, visibility, description, location,
      projectId: project?.id ?? null,
      clientId: project?.clientId ?? mission?.clientId ?? null,
      ownerUserId: owner.id,
      ownerName: owner.name,
      missionId: mission?.id ?? null,
      missionTitle: null,
      participantUserIds: selectedParticipants.filter((participantId) => participantId !== owner.id),
      participantNames: [],
      attachmentName: null,
      attachmentSize: null,
    },
  }, { status: 201 })
}
