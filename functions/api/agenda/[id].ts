import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type AccessUser, type Bindings } from '../_access'
import { getMentionLogins, notifyMentionedUsers } from '../_notifications'

type AgendaBindings = Bindings & { FILES: R2Bucket }
type EventRow = { id: string; visibility: 'personal' | 'team'; ownerUserId: string | null; attachmentKey: string | null }
type UpdateAgendaInput = { title?: unknown; startsAt?: unknown; endsAt?: unknown; eventType?: unknown; visibility?: unknown; description?: unknown; location?: unknown; projectId?: unknown; ownerUserId?: unknown; missionId?: unknown; participantUserIds?: unknown; expectedRevision?: unknown }

const eventTypes = new Set(['meeting', 'deadline', 'appointment', 'capture', 'vacation', 'birthday'])

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : undefined
}

function toDate(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : undefined
}

function participantIds(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && Boolean(item)).slice(0, 50))]
    : null
}

async function eventAccess(env: Bindings, request: Request, user: AccessUser, id: string) {
  const event = await env.DB.prepare('SELECT id, visibility, owner_user_id AS ownerUserId, attachment_key AS attachmentKey FROM calendar_events WHERE id = ? AND organization_id = ? LIMIT 1').bind(id, user.organizationId).first<EventRow>()
  if (!event) return null
  const canManage = event.ownerUserId === user.id || await hasPermissionV2(env, request, user, 'agenda.team.view')
  return { event, canManage }
}

