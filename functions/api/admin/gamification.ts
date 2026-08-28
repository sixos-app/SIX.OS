import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'
import { GAMIFICATION_LEVELS } from '../../../shared/gamificationLevels'

type SettingsRow = {
  xp_multiplier: number
  rewards_config: string
}

const OFFICIAL_LEVEL_CONFIG = GAMIFICATION_LEVELS.map(level => ({ name: level.name, target: level.minXp, detail: level.description }))

const DEFAULT_REWARDS = [
  { id: 'reward-1', title: 'Kudos no Feed', xpCost: 100 },
  { id: 'reward-2', title: 'Adesivo Personalizado', xpCost: 500 },
  { id: 'reward-3', title: 'Folga de Meio Período', xpCost: 2000 }
]

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'gamification.manage'))) return permissionRequiredResponse()

  const settings = await env.DB.prepare(`
    SELECT xp_multiplier, rewards_config
    FROM organization_settings
    WHERE organization_id = ?
    LIMIT 1
  `).bind(user.organizationId).first<SettingsRow>()

  if (!settings) {
    return Response.json({
      xpMultiplier: 1.0,
      levelConfig: OFFICIAL_LEVEL_CONFIG,
      rewardsConfig: DEFAULT_REWARDS
    })
  }

  return Response.json({
    xpMultiplier: settings.xp_multiplier,
    levelConfig: OFFICIAL_LEVEL_CONFIG,
    rewardsConfig: JSON.parse(settings.rewards_config || '[]')
  })
}

type SaveGamificationInput = {
  xpMultiplier?: unknown
  levelConfig?: unknown
  rewardsConfig?: unknown
}

function isOfficialLevelConfig(value: unknown): boolean {
  return Array.isArray(value)
    && value.length === OFFICIAL_LEVEL_CONFIG.length
    && value.every((level, index) => {
      const official = OFFICIAL_LEVEL_CONFIG[index]
      return typeof level === 'object' && level !== null
        && 'name' in level && level.name === official?.name
        && 'target' in level && level.target === official?.target
        && 'detail' in level && level.detail === official?.detail
    })
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'gamification.manage'))) return permissionRequiredResponse()

  const input = await request.json().catch(() => null) as SaveGamificationInput | null
  if (!input) return Response.json({ error: 'Dados inválidos' }, { status: 400 })

  const xpMultiplier = typeof input.xpMultiplier === 'number' && input.xpMultiplier >= 0.1 && input.xpMultiplier <= 10.0
    ? input.xpMultiplier
    : 1.0

  if (input.levelConfig !== undefined && !isOfficialLevelConfig(input.levelConfig)) {
    return Response.json({ error: 'Os níveis oficiais são definidos pelo produto e não podem ser alterados por organização.' }, { status: 400 })
  }
  const rewardsConfig = Array.isArray(input.rewardsConfig) ? JSON.stringify(input.rewardsConfig) : JSON.stringify(DEFAULT_REWARDS)

  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO organization_settings (organization_id, xp_multiplier, level_config, rewards_config, updated_at)
    VALUES (?, ?, NULL, ?, ?)
    ON CONFLICT (organization_id) DO UPDATE SET
      xp_multiplier = excluded.xp_multiplier,
      rewards_config = excluded.rewards_config,
      updated_at = excluded.updated_at
  `).bind(user.organizationId, xpMultiplier, rewardsConfig, now).run()

  return Response.json({
    xpMultiplier,
    levelConfig: OFFICIAL_LEVEL_CONFIG,
    rewardsConfig: JSON.parse(rewardsConfig)
  })
}
