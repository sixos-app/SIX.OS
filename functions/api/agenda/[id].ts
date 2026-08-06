import { accessRequiredResponse, getAccessUser, hasPermission, permissionRequiredResponse, type AccessUser, type Bindings } from '../_access'

type EventRow = { id: string; visibility: 'personal' | 'team'; ownerUserId: string | null }
type UpdateAgendaInput = { title?: unknown; startsAt?: unknown; endsAt?: unknown; eventType?: unknown; visibility?: unknown; description?: unknown; location?: unknown; projectId?: unknown }

const eventTypes = new Set(['meeting', 'deadline', 'appointment', 'vacation'])

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : undefined
}

function toDate(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : undefined
}

async function eventAccess(env: Bindings, user: AccessUser, id: string) {
  const event = await env.DB.prepare('SELECT id, visibility, owner_user_id AS ownerUserId FROM calendar_events WHERE id = ? AND organization_id = ? LIMIT 1').bind(id, user.organizationId).first<EventRow>()
  if (!event) return null
  const canManage = event.ownerUserId === user.id || (event.visibility === 'team' && hasPermission(user, 'agenda.team.view'))
  return { event, canManage }
}

export const onRequestPatch: PagesFunction<Bindings, { id: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const access = await eventAccess(env, user, params.id)
  if (!access) return Response.json({ error: 'Evento não encontrado' }, { status: 404 })
  if (!access.canManage) return permissionRequiredResponse()

  const input = await request.json().catch(() => null) as UpdateAgendaInput | null
  if (!input) return Response.json({ error: 'Atualização inválida' }, { status: 400 })
  const stored = await env.DB.prepare('SELECT title, starts_at AS startsAt, ends_at AS endsAt, event_type AS eventType, visibility, description, location, project_id AS projectId FROM calendar_events WHERE id = ?').bind(params.id).first<{ title: string; startsAt: string; endsAt: string | null; eventType: string; visibility: 'personal' | 'team'; description: string; location: string | null; projectId: string | null }>()
  if (!stored) return Response.json({ error: 'Evento não encontrado' }, { status: 404 })

  const title = text(input.title, 160) ?? stored.title
  const startsAt = toDate(input.startsAt) ?? stored.startsAt
  const endsAt = input.endsAt === '' ? null : toDate(input.endsAt) ?? stored.endsAt
  const eventType = typeof input.eventType === 'string' && eventTypes.has(input.eventType) ? input.eventType : stored.eventType
  const requestedVisibility = input.visibility === 'team' ? 'team' : input.visibility === 'personal' ? 'personal' : stored.visibility
  const visibility = requestedVisibility === 'team' && hasPermission(user, 'agenda.team.view') ? 'team' : requestedVisibility
  const description = text(input.description, 2000) ?? stored.description
  const location = input.location === '' ? null : text(input.location, 160) ?? stored.location
  const requestedProjectId = typeof input.projectId === 'string' ? input.projectId || null : stored.projectId
  if (!title || (requestedVisibility === 'team' && visibility !== 'team') || (endsAt && Date.parse(endsAt) < Date.parse(startsAt))) return Response.json({ error: 'Dados do evento inválidos' }, { status: 400 })

  const project = requestedProjectId ? await env.DB.prepare('SELECT id, client_id AS clientId FROM projects WHERE id = ? AND organization_id = ? LIMIT 1').bind(requestedProjectId, user.organizationId).first<{ id: string; clientId: string }>() : null
  if (requestedProjectId && !project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })
  await env.DB.prepare('UPDATE calendar_events SET title = ?, starts_at = ?, ends_at = ?, event_type = ?, visibility = ?, description = ?, location = ?, project_id = ?, client_id = ?, updated_at = ? WHERE id = ?').bind(title, startsAt, endsAt, eventType, visibility, description, location, project?.id ?? null, project?.clientId ?? null, new Date().toISOString(), params.id).run()
  return Response.json({ ok: true })
}

export const onRequestDelete: PagesFunction<Bindings, { id: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const access = await eventAccess(env, user, params.id)
  if (!access) return Response.json({ error: 'Evento não encontrado' }, { status: 404 })
  if (!access.canManage) return permissionRequiredResponse()
  await env.DB.prepare('DELETE FROM calendar_events WHERE id = ?').bind(params.id).run()
  return new Response(null, { status: 204 })
}
