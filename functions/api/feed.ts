import { getAccessUser, type Bindings } from './_access'
import { decryptIntegrationConfig, isAllowedSlackWebhook } from './_integrationSecrets'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        f.*, 
        u.name as user_name, 
        u.avatar_url as user_avatar,
        u.role as user_role
      FROM agency_feed f
      LEFT JOIN users u ON f.user_id = u.id
      WHERE f.organization_id = ?
      ORDER BY f.created_at DESC
      LIMIT 50
    `).bind(user.organizationId).all()

    return Response.json(results)
  } catch (error) {
    return Response.json({ error: 'Erro ao buscar o feed.' }, { status: 500 })
  }
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  let payload: { targetName?: unknown; reason?: unknown }

  try {
    payload = await request.json() as typeof payload
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const targetName = typeof payload.targetName === 'string' ? payload.targetName.trim().slice(0, 120) : ''
  const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, 500) : ''

  if (!targetName || !reason) return Response.json({ error: 'Pessoa e motivo são obrigatórios.' }, { status: 400 })

  const target = await env.DB.prepare('SELECT id, name FROM users WHERE name = ? AND organization_id = ? AND status = ? LIMIT 1')
    .bind(targetName, user.organizationId, 'active').first<{ id: string; name: string }>()
  if (!target) return Response.json({ error: 'Pessoa não encontrada nesta organização.' }, { status: 404 })

  const id = crypto.randomUUID()
  try {
    await env.DB.prepare(`
      INSERT INTO agency_feed (id, user_id, type, title, target_name, xp_amount, link, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      user.id,
      'kudo_received',
      'enviou kudos por',
      `${target.name}: ${reason}`,
      null,
      null,
      user.organizationId
    ).run()

    // Check and trigger Slack integration in background
    try {
      const slackIntegration = await env.DB.prepare(`
        SELECT config_json, is_active FROM external_integrations
        WHERE provider = 'slack' AND organization_id = ? LIMIT 1
      `).bind(user.organizationId).first<{ config_json: string; is_active: number }>()

      if (slackIntegration && slackIntegration.is_active === 1) {
        const config = await decryptIntegrationConfig<{ webhookUrl?: unknown }>(env, slackIntegration.config_json)
        if (isAllowedSlackWebhook(config.webhookUrl)) {
          void fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🔔 *SIX.OS Kudos*:\n*${user.name}* reconheceu *${target.name}*: ${reason}`
            })
          }).catch(() => undefined)
        }
      }
    } catch {}

    return Response.json({ success: true, id })
  } catch (error) {
    return Response.json({ error: 'Erro ao registrar evento no feed.' }, { status: 500 })
  }
}
