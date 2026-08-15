export type MissionTone = 'lime' | 'purple' | 'orange'

export type Mission = {
  id: string
  title: string
  client: string
  projectId?: string
  assigneeId?: string
  deadline: string
  dueAt?: string | null
  xp: number
  ideas: number
  tone: MissionTone
  urgent?: boolean
  status?: 'open' | 'in_progress' | 'completed'
  approvalStatus?: 'not_requested' | 'pending' | 'approved'
  xpRecipientUserId?: string | null
  xpRecipientName?: string | null
  currentDepartment?: string | null
  nextDepartment?: string | null
  currentResponsibleUserId?: string | null
  currentResponsibleName?: string | null
  nextResponsibleUserId?: string | null
  nextResponsibleName?: string | null
  currentWorkflowPosition?: number
  workflowDepartments?: string[]
  workflowResponsibleNames?: string[]
  canAdvanceWorkflow?: boolean
  canReturnWorkflow?: boolean
  boardId?: string | null
  stageId?: string | null
  stageName?: string | null
  stageType?: 'backlog' | 'ready' | 'doing' | 'review' | 'approval' | 'done' | null
  stageColor?: 'lime' | 'purple' | 'orange' | 'neutral' | null
  startedAt?: string | null
  activeTimerStartedAt?: string | null
}

export type ActiveMissionTimer = {
  id: string
  missionId: string
  missionTitle: string
  startedAt: string
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
  dueAt?: string | null
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
  department?: string | null
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
  profile: { xp: number; ideas: number; level: string }
  missions: Mission[]
  projects: Project[]
  agenda: AgendaEvent[]
  team: TeamMember[]
  analytics: AnalyticsData
  library: LibraryResource[]
  notifications: AppNotification[]
  activeTimer: ActiveMissionTimer | null
}

export const emptyDashboard: DashboardData = {
  profile: { xp: 0, ideas: 0, level: 'Criador' },
  missions: [],
  projects: [],
  agenda: [],
  team: [],
  analytics: {
    weekly: [
      { label: 'SEG', xp: 0, focus: 0 },
      { label: 'TER', xp: 0, focus: 0 },
      { label: 'QUA', xp: 0, focus: 0 },
      { label: 'QUI', xp: 0, focus: 0 },
      { label: 'SEX', xp: 0, focus: 0 },
      { label: 'SÁB', xp: 0, focus: 0 },
      { label: 'DOM', xp: 0, focus: 0 },
    ],
    streak: 0,
    deliveryRate: 0,
  },
  library: [],
  notifications: [],
  activeTimer: null,
}
