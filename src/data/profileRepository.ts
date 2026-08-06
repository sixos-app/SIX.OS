export type NetworkConfig = {
  github?: string
  linkedin?: string
  slack?: string
  instagram?: string
}

export type Sticker = {
  code: string
  name: string
  imageUrl: string
  description: string
  unlocked?: boolean
  unlockedAt?: string
}

export type UserProfile = {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
  socialName: string | null
  customRole: string | null
  bio: string | null
  highlightColor: string
  bannerUrl: string | null
  internalNetworks: NetworkConfig | null
  signature: string | null
  xp: number
  ideas: number
  level: string
  streakDays: number
  stickers: string[]
}

export type ProfileData = {
  profile: UserProfile
  ranking: {
    id: string
    name: string
    socialName: string | null
    xp: number
    level: string
    avatarUrl: string | null
  }[]
  stickers: Sticker[]
  levelConfig: { name: string; target: number; detail: string }[] | null
  stats: {
    projectsDelivered: number
    averageApproval: number
  }
}

export type LevelConfigItem = {
  name: string
  target: number
  detail: string
}

export type RewardConfigItem = {
  id: string
  title: string
  xpCost: number
}

export type GamificationConfig = {
  xpMultiplier: number
  levelConfig: LevelConfigItem[]
  rewardsConfig: RewardConfigItem[]
}

const DEFAULT_FALLBACK_PROFILE_DATA: ProfileData = {
  profile: {
    id: 'user-agsix-admin',
    name: 'Administração SIX',
    email: 'agsix@sixos.app',
    role: 'admin',
    avatarUrl: null,
    socialName: 'Guilherme',
    customRole: 'Administrador da Agência',
    bio: 'Coordenando operações e transformando estratégia em entregas extraordinárias no SIX.OS.',
    highlightColor: '#c6ff38',
    bannerUrl: null,
    internalNetworks: { slack: '@agsix', linkedin: 'agenciasix' },
    signature: 'Administração SIX · SIX.OS',
    xp: 12450,
    ideas: 18,
    level: 'Visionário',
    streakDays: 5,
    stickers: ['speed', 'perfect-score', 'streak-3']
  },
  ranking: [
    { id: 'user-agsix-admin', name: 'Administração SIX', socialName: 'Guilherme', xp: 12450, level: 'Visionário', avatarUrl: null },
    { id: 'team-guilherme', name: 'Guilherme Silva', socialName: 'Gui', xp: 9800, level: 'Visionário', avatarUrl: null },
    { id: 'team-lorraine', name: 'Lorraine Souza', socialName: 'Lori', xp: 7500, level: 'Criador', avatarUrl: null },
    { id: 'team-marcos', name: 'Marcos Oliveira', socialName: 'Marcos', xp: 6200, level: 'Criador', avatarUrl: null }
  ],
  stickers: [
    { code: 'speed', name: 'Ritmo Veloz', description: 'Concluiu uma missão em menos de 24h.', imageUrl: '⚡', unlocked: true },
    { code: 'perfect-score', name: 'Entrega Perfeita', description: 'Aprovado sem nenhuma refação.', imageUrl: '✨', unlocked: true },
    { code: 'night-owl', name: 'Coruja da Noite', description: 'Missão concluída após as 22h.', imageUrl: '🦉', unlocked: false },
    { code: 'organizer', name: 'Mestre da Organização', description: 'Criou ou organizou 10 checklists.', imageUrl: '📋', unlocked: false },
    { code: 'streak-3', name: 'Fogo Sagrado', description: 'Manteve 3 dias seguidos de streak.', imageUrl: '🔥', unlocked: true },
    { code: 'streak-7', name: 'Inabalável', description: 'Manteve 7 dias seguidos de streak.', imageUrl: '🛡️', unlocked: false }
  ],
  levelConfig: [
    { name: 'Criador', target: 0, detail: 'Transforma intenção em entrega.' },
    { name: 'Visionário', target: 8700, detail: 'Enxerga possibilidades antes do óbvio.' },
    { name: 'Catalisador', target: 12000, detail: 'Move pessoas e ideias para a frente.' }
  ],
  stats: {
    projectsDelivered: 4,
    averageApproval: 98
  }
}

export async function getProfileData(): Promise<ProfileData> {
  try {
    const response = await fetch('/api/profile', { headers: { Accept: 'application/json' } })
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json() as ProfileData
      if (data && data.profile) return data
    }
  } catch {}

  const stored = localStorage.getItem('sixos_custom_profile_data')
  if (stored) {
    try {
      return JSON.parse(stored) as ProfileData
    } catch {}
  }

  return DEFAULT_FALLBACK_PROFILE_DATA
}

export async function updateProfile(input: Partial<UserProfile>): Promise<void> {
  try {
    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })
    if (response.ok) return
  } catch {}

  // Local state update fallback
  const current = await getProfileData()
  const updated: ProfileData = {
    ...current,
    profile: {
      ...current.profile,
      ...input
    }
  }
  localStorage.setItem('sixos_custom_profile_data', JSON.stringify(updated))
}

export async function getGamificationConfig(): Promise<GamificationConfig> {
  try {
    const response = await fetch('/api/admin/gamification', { headers: { Accept: 'application/json' } })
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      return await response.json() as GamificationConfig
    }
  } catch {}

  return {
    xpMultiplier: 1.0,
    levelConfig: [
      { name: 'Criador', target: 0, detail: 'Transforma intenção em entrega.' },
      { name: 'Visionário', target: 8700, detail: 'Enxerga possibilidades antes do óbvio.' },
      { name: 'Catalisador', target: 12000, detail: 'Move pessoas e ideias para a frente.' }
    ],
    rewardsConfig: [
      { id: 'reward-1', title: 'Kudos no Feed', xpCost: 100 },
      { id: 'reward-2', title: 'Adesivo Personalizado', xpCost: 500 },
      { id: 'reward-3', title: 'Folga de Meio Período', xpCost: 2000 }
    ]
  }
}

export async function updateGamificationConfig(input: GamificationConfig): Promise<GamificationConfig> {
  try {
    const response = await fetch('/api/admin/gamification', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      return await response.json() as GamificationConfig
    }
  } catch {}

  return input
}
