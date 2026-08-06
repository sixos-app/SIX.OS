import { getAccessUser, type Bindings } from '../_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  if (user.role !== 'admin') return Response.json({ error: 'Não autorizado' }, { status: 403 })

  try {
    const { results } = await env.DB.prepare(`
      SELECT provider, config_json as configJson, is_active as isActive
      FROM external_integrations
      WHERE organization_id = ?
    `).bind(user.organizationId).all()

    return Response.json(results)
  } catch (error) {
    return Response.json({ error: 'Erro ao buscar configurações.' }, { status: 500 })
  }
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  if (user.role !== 'admin') return Response.json({ error: 'Não autorizado' }, { status: 403 })

  let payload: {
    provider: string
    configJson: string
    isActive: boolean
  }

  try {
    payload = await request.json() as typeof payload
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const { provider, configJson, isActive } = payload
  if (!provider || typeof configJson !== 'string') {
    return Response.json({ error: 'Provedor e configuração são obrigatórios.' }, { status: 400 })
  }

  const id = `int-${provider}`
  const now = new Date().toISOString()
  const activeVal = isActive ? 1 : 0

  try {
    // Upsert integration config
    await env.DB.prepare(`
      INSERT INTO external_integrations (id, provider, config_json, is_active, updated_at, organization_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json, is_active = excluded.is_active, updated_at = excluded.updated_at
    `).bind(id, provider, configJson, activeVal, now, user.organizationId).run()

    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: 'Erro ao salvar configuração.' }, { status: 500 })
  }
}
