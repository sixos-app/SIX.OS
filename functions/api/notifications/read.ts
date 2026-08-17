import { accessRequiredResponse, getAccessUser, type Bindings } from '../_access'

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const payload = await request.json().catch(() => ({})) as { notificationId?: string; all?: boolean }

  try {
    if (payload.all) {
      await env.DB.prepare('UPDATE app_notifications SET is_read = 1 WHERE recipient_user_id = ? AND organization_id = ?')
        .bind(user.id, user.organizationId)
        .run()
    } else if (payload.notificationId) {
      await env.DB.prepare('UPDATE app_notifications SET is_read = 1 WHERE id = ? AND recipient_user_id = ? AND organization_id = ?')
        .bind(payload.notificationId, user.id, user.organizationId)
        .run()
    }
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Falha ao atualizar notificação' }, { status: 500 })
  }
}
