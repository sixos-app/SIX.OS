export type MissionTone = 'lime' | 'purple' | 'orange'

export type Mission = {
  id: string
  title: string
  client: string
  projectId?: string
  assigneeId?: string
  deadline: string
  xp: number
  ideas: number
  tone: MissionTone
  urgent?: boolean
  status?: 'open' | 'in_progress' | 'completed'
  approvalStatus?: 'not_requested' | 'pending' | 'approved'
}

export type ProjectTone = 'purple' | 'lime' | 'orange'

export type Project = {
  id: string
  code: string
  name: string
  client: string
  status: string
  progress: number
  deadline: string
  tone: ProjectTone
  members: string[]
  nextStep: string
  activity: string
  clientImageUrl?: string | null
}

export type AgendaEvent = {
  id: string
  time: string
  title: string
  subtitle: string
  day: 'Hoje' | 'Amanhã'
  category: 'Reunião' | 'Criação' | 'Entrega'
  tone: MissionTone
  duration: string
  attendees: string[]
  description: string
}

export type TeamMember = {
  id: string
  name: string
  initials: string
  role: string
  availability: 'Disponível' | 'Em foco' | 'No limite'
  capacity: number
  focus: string
  projects: string[]
  tone: 'dark' | 'lime' | 'purple' | 'photo'
  note: string
}

export type AnalyticsPoint = {
  label: string
  xp: number
  focus: number
}

export type AnalyticsData = {
  weekly: AnalyticsPoint[]
  streak: number
  deliveryRate: number
}

export type LibraryResource = {
  id: string
  title: string
  type: 'Referência' | 'Modelo' | 'Playbook' | 'Documento'
  description: string
  updatedAt: string
  owner: string
  tone: 'lime' | 'purple' | 'orange'
  tags: string[]
}

export type AppNotification = {
  id: string
  title: string
  description: string
  time: string
  category: 'Projeto' | 'Agenda' | 'Equipe'
  tone: 'lime' | 'purple' | 'orange'
}

