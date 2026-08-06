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

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  // 1. Fetch Profile
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
      p.xp,
      p.ideas,
      p.level,
      p.streak_days AS streakDays,
      p.stickers
    FROM users
    LEFT JOIN gamification_profiles p ON p.user_id = users.id
    WHERE users.id = ? AND users.organization_id = ?
    LIMIT 1
  `).bind(user.id, user.organizationId).first<ProfileRow>()

  if (!profile) {
    return Response.json({ error: 'Perfil não encontrado' }, { status: 404 })
  }

  // 2. Fetch Ranking
  const ranking = await env.DB.prepare(`
    SELECT 
      users.id,
      users.name,
      p.social_name AS socialName,
      p.xp,
      p.level,
      users.avatar_url AS avatarUrl
    FROM users
    JOIN gamification_profiles p ON p.user_id = users.id
    WHERE users.organization_id = ?
    ORDER BY p.xp DESC
    LIMIT 20
  `).bind(user.organizationId).all<RankingRow>()

  // 3. Fetch Stats
  const projectsDelivered = await env.DB.prepare(`
    SELECT COUNT(DISTINCT missions.project_id) AS count
    FROM missions
    JOIN mission_assignees ON mission_assignees.mission_id = missions.id
    WHERE mission_assignees.user_id = ? AND missions.status = 'completed'
  `).bind(user.id).first<{ count: number }>()

  const approvals = await env.DB.prepare(`
    SELECT 
      COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) AS approved,
      COUNT(*) AS total
    FROM missions
    JOIN mission_assignees ON mission_assignees.mission_id = missions.id
    WHERE mission_assignees.user_id = ? AND missions.status = 'completed'
  `).bind(user.id).first<{ approved: number; total: number }>()

  const avgApproval = approvals && approvals.total > 0
    ? Math.round((approvals.approved / approvals.total) * 100)
    : 100

  // 4. Parse stickers
  const unlockedStickers = JSON.parse(profile.stickers ?? '[]') as string[]
  const stickers = ALL_STICKERS.map(sticker => ({
    ...sticker,
    unlocked: unlockedStickers.includes(sticker.code),
    unlockedAt: unlockedStickers.includes(sticker.code) ? new Date().toISOString() : undefined // Mocked date or just present
  }))

  // 5. Get organization level config if exists, otherwise fallback
  const orgSettings = await env.DB.prepare(`
    SELECT level_config AS levelConfig
    FROM organization_settings
    WHERE organization_id = ?
    LIMIT 1
  `).bind(user.organizationId).first<{ levelConfig: string }>()

  const levelConfig = orgSettings ? JSON.parse(orgSettings.levelConfig) : null

  return Response.json({
    profile: {
      ...profile,
      highlightColor: profile.highlightColor ?? '#c6ff38',
      internalNetworks: profile.internalNetworks ? JSON.parse(profile.internalNetworks) : {},
      stickers: unlockedStickers,
    },
    ranking: ranking.results,
    stickers,
    levelConfig,
    stats: {
      projectsDelivered: projectsDelivered?.count ?? 0,
      averageApproval: avgApproval
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
  const socialName = typeof input.socialName === 'string' ? input.socialName.trim().slice(0, 100) : null
  const customRole = typeof input.customRole === 'string' ? input.customRole.trim().slice(0, 100) : null
  const bio = typeof input.bio === 'string' ? input.bio.trim().slice(0, 1000) : null
  const highlightColor = typeof input.highlightColor === 'string' ? input.highlightColor.trim().slice(0, 20) : '#c6ff38'
  const bannerUrl = typeof input.bannerUrl === 'string' ? input.bannerUrl : null
  const internalNetworks = input.internalNetworks && typeof input.internalNetworks === 'object'
    ? JSON.stringify(input.internalNetworks)
    : '{}'
  const signature = typeof input.signature === 'string' ? input.signature.trim().slice(0, 2000) : null

  const now = new Date().toISOString()

  // Perform updates inside a transaction/batch
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
    params.push(user.id)
    statements.push(env.DB.prepare(updateUsersQuery).bind(...params))
  }

  statements.push(env.DB.prepare(`
    UPDATE gamification_profiles
    SET 
      social_name = ?,
      custom_role = ?,
      bio = ?,
      highlight_color = ?,
      banner_url = ?,
      internal_networks = ?,
      signature = ?,
      updated_at = ?
    WHERE user_id = ?
  `).bind(socialName, customRole, bio, highlightColor, bannerUrl, internalNetworks, signature, now, user.id))

  await env.DB.batch(statements)

  return Response.json({ success: true })
}
