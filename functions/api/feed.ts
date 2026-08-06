import { getAccessUser, type Bindings } from './_access'

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

  let payload: {
    type?: string
    title?: string
    targetName: string
    xpAmount?: number
    link?: string
  }

  try {
    payload = await request.json() as typeof payload
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const type = payload.type || 'kudo_received'
  const targetName = payload.targetName
  const title = payload.title || (type === 'project_created' ? 'iniciou o projeto' : 'enviou kudos por')
  const xpAmount = typeof payload.xpAmount === 'number' ? payload.xpAmount : (type === 'kudo_received' ? 100 : null)
  const link = payload.link || null

  if (!targetName.trim()) {
    return Response.json({ error: 'Alvo é obrigatório.' }, { status: 400 })
  }

  const id = `feed-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  try {
    await env.DB.prepare(`
      INSERT INTO agency_feed (id, user_id, type, title, target_name, xp_amount, link, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      user.id,
      type,
      title,
      targetName,
      xpAmount,
      link,
      user.organizationId
    ).run()

    // Check and trigger Slack integration in background
    try {
      const slackIntegration = await env.DB.prepare(`
        SELECT config_json, is_active FROM external_integrations
        WHERE provider = 'slack' AND organization_id = ? LIMIT 1
      `).bind(user.organizationId).first<{ config_json: string; is_active: number }>()

      if (slackIntegration && slackIntegration.is_active === 1) {
        const config = JSON.parse(slackIntegration.config_json)
        if (config.webhookUrl) {
          void fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🔔 *SIX.OS Feed Alert*:\n*${user.name}* ${title} *${targetName}*`
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
