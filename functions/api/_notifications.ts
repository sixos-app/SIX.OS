import type { D1Database } from '@cloudflare/workers-types'

export type MentionNotificationInput = {
  organizationId: string
  actorUserId: string
  actorName: string
  text: string
  entityType: 'mission' | 'project' | 'agenda_event'
  entityId: string
  entityTitle: string
}

export async function notifyMentionedUsers(
  db: D1Database,
  input: MentionNotificationInput
): Promise<string[]> {
  if (!input.text || typeof input.text !== 'string') return []

  // Extract @login from text, ignoring emails like user@domain.com
  // A mention is @login preceded by start-of-line or whitespace or punctuation, not alphanumeric
  const mentionMatches = input.text.match(/(?:^|[\s(])@([a-z0-9._-]{3,40})/gi)
  if (!mentionMatches || mentionMatches.length === 0) return []

  const rawLogins = mentionMatches
    .map((m) => m.replace(/^[^\s@]*@/, '').toLowerCase().trim())
    .filter(Boolean)
  const uniqueLogins = [...new Set(rawLogins)]

  if (uniqueLogins.length === 0) return []

  const placeholders = uniqueLogins.map(() => '?').join(', ')
  const targetUsers = await db
    .prepare(
      `SELECT id, name, username FROM users WHERE organization_id = ? AND status = 'active' AND LOWER(username) IN (${placeholders})`
    )
    .bind(input.organizationId, ...uniqueLogins)
    .all<{ id: string; name: string; username: string }>()

  if (!targetUsers.results || targetUsers.results.length === 0) return []

  const notifiedUserIds: string[] = []
  const previewText = input.text.length > 120 ? `${input.text.slice(0, 117)}...` : input.text

  const entityTypeLabel =
    input.entityType === 'mission'
      ? 'na missão'
      : input.entityType === 'project'
      ? 'no projeto'
      : 'no evento'

  for (const target of targetUsers.results) {
    // Do not notify self
    if (target.id === input.actorUserId) continue

    const notificationId = `notif-${crypto.randomUUID()}`
    const title = `${input.actorName} mencionou você ${entityTypeLabel} "${input.entityTitle}"`
    const metadata = JSON.stringify({
      entityType: input.entityType,
      entityId: input.entityId,
      entityTitle: input.entityTitle,
      mentionLogin: target.username,
    })

    try {
      await db
        .prepare(
          `INSERT INTO app_notifications (id, organization_id, recipient_user_id, actor_user_id, type, entity_type, entity_id, title, description, metadata, is_read)
           VALUES (?, ?, ?, ?, 'user_mentioned', ?, ?, ?, ?, ?, 0)`
        )
        .bind(
          notificationId,
          input.organizationId,
          target.id,
          input.actorUserId,
          input.entityType,
          input.entityId,
          title,
          previewText,
          metadata
        )
        .run()

      notifiedUserIds.push(target.id)
    } catch (err) {
      console.error('Falha ao criar notificação de menção:', err)
    }
  }

  return notifiedUserIds
}
