import { getAccessUser, hasPermissionV2, type AccessUser, type Bindings } from '../_access'
import { encryptIntegrationConfig, isAllowedSlackWebhook } from '../_integrationSecrets'

const SUPPORTED_PROVIDERS = new Set(['slack', 'runrunit'])

function validateConfig(provider: string, value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const config = value as Record<string, unknown>
  if (provider === 'slack') {
    if (!isAllowedSlackWebhook(config.webhookUrl)) return null
    return {
      webhookUrl: config.webhookUrl,
      channel: typeof config.channel === 'string' ? config.channel.trim().slice(0, 100) : '',
    }
  }
  if (provider === 'runrunit') {
    if (typeof config.token !== 'string' || !config.token.trim() || config.token.length > 2000) return null
    return {
      token: config.token.trim(),
      orgId: typeof config.orgId === 'string' ? config.orgId.trim().slice(0, 120) : '',
    }
  }
  return null
}

async function requireIntegrationAdmin(env: Bindings, request: Request): Promise<
  { ok: false; response: Response } | { ok: true; user: AccessUser }
> {
  const user = await getAccessUser(request, env)
  if (!user) return { ok: false, response: Response.json({ error: 'Não autenticado' }, { status: 401 }) }
  if (!(await hasPermissionV2(env, request, user, 'integrations.manage'))) {
    return { ok: false, response: Response.json({ error: 'Não autorizado' }, { status: 403 }) }
  }
  return { ok: true, user }
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const access = await requireIntegrationAdmin(env, request)
  if (!access.ok) return access.response

  const { results } = await env.DB.prepare(`
    SELECT provider, is_active AS isActive,
      CASE WHEN config_json LIKE 'enc:v1:%' THEN 1 ELSE 0 END AS configured
    FROM external_integrations
    WHERE organization_id = ?
    ORDER BY provider
  `).bind(access.user.organizationId).all<{ provider: string; isActive: number; configured: number }>()

  return Response.json(results.map(row => ({
    provider: row.provider,
    isActive: row.isActive === 1,
    configured: row.configured === 1,
  })))
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const access = await requireIntegrationAdmin(env, request)
  if (!access.ok) return access.response

  const payload = await request.json().catch(() => null) as {
    provider?: unknown
    config?: unknown
    isActive?: unknown
  } | null
  const provider = typeof payload?.provider === 'string' ? payload.provider.trim().toLocaleLowerCase('en-US') : ''
  if (!SUPPORTED_PROVIDERS.has(provider)) return Response.json({ error: 'Provedor não suportado' }, { status: 400 })
  const config = validateConfig(provider, payload?.config)
  if (!config) return Response.json({ error: 'Configuração inválida para o provedor' }, { status: 400 })

  let encryptedConfig: string
  try {
    encryptedConfig = await encryptIntegrationConfig(env, config)
  } catch (error) {
    console.error('Integration encryption unavailable', error)
    return Response.json({ error: 'Criptografia das integrações não está configurada' }, { status: 503 })
  }

  await env.DB.prepare(`
    INSERT INTO external_integrations (id, provider, config_json, is_active, updated_at, organization_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(organization_id, provider) DO UPDATE SET
      config_json = excluded.config_json,
      is_active = excluded.is_active,
      updated_at = excluded.updated_at
  `).bind(
    crypto.randomUUID(), provider, encryptedConfig, payload?.isActive === true ? 1 : 0,
    new Date().toISOString(), access.user.organizationId,
  ).run()

  return Response.json({ success: true, provider, configured: true })
}
