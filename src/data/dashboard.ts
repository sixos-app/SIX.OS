export type MissionTone = 'lime' | 'purple' | 'orange'

export type Mission = {
  id: string
  title: string
  client: string
  deadline: string
  xp: number
  ideas: number
  tone: MissionTone
  urgent?: boolean
}

export type DashboardData = {
  profile: {
    xp: number
    ideas: number
    level: string
  }
  missions: Mission[]
}

export const dashboardSeed: DashboardData = {
  profile: {
    xp: 8420,
    ideas: 1280,
    level: 'Criador',
  },
  missions: [
    {
      id: 'mission-kv-dia-dos-pais',
      title: 'Key Visual Dia dos Pais',
      client: 'Shopping Uberaba',
      deadline: 'Hoje · 17h',
      xp: 120,
      ideas: 30,
      tone: 'lime',
      urgent: true,
    },
    {
      id: 'mission-roteiro-manifesto',
      title: 'Roteiro de vídeo manifesto',
      client: 'Sicredi',
      deadline: 'Amanhã · 10h',
      xp: 95,
      ideas: 20,
      tone: 'purple',
    },
    {
      id: 'mission-conceito-primavera',
      title: 'Conceito campanha Primavera',
      client: 'Rádio Cultura',
      deadline: 'Amanhã · 15h',
      xp: 80,
      ideas: 15,
      tone: 'orange',
    },
  ],
}
