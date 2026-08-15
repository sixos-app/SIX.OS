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

export async function getProfileData(): Promise<ProfileData> {
  const response = await fetch('/api/profile', { headers: { Accept: 'application/json' } })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(response.status === 401 ? 'Sua sessão expirou' : 'Não foi possível carregar o perfil')
  }
  const data = await response.json() as ProfileData
  if (!data?.profile) throw new Error('Resposta inválida ao carregar o perfil')
  return data
}

export async function updateProfile(input: Partial<UserProfile>): Promise<void> {
  const response = await fetch('/api/profile', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  if (!response.ok) {
    const payload = response.headers.get('content-type')?.includes('application/json')
      ? await response.json() as { error?: string }
      : null
    throw new Error(payload?.error || 'Não foi possível atualizar o perfil')
  }
}

export async function getGamificationConfig(): Promise<GamificationConfig> {
  const response = await fetch('/api/admin/gamification', { headers: { Accept: 'application/json' } })
  const payload = response.headers.get('content-type')?.includes('application/json')
    ? await response.json() as GamificationConfig & { error?: string }
    : null
  if (!response.ok || !payload) throw new Error(payload?.error || 'Configuração de gamificação indisponível')
  return payload
}

export async function updateGamificationConfig(input: GamificationConfig): Promise<GamificationConfig> {
  const response = await fetch('/api/admin/gamification', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Não foi possível salvar a configuração de gamificação')
  }
  return await response.json() as GamificationConfig
}
