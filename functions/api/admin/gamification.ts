import { accessRequiredResponse, getAccessUser, hasPermission, permissionRequiredResponse, type Bindings } from '../_access'

type SettingsRow = {
  xp_multiplier: number
  level_config: string
  rewards_config: string
}

const DEFAULT_LEVELS = [
  { name: 'Criador', target: 0, detail: 'Transforma intenção em entrega.' },
  { name: 'Visionário', target: 8700, detail: 'Enxerga possibilidades antes do óbvio.' },
  { name: 'Catalisador', target: 12000, detail: 'Move pessoas e ideias para a frente.' }
]

const DEFAULT_REWARDS = [
  { id: 'reward-1', title: 'Kudos no Feed', xpCost: 100 },
  { id: 'reward-2', title: 'Adesivo Personalizado', xpCost: 500 },
  { id: 'reward-3', title: 'Folga de Meio Período', xpCost: 2000 }
]

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!hasPermission(user, 'gamification.manage')) return permissionRequiredResponse()

  const settings = await env.DB.prepare(`
    SELECT xp_multiplier, level_config, rewards_config
    FROM organization_settings
    WHERE organization_id = ?
    LIMIT 1
  `).bind(user.organizationId).first<SettingsRow>()

  if (!settings) {
    return Response.json({
      xpMultiplier: 1.0,
      levelConfig: DEFAULT_LEVELS,
      rewardsConfig: DEFAULT_REWARDS
    })
  }

  return Response.json({
    xpMultiplier: settings.xp_multiplier,
    levelConfig: JSON.parse(settings.level_config || '[]'),
    rewardsConfig: JSON.parse(settings.rewards_config || '[]')
  })
}

type SaveGamificationInput = {
  xpMultiplier?: unknown
  levelConfig?: unknown
  rewardsConfig?: unknown
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!hasPermission(user, 'gamification.manage')) return permissionRequiredResponse()

  const input = await request.json().catch(() => null) as SaveGamificationInput | null
  if (!input) return Response.json({ error: 'Dados inválidos' }, { status: 400 })

  const xpMultiplier = typeof input.xpMultiplier === 'number' && input.xpMultiplier >= 0.1 && input.xpMultiplier <= 10.0
    ? input.xpMultiplier
    : 1.0

  const levelConfig = Array.isArray(input.levelConfig) ? JSON.stringify(input.levelConfig) : JSON.stringify(DEFAULT_LEVELS)
  const rewardsConfig = Array.isArray(input.rewardsConfig) ? JSON.stringify(input.rewardsConfig) : JSON.stringify(DEFAULT_REWARDS)

  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO organization_settings (organization_id, xp_multiplier, level_config, rewards_config, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (organization_id) DO UPDATE SET
      xp_multiplier = excluded.xp_multiplier,
      level_config = excluded.level_config,
      rewards_config = excluded.rewards_config,
      updated_at = excluded.updated_at
  `).bind(user.organizationId, xpMultiplier, levelConfig, rewardsConfig, now).run()

  return Response.json({
    xpMultiplier,
    levelConfig: JSON.parse(levelConfig),
    rewardsConfig: JSON.parse(rewardsConfig)
  })
}
