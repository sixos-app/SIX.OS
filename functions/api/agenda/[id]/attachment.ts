import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type AccessUser, type Bindings } from '../../_access'

type AgendaBindings = Bindings & { FILES: R2Bucket }
type EventAttachmentRow = {
  id: string
  ownerUserId: string | null
  attachmentName: string | null
  attachmentKey: string | null
  attachmentContentType: string | null
  attachmentSize: number | null
}

const allowedExtensions = new Set(['doc', 'docx', 'pdf'])

function storageFileName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'documento'
}

async function getEvent(env: Bindings, organizationId: string, eventId: string) {
  return await env.DB.prepare(`
    SELECT id, owner_user_id AS ownerUserId, attachment_name AS attachmentName,
      attachment_key AS attachmentKey, attachment_content_type AS attachmentContentType,
      attachment_size AS attachmentSize
    FROM calendar_events
    WHERE id = ? AND organization_id = ?
    LIMIT 1
  `).bind(eventId, organizationId).first<EventAttachmentRow>()
}

async function canViewEvent(env: Bindings, request: Request, user: AccessUser, event: EventAttachmentRow) {
  if (event.ownerUserId === user.id) return true
  const participant = await env.DB.prepare('SELECT 1 AS allowed FROM calendar_event_participants WHERE event_id = ? AND user_id = ? AND organization_id = ? LIMIT 1').bind(event.id, user.id, user.organizationId).first()
  return Boolean(participant) || await hasPermissionV2(env, request, user, 'agenda.team.view')
}

export const onRequestGet: PagesFunction<AgendaBindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const event = await getEvent(env, user.organizationId, params.id as string)
  if (!event) return Response.json({ error: 'Evento não encontrado' }, { status: 404 })
  if (!(await canViewEvent(env, request, user, event))) return permissionRequiredResponse()
  if (!event.attachmentKey || !event.attachmentName) return Response.json({ error: 'Este evento não possui documento' }, { status: 404 })
  const object = await env.FILES.get(event.attachmentKey)
  if (!object) return Response.json({ error: 'Documento não encontrado no armazenamento' }, { status: 404 })
  return new Response(object.body, {
    headers: {
      'Content-Type': event.attachmentContentType || object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Length': String(event.attachmentSize ?? object.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(event.attachmentName)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}

export const onRequestPost: PagesFunction<AgendaBindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const eventId = params.id as string
  const event = await getEvent(env, user.organizationId, eventId)
  if (!event) return Response.json({ error: 'Evento não encontrado' }, { status: 404 })
  const canManage = event.ownerUserId === user.id || await hasPermissionV2(env, request, user, 'agenda.team.view')
  if (!canManage) return permissionRequiredResponse()

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: 'Selecione um documento válido' }, { status: 400 })
  if (file.size > 25 * 1024 * 1024) return Response.json({ error: 'O documento deve ter no máximo 25 MB' }, { status: 413 })
  const name = file.name.trim().slice(0, 180)
  const extension = name.split('.').pop()?.toLocaleLowerCase('pt-BR') ?? ''
  if (!allowedExtensions.has(extension)) return Response.json({ error: 'Envie um arquivo DOC, DOCX ou PDF' }, { status: 415 })

  const storageKey = `organizations/${user.organizationId}/agenda/${eventId}/${crypto.randomUUID()}-${storageFileName(name)}`
  const contentType = file.type || 'application/octet-stream'
  await env.FILES.put(storageKey, file.stream(), {
    httpMetadata: { contentType },
    customMetadata: { eventId, organizationId: user.organizationId },
  })

  try {
    const replacement = await env.DB.prepare(`
      UPDATE calendar_events
      SET attachment_name = ?, attachment_key = ?, attachment_content_type = ?, attachment_size = ?, updated_at = ?, revision = revision + 1
      WHERE id = ? AND organization_id = ? AND attachment_key IS ?
    `).bind(name, storageKey, contentType, file.size, new Date().toISOString(), eventId, user.organizationId, event.attachmentKey).run()
    if (!replacement.meta.changes) {
      await env.FILES.delete(storageKey)
      return Response.json({ error: 'O documento foi alterado por outra solicitação' }, { status: 409 })
    }
  } catch (error) {
    await env.FILES.delete(storageKey)
    throw error
  }
  if (event.attachmentKey) {
    try {
      await env.FILES.delete(event.attachmentKey)
    } catch (error) {
      console.error('[files] agenda previous attachment cleanup failed', {
        operation: 'agenda_attachment_replace',
        organizationId: user.organizationId,
        eventId,
        error: error instanceof Error ? error.name : 'UnknownError',
      })
      throw error
    }
  }
  return Response.json({ attachment: { name, size: file.size } }, { status: 201 })
}

export const onRequestDelete: PagesFunction<AgendaBindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const eventId = params.id as string
  const event = await getEvent(env, user.organizationId, eventId)
  if (!event) return Response.json({ error: 'Evento não encontrado' }, { status: 404 })
  const canManage = event.ownerUserId === user.id || await hasPermissionV2(env, request, user, 'agenda.team.view')
  if (!canManage) return permissionRequiredResponse()
  const deletion = await env.DB.prepare(`
    UPDATE calendar_events
    SET attachment_name = NULL, attachment_key = NULL, attachment_content_type = NULL, attachment_size = NULL, updated_at = ?, revision = revision + 1
    WHERE id = ? AND organization_id = ? AND attachment_key IS ?
  `).bind(new Date().toISOString(), eventId, user.organizationId, event.attachmentKey).run()
  if (!deletion.meta.changes) return Response.json({ error: 'O documento foi alterado por outra solicitação' }, { status: 409 })
  if (event.attachmentKey) {
    try {
      await env.FILES.delete(event.attachmentKey)
    } catch (error) {
      console.error('[files] agenda attachment cleanup failed', {
        operation: 'agenda_attachment_delete',
        organizationId: user.organizationId,
        eventId,
        error: error instanceof Error ? error.name : 'UnknownError',
      })
      throw error
    }
  }
  return new Response(null, { status: 204 })
}