export type DashboardData = {
  profile: {
    xp: number
    ideas: number
    level: string
  }
  missions: Mission[]
  projects: Project[]
  agenda: AgendaEvent[]
  team: TeamMember[]
  analytics: AnalyticsData
  library: LibraryResource[]
  notifications: AppNotification[]
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
      projectId: 'project-shopping-uberaba',
      assigneeId: 'team-guilherme',
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
      projectId: 'project-sicredi',
      assigneeId: 'team-mateus',
      deadline: 'Amanhã · 10h',
      xp: 95,
      ideas: 20,
      tone: 'purple',
    },
    {
      id: 'mission-conceito-primavera',
      title: 'Conceito campanha Primavera',
      client: 'Rádio Cultura',
      projectId: 'project-radio-cultura',
      assigneeId: 'team-lorraine',
      deadline: 'Amanhã · 15h',
      xp: 80,
      ideas: 15,
      tone: 'orange',
    },
  ],
  projects: [
    {
      id: 'project-shopping-uberaba',
      code: 'SHO',
      name: 'Shopping Uberaba',
      client: 'Shopping Uberaba',
      status: 'EM APROVAÇÃO',
      progress: 85,
      deadline: 'Entrega hoje · 17h',
      tone: 'purple',
      members: ['LM', 'VA', 'GS'],
      nextStep: 'Consolidar os desdobramentos aprovados para o KV de Dia dos Pais.',
      activity: 'Lorraine enviou uma nova versão para aprovação há 18 min.',
    },
    {
      id: 'project-sicredi',
      code: 'SIC',
      name: 'Sicredi',
      client: 'Sicredi',
      status: 'EM PRODUÇÃO',
      progress: 58,
      deadline: 'Próximo marco · Amanhã, 10h',
      tone: 'lime',
      members: ['MP', 'GS', 'RV'],
      nextStep: 'Finalizar roteiro do vídeo manifesto e alinhar a locução.',
      activity: 'Mateus concluiu os desdobramentos de campanha há 12 min.',
    },
    {
      id: 'project-radio-cultura',
      code: 'RDC',
      name: 'Rádio Cultura',
      client: 'Rádio Cultura',
      status: 'EM CONCEPÇÃO',
      progress: 34,
      deadline: 'Próximo marco · Amanhã, 15h',
      tone: 'orange',
      members: ['GS', 'LM', 'CB'],
      nextStep: 'Definir território visual e apresentar três caminhos criativos.',
      activity: 'O briefing criativo foi revisado pela equipe há 1 h.',
    },
  ],
  agenda: [
    {
      id: 'agenda-briefing-shopping',
      time: '10:00',
      title: 'Reunião de briefing',
      subtitle: 'Shopping Uberaba',
      day: 'Hoje',
      category: 'Reunião',
      tone: 'purple',
      duration: '45 min',
      attendees: ['GS', 'LM', 'VA'],
      description: 'Alinhamento final do briefing e das expectativas para a campanha de Dia dos Pais.',
    },
    {
      id: 'agenda-revisao-manifesto',
      time: '11:30',
      title: 'Revisão do manifesto',
      subtitle: 'Sicredi · Sala Norte',
      day: 'Hoje',
      category: 'Criação',
      tone: 'lime',
      duration: '30 min',
      attendees: ['GS', 'MP', 'RV'],
      description: 'Refinar o argumento central e validar a narrativa do vídeo manifesto.',
    },
    {
      id: 'agenda-toro-ideias',
      time: '14:30',
      title: 'Toró de ideias',
      subtitle: 'Sala Criativa · 8 pessoas',
      day: 'Hoje',
      category: 'Criação',
      tone: 'lime',
      duration: '1 h',
      attendees: ['GS', 'LM', 'MP', 'CB'],
      description: 'Explorar territórios para a campanha de Primavera da Rádio Cultura.',
    },
    {
      id: 'agenda-entrega-kv',
      time: '17:00',
      title: 'Entrega do KV',
      subtitle: 'Shopping Uberaba',
      day: 'Hoje',
      category: 'Entrega',
      tone: 'orange',
      duration: '15 min',
      attendees: ['GS', 'VA'],
      description: 'Enviar o Key Visual de Dia dos Pais e registrar os próximos desdobramentos.',
    },
    {
      id: 'agenda-apresentacao-primavera',
      time: '15:00',
      title: 'Apresentação de caminhos',
      subtitle: 'Rádio Cultura',
      day: 'Amanhã',
      category: 'Reunião',
      tone: 'purple',
      duration: '1 h',
      attendees: ['GS', 'LM', 'CB'],
      description: 'Apresentar os primeiros caminhos visuais e receber retornos do cliente.',
    },
  ],
  team: [
    {
      id: 'team-guilherme',
      name: 'Guilherme',
      initials: 'GS',
      role: 'Designer & Direção Criativa',
      availability: 'Em foco',
      capacity: 78,
      focus: 'Key Visual Dia dos Pais',
      projects: ['Shopping Uberaba', 'Sicredi', 'Rádio Cultura'],
      tone: 'photo',
      note: 'Concentração em entregas de alto impacto nesta semana.',
    },
    {
      id: 'team-lorraine',
      name: 'Lorraine',
      initials: 'LM',
      role: 'Diretora de Arte',
      availability: 'Disponível',
      capacity: 54,
      focus: 'Aprovação do KV e desdobramentos',
      projects: ['Shopping Uberaba', 'Rádio Cultura'],
      tone: 'purple',
      note: 'Tem espaço para receber uma nova frente de criação.',
    },
    {
      id: 'team-mateus',
      name: 'Mateus',
      initials: 'MP',
      role: 'Redator',
      availability: 'Em foco',
      capacity: 72,
      focus: 'Roteiro de vídeo manifesto',
      projects: ['Sicredi', 'Rádio Cultura'],
      tone: 'lime',
      note: 'Avançando no argumento central do manifesto Sicredi.',
    },
    {
      id: 'team-vitoria',
      name: 'Vitória',
      initials: 'VA',
      role: 'Atendimento',
      availability: 'No limite',
      capacity: 94,
      focus: 'Aprovações e alinhamentos com cliente',
      projects: ['Shopping Uberaba', 'Sicredi'],
      tone: 'dark',
      note: 'Evite novas reuniões nesta janela para preservar o ritmo.',
    },
    {
      id: 'team-rafael',
      name: 'Rafael',
      initials: 'RV',
      role: 'Motion Designer',
      availability: 'Disponível',
      capacity: 41,
      focus: 'Estudos de movimento para o manifesto',
      projects: ['Sicredi'],
      tone: 'purple',
      note: 'Disponível para iniciar o animatic após a aprovação do roteiro.',
    },
  ],
  analytics: {
    weekly: [
      { label: 'Seg', xp: 180, focus: 64 },
      { label: 'Ter', xp: 240, focus: 78 },
      { label: 'Qua', xp: 125, focus: 52 },
      { label: 'Qui', xp: 310, focus: 88 },
      { label: 'Sex', xp: 270, focus: 81 },
      { label: 'Sáb', xp: 90, focus: 38 },
      { label: 'Hoje', xp: 215, focus: 92 },
    ],
    streak: 6,
    deliveryRate: 94,
  },
  library: [
    {
      id: 'library-brand-system-six',
      title: 'Sistema de marca SIX',
      type: 'Playbook',
      description: 'Princípios visuais, tom de voz e aplicações para manter a marca consistente.',
      updatedAt: 'Atualizado hoje',
      owner: 'Guilherme',
      tone: 'lime',
      tags: ['Marca', 'Direção', 'Essencial'],
    },
    {
      id: 'library-kv-briefing',
      title: 'Briefing de Key Visual',
      type: 'Modelo',
      description: 'Estrutura para transformar informações de campanha em uma direção visual clara.',
      updatedAt: 'Atualizado ontem',
      owner: 'Lorraine',
      tone: 'purple',
      tags: ['KV', 'Briefing', 'Criação'],
    },
    {
      id: 'library-moodboard-cultura',
      title: 'Moodboard · Primavera',
      type: 'Referência',
      description: 'Painel de referências para o território visual da Rádio Cultura.',
      updatedAt: 'Atualizado há 2 dias',
      owner: 'Guilherme',
      tone: 'orange',
      tags: ['Rádio Cultura', 'Moodboard', 'Campanha'],
    },
    {
      id: 'library-ritual-entregas',
      title: 'Ritual de entregas',
      type: 'Playbook',
      description: 'Checklist de qualidade, alinhamento e registro antes de cada entrega ao cliente.',
      updatedAt: 'Atualizado há 4 dias',
      owner: 'Vitória',
      tone: 'lime',
      tags: ['Processo', 'Qualidade', 'Atendimento'],
    },
    {
      id: 'library-manifesto-sicredi',
      title: 'Manifesto Sicredi · Roteiro',
      type: 'Documento',
      description: 'Documento vivo com narrativa, mensagens-chave e estrutura do vídeo manifesto.',
      updatedAt: 'Atualizado há 1 h',
      owner: 'Mateus',
      tone: 'purple',
      tags: ['Sicredi', 'Roteiro', 'Vídeo'],
    },
  ],
  notifications: [
    {
      id: 'notification-kv-approval',
      title: 'Novo retorno no KV',
      description: 'Shopping Uberaba enviou comentários para a aprovação do Key Visual.',
      time: 'agora',
      category: 'Projeto',
      tone: 'purple',
    },
    {
      id: 'notification-briefing',
      title: 'Briefing começa em 20 min',
      description: 'Prepare os pontos para a reunião de briefing com Shopping Uberaba.',
      time: '20 min',
      category: 'Agenda',
      tone: 'lime',
    },
    {
      id: 'notification-capacity',
      title: 'Atenção à capacidade',
      description: 'Vitória está com 94% da capacidade comprometida nesta semana.',
      time: '42 min',
      category: 'Equipe',
      tone: 'orange',
    },
  ],
}