export const onRequestPatch: PagesFunction<AgendaBindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const eventId = params.id as string
  const access = await eventAccess(env, request, user, eventId)
  if (!access) return Response.json({ error: 'Evento não encontrado' }, { status: 404 })
  if (!access.canManage) return permissionRequiredResponse()

  const input = await request.json().catch(() => null) as UpdateAgendaInput | null
  if (!input) return Response.json({ error: 'Atualização inválida' }, { status: 400 })
  const expectedRevision = typeof input.expectedRevision === 'number' && Number.isInteger(input.expectedRevision) && input.expectedRevision >= 0 ? input.expectedRevision : null
  if (expectedRevision === null) return Response.json({ error: 'A versão do evento é obrigatória' }, { status: 400 })
  const stored = await env.DB.prepare('SELECT title, starts_at AS startsAt, ends_at AS endsAt, event_type AS eventType, visibility, description, location, project_id AS projectId, owner_user_id AS ownerUserId, mission_id AS missionId, revision FROM calendar_events WHERE id = ? AND organization_id = ?').bind(eventId, user.organizationId).first<{ title: string; startsAt: string; endsAt: string | null; eventType: string; visibility: 'personal' | 'team'; description: string; location: string | null; projectId: string | null; ownerUserId: string | null; missionId: string | null; revision: number }>()
  if (!stored) return Response.json({ error: 'Evento não encontrado' }, { status: 404 })

  const title = text(input.title, 160) ?? stored.title
  const startsAt = toDate(input.startsAt) ?? stored.startsAt
  const endsAt = input.endsAt === '' ? null : toDate(input.endsAt) ?? stored.endsAt
  const eventType = typeof input.eventType === 'string' && eventTypes.has(input.eventType) ? input.eventType : stored.eventType
  const requestedVisibility = input.visibility === 'team' ? 'team' : input.visibility === 'personal' ? 'personal' : stored.visibility
  const canCreateTeam = await hasPermissionV2(env, request, user, 'agenda.team.view')
  const visibility = requestedVisibility === 'team' && canCreateTeam ? 'team' : requestedVisibility
  const description = text(input.description, 2000) ?? stored.description
  const location = input.location === '' ? null : text(input.location, 160) ?? stored.location
  const requestedProjectId = typeof input.projectId === 'string' ? input.projectId || null : stored.projectId
  const requestedMissionId = typeof input.missionId === 'string' ? input.missionId || null : stored.missionId
  const requestedOwnerId = typeof input.ownerUserId === 'string' && input.ownerUserId ? input.ownerUserId : stored.ownerUserId ?? user.id
  const ownerUserId = requestedOwnerId !== user.id && canCreateTeam ? requestedOwnerId : user.id
  const selectedParticipants = participantIds(input.participantUserIds)
  if (!title || (requestedVisibility === 'team' && visibility !== 'team') || (endsAt && Date.parse(endsAt) < Date.parse(startsAt))) return Response.json({ error: 'Dados do evento inválidos' }, { status: 400 })
  if ((selectedParticipants?.some((id) => id !== user.id) || requestedOwnerId !== user.id) && !canCreateTeam) return permissionRequiredResponse()

  const mission = requestedMissionId ? await env.DB.prepare('SELECT missions.id, missions.project_id AS projectId, projects.client_id AS clientId FROM missions JOIN projects ON projects.id = missions.project_id WHERE missions.id = ? AND projects.organization_id = ? LIMIT 1').bind(requestedMissionId, user.organizationId).first<{ id: string; projectId: string; clientId: string }>() : null
  if (requestedMissionId && !mission) return Response.json({ error: 'Missão vinculada não encontrada' }, { status: 404 })
  if (mission && requestedProjectId && mission.projectId !== requestedProjectId) return Response.json({ error: 'A missão não pertence ao projeto selecionado' }, { status: 400 })
  const effectiveProjectId = requestedProjectId ?? mission?.projectId ?? null
  const project = effectiveProjectId ? await env.DB.prepare('SELECT id, client_id AS clientId FROM projects WHERE id = ? AND organization_id = ? LIMIT 1').bind(effectiveProjectId, user.organizationId).first<{ id: string; clientId: string }>() : null
  if (effectiveProjectId && !project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })
  const owner = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? AND status = \'active\' LIMIT 1').bind(ownerUserId, user.organizationId).first()
  if (!owner) return Response.json({ error: 'Colaborador da agenda não encontrado' }, { status: 404 })

  if (selectedParticipants?.length) {
    const placeholders = selectedParticipants.map(() => '?').join(',')
    const participants = await env.DB.prepare(`SELECT id FROM users WHERE organization_id = ? AND status = 'active' AND id IN (${placeholders})`).bind(user.organizationId, ...selectedParticipants).all<{ id: string }>()
    if (participants.results.length !== selectedParticipants.length) return Response.json({ error: 'Um ou mais participantes não estão disponíveis' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const has = (field: keyof UpdateAgendaInput) => Object.prototype.hasOwnProperty.call(input, field)
  const updates: Array<{ column: string; value: string | null }> = []
  if (has('title') && typeof input.title === 'string') updates.push({ column: 'title', value: title })
  if (has('startsAt') && typeof input.startsAt === 'string' && toDate(input.startsAt)) updates.push({ column: 'starts_at', value: startsAt })
  if (has('endsAt') && (input.endsAt === '' || toDate(input.endsAt))) updates.push({ column: 'ends_at', value: endsAt })
  if (has('eventType') && typeof input.eventType === 'string' && eventTypes.has(input.eventType)) updates.push({ column: 'event_type', value: eventType })
  if (has('visibility') && (input.visibility === 'personal' || input.visibility === 'team')) updates.push({ column: 'visibility', value: visibility })
  if (has('description') && typeof input.description === 'string') updates.push({ column: 'description', value: description })
  if (has('location') && (input.location === '' || text(input.location, 160) !== undefined)) updates.push({ column: 'location', value: location })
  if (has('projectId') && typeof input.projectId === 'string') {
    updates.push({ column: 'project_id', value: project?.id ?? null }, { column: 'client_id', value: project?.clientId ?? mission?.clientId ?? null })
  }
  if (has('missionId') && typeof input.missionId === 'string') {
    updates.push({ column: 'mission_id', value: mission?.id ?? null })
    if (!has('projectId')) updates.push({ column: 'project_id', value: project?.id ?? null }, { column: 'client_id', value: project?.clientId ?? mission?.clientId ?? null })
  }
  if (has('ownerUserId') && typeof input.ownerUserId === 'string' && input.ownerUserId) updates.push({ column: 'owner_user_id', value: ownerUserId })
  if (updates.length === 0 && selectedParticipants === null) return Response.json({ error: 'Nenhuma alteração válida foi informada' }, { status: 400 })
  updates.push({ column: 'updated_at', value: now })
  const statements = [env.DB.prepare(`
    UPDATE calendar_events
    SET ${updates.map((update) => `${update.column} = ?`).join(', ')}, revision = revision + 1
    WHERE id = ? AND organization_id = ? AND revision = ?
  `).bind(...updates.map((update) => update.value), eventId, user.organizationId, expectedRevision)]
  if (selectedParticipants) {
    const participantIdsToKeep = selectedParticipants.filter((participantId) => participantId !== ownerUserId)
    statements.push(...participantIdsToKeep.map((participantId) => env.DB.prepare(`
      INSERT OR REPLACE INTO calendar_event_participants (event_id, user_id, organization_id, created_at)
      SELECT ?, ?, ?, ?
      WHERE changes() = 1
    `).bind(eventId, participantId, user.organizationId, now)))
    const participantFilter = participantIdsToKeep.length ? `AND user_id NOT IN (${participantIdsToKeep.map(() => '?').join(', ')})` : ''
    statements.push(env.DB.prepare(`
      DELETE FROM calendar_event_participants
      WHERE event_id = ? ${participantFilter} AND changes() = 1
    `).bind(eventId, ...participantIdsToKeep))
  }
  const [update] = await env.DB.batch(statements)
  if (!update.meta.changes) return Response.json({ error: 'O evento foi alterado por outra operação. Recarregue antes de salvar novamente.' }, { status: 409 })

  const previousMentions = new Set(getMentionLogins(stored.description))
  const addedMentions = getMentionLogins(description).filter((login) => !previousMentions.has(login))
  if (addedMentions.length) {
    await notifyMentionedUsers(env.DB, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorName: user.name,
      text: description,
      entityType: 'agenda_event',
      entityId: eventId,
      entityTitle: title ?? 'Compromisso',
      mentionLogins: addedMentions,
    })
  }

  return Response.json({ ok: true })
}

export const onRequestDelete: PagesFunction<AgendaBindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const eventId = params.id as string
  const access = await eventAccess(env, request, user, eventId)
  if (!access) return Response.json({ error: 'Evento não encontrado' }, { status: 404 })
  if (!access.canManage) return permissionRequiredResponse()
  await env.DB.prepare('DELETE FROM calendar_events WHERE id = ?').bind(eventId).run()
  if (access.event.attachmentKey) await env.FILES.delete(access.event.attachmentKey)
  return new Response(null, { status: 204 })
}
