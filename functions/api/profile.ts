import { accessRequiredResponse, getAccessUser, type Bindings } from './_access'

type ProfileRow = {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
  socialName: string | null
  customRole: string | null
  bio: string | null
  highlightColor: string | null
  bannerUrl: string | null
  internalNetworks: string | null
  signature: string | null
  xp: number
  ideas: number
  level: string
  streakDays: number
  stickers: string | null
}

type RankingRow = {
  id: string
  name: string
  socialName: string | null
  xp: number
  level: string
  avatarUrl: string | null
}

const ALL_STICKERS = [
  { code: 'speed', name: 'Ritmo Veloz', description: 'Concluiu uma missão em menos de 24h.', imageUrl: '⚡' },
  { code: 'perfect-score', name: 'Entrega Perfeita', description: 'Aprovado sem nenhuma refação.', imageUrl: '✨' },
  { code: 'night-owl', name: 'Coruja da Noite', description: 'Missão concluída após as 22h.', imageUrl: '🦉' },
  { code: 'organizer', name: 'Mestre da Organização', description: 'Criou ou organizou 10 checklists.', imageUrl: '📋' },
  { code: 'streak-3', name: 'Fogo Sagrado', description: 'Manteve 3 dias seguidos de streak.', imageUrl: '🔥' },
  { code: 'streak-7', name: 'Inabalável', description: 'Manteve 7 dias seguidos de streak.', imageUrl: '🛡️' },
]

const DEFAULT_LEVELS = [
  { name: 'Criador', target: 0, detail: 'Transforma intenção em entrega.' },
  { name: 'Visionário', target: 8700, detail: 'Enxerga possibilidades antes do óbvio.' },
  { name: 'Catalisador', target: 12000, detail: 'Move pessoas e ideias para a frente.' }
]

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const profile = await env.DB.prepare(`
      SELECT 
        users.id,
        users.name,
        users.email,
        users.role,
        users.avatar_url AS avatarUrl,
        p.social_name AS socialName,
        p.custom_role AS customRole,
        p.bio,
        p.highlight_color AS highlightColor,
        p.banner_url AS bannerUrl,
        p.internal_networks AS internalNetworks,
        p.signature,
        COALESCE(p.xp, 0) AS xp,
        COALESCE(p.ideas, 0) AS ideas,
        COALESCE(p.level, 'Criador') AS level,
        COALESCE(p.streak_days, 0) AS streakDays,
        p.stickers
      FROM users
      LEFT JOIN gamification_profiles p ON p.user_id = users.id
      WHERE users.id = ? AND users.organization_id = ?
      LIMIT 1
    `).bind(user.id, user.organizationId).first<ProfileRow>()

  const resolvedProfile: ProfileRow = profile ?? {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: null,
    socialName: user.name.split(' ')[0] ?? user.name,
    customRole: null,
    bio: null,
    highlightColor: '#c6ff38',
    bannerUrl: null,
    internalNetworks: '{}',
    signature: null,
    xp: 0,
    ideas: 0,
    level: 'Criador',
    streakDays: 0,
    stickers: '[]',
  }

  const rankingQuery = await env.DB.prepare(`
      SELECT 
        users.id,
        users.name,
        p.social_name AS socialName,
        COALESCE(p.xp, 0) AS xp,
        COALESCE(p.level, 'Criador') AS level,
        users.avatar_url AS avatarUrl
      FROM users
      LEFT JOIN gamification_profiles p ON p.user_id = users.id
      WHERE users.organization_id = ? AND users.status = 'active'
      ORDER BY p.xp DESC
      LIMIT 20
    `).bind(user.organizationId).all<RankingRow>()
  const rankingList = rankingQuery.results ?? []

  let projectsDeliveredCount = 0
  let avgApprovalRate = 0

  const projectsDelivered = await env.DB.prepare(`
      SELECT COUNT(DISTINCT missions.project_id) AS count
      FROM missions
      JOIN mission_assignees ON mission_assignees.mission_id = missions.id
      JOIN projects ON projects.id = missions.project_id
      WHERE mission_assignees.user_id = ? AND projects.organization_id = ? AND missions.status = 'completed'
    `).bind(user.id, user.organizationId).first<{ count: number }>()

  const approvals = await env.DB.prepare(`
      SELECT 
        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) AS approved,
        COUNT(*) AS total
      FROM missions
      JOIN mission_assignees ON mission_assignees.mission_id = missions.id
      JOIN projects ON projects.id = missions.project_id
      WHERE mission_assignees.user_id = ? AND projects.organization_id = ? AND missions.status = 'completed'
    `).bind(user.id, user.organizationId).first<{ approved: number; total: number }>()

  if (projectsDelivered && projectsDelivered.count > 0) {
    projectsDeliveredCount = projectsDelivered.count
  }
  if (approvals && approvals.total > 0) {
    avgApprovalRate = Math.round((approvals.approved / approvals.total) * 100)
  }

  const unlockedStickers = JSON.parse(resolvedProfile.stickers ?? '[]') as string[]
  const stickers = ALL_STICKERS.map(sticker => ({
    ...sticker,
    unlocked: unlockedStickers.includes(sticker.code),
    unlockedAt: unlockedStickers.includes(sticker.code) ? new Date().toISOString() : undefined
  }))

  let levelConfig = DEFAULT_LEVELS
  try {
    const orgSettings = await env.DB?.prepare(`
      SELECT level_config AS levelConfig
      FROM organization_settings
      WHERE organization_id = ?
      LIMIT 1
    `).bind(user.organizationId).first<{ levelConfig: string }>()

    if (orgSettings?.levelConfig) {
      levelConfig = JSON.parse(orgSettings.levelConfig)
    }
  } catch {}

  return Response.json({
    profile: {
      ...resolvedProfile,
      highlightColor: resolvedProfile.highlightColor ?? '#c6ff38',
      internalNetworks: resolvedProfile.internalNetworks ? JSON.parse(resolvedProfile.internalNetworks) : {},
      stickers: unlockedStickers,
    },
    ranking: rankingList,
    stickers,
    levelConfig,
    stats: {
      projectsDelivered: projectsDeliveredCount,
      averageApproval: avgApprovalRate
    }
  })
}

