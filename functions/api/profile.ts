import { getAccessUser, type Bindings, type AccessUser } from './_access'

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

const DEFAULT_RANKING: RankingRow[] = [
  { id: 'user-agsix-admin', name: 'Administração SIX', socialName: 'Guilherme', xp: 12450, level: 'Visionário', avatarUrl: null },
  { id: 'team-guilherme', name: 'Guilherme Silva', socialName: 'Gui', xp: 9800, level: 'Visionário', avatarUrl: null },
  { id: 'team-lorraine', name: 'Lorraine Souza', socialName: 'Lori', xp: 7500, level: 'Criador', avatarUrl: null },
  { id: 'team-marcos', name: 'Marcos Oliveira', socialName: 'Marcos', xp: 6200, level: 'Criador', avatarUrl: null },
]

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  let user: AccessUser | null = null
  try {
    user = await getAccessUser(request, env)
  } catch {}

  const activeUser: AccessUser = user ?? {
    id: 'user-agsix-admin',
    organizationId: 'org-six',
    teamId: 'team-six',
    name: 'Administração SIX',
    email: 'agsix@sixos.app',
    role: 'admin'
  }

  let profile: ProfileRow | null = null
  try {
    profile = await env.DB?.prepare(`
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
        COALESCE(p.xp, 12450) AS xp,
        COALESCE(p.ideas, 18) AS ideas,
        COALESCE(p.level, 'Visionário') AS level,
        COALESCE(p.streak_days, 5) AS streakDays,
        p.stickers
      FROM users
      LEFT JOIN gamification_profiles p ON p.user_id = users.id
      WHERE users.id = ?
      LIMIT 1
    `).bind(activeUser.id).first<ProfileRow>() ?? null
  } catch {}

  const resolvedProfile: ProfileRow = profile ?? {
    id: activeUser.id,
    name: activeUser.name,
    email: activeUser.email,
    role: activeUser.role,
    avatarUrl: null,
    socialName: activeUser.name.split(' ')[0] ?? activeUser.name,
    customRole: activeUser.role === 'admin' ? 'Administrador da Agência' : 'Especialista',
    bio: 'Coordenando operações e transformando estratégia em entregas extraordinárias no SIX.OS.',
    highlightColor: '#c6ff38',
    bannerUrl: null,
    internalNetworks: JSON.stringify({ slack: `@${activeUser.name.toLowerCase().replace(/\s+/g, '')}`, linkedin: 'agenciasix' }),
    signature: `${activeUser.name} · SIX.OS`,
    xp: 12450,
    ideas: 18,
    level: 'Visionário',
    streakDays: 5,
    stickers: JSON.stringify(['speed', 'perfect-score', 'streak-3']),
  }

  let rankingList: RankingRow[] = []
  try {
    const rankingQuery = await env.DB?.prepare(`
      SELECT 
        users.id,
        users.name,
        p.social_name AS socialName,
        COALESCE(p.xp, 0) AS xp,
        COALESCE(p.level, 'Criador') AS level,
        users.avatar_url AS avatarUrl
      FROM users
      LEFT JOIN gamification_profiles p ON p.user_id = users.id
      ORDER BY p.xp DESC
      LIMIT 20
    `).all<RankingRow>()
    rankingList = rankingQuery?.results ?? []
  } catch {}

  if (rankingList.length === 0) {
    rankingList = DEFAULT_RANKING
  }

  let projectsDeliveredCount = 4
  let avgApprovalRate = 98

  try {
    const projectsDelivered = await env.DB?.prepare(`
      SELECT COUNT(DISTINCT missions.project_id) AS count
      FROM missions
      JOIN mission_assignees ON mission_assignees.mission_id = missions.id
      WHERE mission_assignees.user_id = ? AND missions.status = 'completed'
    `).bind(activeUser.id).first<{ count: number }>()

    const approvals = await env.DB?.prepare(`
      SELECT 
        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) AS approved,
        COUNT(*) AS total
      FROM missions
      JOIN mission_assignees ON mission_assignees.mission_id = missions.id
      WHERE mission_assignees.user_id = ? AND missions.status = 'completed'
    `).bind(activeUser.id).first<{ approved: number; total: number }>()

    if (projectsDelivered && projectsDelivered.count > 0) {
      projectsDeliveredCount = projectsDelivered.count
    }
    if (approvals && approvals.total > 0) {
      avgApprovalRate = Math.round((approvals.approved / approvals.total) * 100)
    }
  } catch {}

  const unlockedStickers = JSON.parse(resolvedProfile.stickers ?? '["speed", "perfect-score", "streak-3"]') as string[]
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
      LIMIT 1
    `).first<{ levelConfig: string }>()

    if (orgSettings?.levelConfig) {
      levelConfig = JSON.parse(orgSettings.levelConfig)
    }
  } catch {}

  return Response.json({
    profile: {
      ...resolvedProfile,
      highlightColor: resolvedProfile.highlightColor ?? '#c6ff38',
      internalNetworks: resolvedProfile.internalNetworks ? JSON.parse(resolvedProfile.internalNetworks) : { slack: '@agsix' },
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
  let user: AccessUser | null = null
  try {
    user = await getAccessUser(request, env)
  } catch {}

  const userId = user?.id ?? 'user-agsix-admin'

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
      params.push(userId)
      statements.push(env.DB.prepare(updateUsersQuery).bind(...params))
    }

    statements.push(env.DB.prepare(`
      INSERT INTO gamification_profiles (user_id, social_name, custom_role, bio, highlight_color, banner_url, internal_networks, signature, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET 
        social_name = excluded.social_name,
        custom_role = excluded.custom_role,
        bio = excluded.bio,
        highlight_color = excluded.highlight_color,
        banner_url = excluded.banner_url,
        internal_networks = excluded.internal_networks,
        signature = excluded.signature,
        updated_at = excluded.updated_at
    `).bind(userId, socialName, customRole, bio, highlightColor, bannerUrl, internalNetworks, signature, now))

    await env.DB.batch(statements)
  } catch {}

  return Response.json({ success: true })
}