type UpdateProfileInput = {
  name?: string
  avatarUrl?: string
  socialName?: string
  customRole?: string
  bio?: string
  highlightColor?: string
  bannerUrl?: string
  internalNetworks?: Record<string, string>
  signature?: string
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const input = await request.json().catch(() => null) as UpdateProfileInput | null
  if (!input) return Response.json({ error: 'Dados inválidos' }, { status: 400 })

  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 100) : undefined
  const avatarUrl = typeof input.avatarUrl === 'string' ? input.avatarUrl : undefined
  const socialName = typeof input.socialName === 'string' ? input.socialName.trim().slice(0, 100) : undefined
  const customRole = typeof input.customRole === 'string' ? input.customRole.trim().slice(0, 100) : undefined
  const bio = typeof input.bio === 'string' ? input.bio.trim().slice(0, 1000) : undefined
  const highlightColor = typeof input.highlightColor === 'string' ? input.highlightColor.trim().slice(0, 20) : undefined
  const bannerUrl = typeof input.bannerUrl === 'string' ? input.bannerUrl : undefined
  const internalNetworks = input.internalNetworks && typeof input.internalNetworks === 'object'
    ? JSON.stringify(input.internalNetworks)
    : undefined
  const signature = typeof input.signature === 'string' ? input.signature.trim().slice(0, 2000) : undefined

  const now = new Date().toISOString()

  try {
    const statements = []

    if (name !== undefined || avatarUrl !== undefined) {
      let updateUsersQuery = 'UPDATE users SET '
      const params = []
      if (name !== undefined) {
        updateUsersQuery += 'name = ?, '
        params.push(name)
      }
      if (avatarUrl !== undefined) {
        updateUsersQuery += 'avatar_url = ?, '
        params.push(avatarUrl)
      }
      updateUsersQuery = updateUsersQuery.slice(0, -2) + ' WHERE id = ?'
      params.push(user.id, user.organizationId)
      updateUsersQuery += ' AND organization_id = ?'
      statements.push(env.DB.prepare(updateUsersQuery).bind(...params))
    }

    statements.push(env.DB.prepare("INSERT OR IGNORE INTO gamification_profiles (user_id, level) VALUES (?, 'Criador')").bind(user.id))

    const profileUpdates: string[] = []
    const profileValues: unknown[] = []
    for (const [column, value] of [
      ['social_name', socialName], ['custom_role', customRole], ['bio', bio],
      ['highlight_color', highlightColor], ['banner_url', bannerUrl],
      ['internal_networks', internalNetworks], ['signature', signature],
    ] as const) {
      if (value !== undefined) {
        profileUpdates.push(`${column} = ?`)
        profileValues.push(value)
      }
    }
    if (profileUpdates.length > 0) {
      profileUpdates.push('updated_at = ?')
      profileValues.push(now, user.id)
      statements.push(env.DB.prepare(`UPDATE gamification_profiles SET ${profileUpdates.join(', ')} WHERE user_id = ?`).bind(...profileValues))
    }

    await env.DB.batch(statements)
  } catch (error) {
    console.error('Profile update failed', error)
    return Response.json({ error: 'Não foi possível atualizar o perfil' }, { status: 500 })
  }

  return Response.json({ success: true })
}
