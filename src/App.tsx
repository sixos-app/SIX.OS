import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { dashboardSeed, type AgendaEvent, type AnalyticsData, type AppNotification, type DashboardData, type LibraryResource, type Mission, type Project, type TeamMember } from './data/dashboard'
import { getAccessSession, loginWithPassword, type AccessSession } from './data/accessRepository'
import { adminOverviewPreview, createAdminClient, createAdminUser, getAdminOverview, type AdminOverview, type CreateAdminUserInput } from './data/adminRepository'
import { clientIdentitySeed, getClientIdentities, type ClientIdentity } from './data/clientRepository'
import { getDashboard } from './data/dashboardRepository'
import { createProjectLibraryFolder, getProjectLibrary, projectLibrarySeed, uploadProjectLibraryFile, type ProjectLibrary } from './data/projectLibraryRepository'
import { createClientLibraryFolder, getClientLibrary, uploadClientLibraryFile } from './data/clientLibraryRepository'
import { addMissionChecklistItem, addMissionComment, attachProjectLibraryFile, createMission as persistMissionCreate, getMissionDetails, requestMissionCompletion, setMissionChecklistItem, updateMission as persistMissionUpdate, type MissionDetails } from './data/missionRepository'

type IconName =
  | 'home'
  | 'calendar'
  | 'folder'
  | 'target'
  | 'people'
  | 'sparkle'
  | 'library'
  | 'chart'

const navigation: { id: string; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Início', icon: 'home' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'projects', label: 'Projetos', icon: 'folder' },
  { id: 'missions', label: 'Missões', icon: 'target' },
  { id: 'team', label: 'Equipe', icon: 'people' },
  { id: 'library', label: 'Biblioteca', icon: 'library' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
]

const sectionLabels: Record<string, string> = {
  agenda: 'Agenda compartilhada',
  projects: 'Projetos em movimento',
  missions: 'Missões da equipe',
  team: 'Nossa equipe',
  library: 'Biblioteca SIX',
  analytics: 'Analytics',
}

const completedMissionsStorageKey = 'six-os:completed-missions'
const readNotificationsStorageKey = 'six-os:read-notifications'
const customMissionsStorageKey = 'six-os:custom-missions'
const customProjectsStorageKey = 'six-os:custom-projects'
const missionAssigneesStorageKey = 'six-os:mission-assignees'
const missionEditsStorageKey = 'six-os:mission-edits'
const projectEditsStorageKey = 'six-os:project-edits'

function deadlineToMissionDate(value: string) {
  const directDate = Date.parse(value)
  if (!Number.isNaN(directDate)) return new Date(directDate).toISOString()
  const date = new Date()
  const time = value.match(/(\d{1,2})(?::(\d{2}))?\s*h?/i)
  if (value.toLocaleLowerCase('pt-BR').includes('amanhã')) date.setDate(date.getDate() + 1)
  if (time) date.setHours(Number(time[1]), Number(time[2] ?? 0), 0, 0)
  return date.toISOString()
}

function missionDateTimeInputValue(value: string) {
  const date = new Date(deadlineToMissionDate(value))
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function formatMissionDeadline(value: string) {
  const date = new Date(deadlineToMissionDate(value))
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const dateOnly = new Date(date); dateOnly.setHours(0, 0, 0, 0)
  if (dateOnly.getTime() === today.getTime()) return `Hoje · ${time}`
  if (dateOnly.getTime() === tomorrow.getTime()) return `Amanhã · ${time}`
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${time}`
}

function isMissionCompleted(mission: Mission, locallyCompleted: string[]) {
  return mission.status === 'completed' || locallyCompleted.includes(mission.id)
}

function getStoredCompletedMissions(): string[] {
  try {
    const storedMissions = window.localStorage.getItem(completedMissionsStorageKey)
    if (!storedMissions) return []

    const parsedMissions = JSON.parse(storedMissions)
    return Array.isArray(parsedMissions) && parsedMissions.every((missionId) => typeof missionId === 'string') ? parsedMissions : []
  } catch {
    return []
  }
}

function saveCompletedMissions(missionIds: string[]) {
  try {
    window.localStorage.setItem(completedMissionsStorageKey, JSON.stringify(missionIds))
  } catch {}
}

function getStoredReadNotifications(): string[] {
  try {
    const storedNotifications = window.localStorage.getItem(readNotificationsStorageKey)
    if (!storedNotifications) return []

    const parsedNotifications = JSON.parse(storedNotifications)
    return Array.isArray(parsedNotifications) && parsedNotifications.every((notificationId) => typeof notificationId === 'string') ? parsedNotifications : []
  } catch {
    return []
  }
}

function saveReadNotifications(notificationIds: string[]) {
  try {
    window.localStorage.setItem(readNotificationsStorageKey, JSON.stringify(notificationIds))
  } catch {}
}

function isStoredMission(value: unknown): value is Mission {
  if (!value || typeof value !== 'object') return false

  const mission = value as Partial<Mission>
  return typeof mission.id === 'string' && typeof mission.title === 'string' && typeof mission.client === 'string' && typeof mission.deadline === 'string' && typeof mission.xp === 'number' && typeof mission.ideas === 'number' && ['lime', 'purple', 'orange'].includes(mission.tone ?? '')
}

function getStoredCustomMissions(): Mission[] {
  try {
    const storedMissions = window.localStorage.getItem(customMissionsStorageKey)
    if (!storedMissions) return []

    const parsedMissions = JSON.parse(storedMissions)
    return Array.isArray(parsedMissions) ? parsedMissions.filter(isStoredMission) : []
  } catch {
    return []
  }
}

function saveCustomMissions(missions: Mission[]) {
  try {
    window.localStorage.setItem(customMissionsStorageKey, JSON.stringify(missions))
  } catch {}
}

function getStoredMissionAssignees(): Record<string, string> {
  try {
    const storedAssignees = window.localStorage.getItem(missionAssigneesStorageKey)
    if (!storedAssignees) return {}

    const parsedAssignees = JSON.parse(storedAssignees)
    if (!parsedAssignees || typeof parsedAssignees !== 'object' || Array.isArray(parsedAssignees)) return {}

    return Object.entries(parsedAssignees).reduce<Record<string, string>>((assignees, [missionId, assigneeId]) => {
      if (typeof assigneeId === 'string') assignees[missionId] = assigneeId
      return assignees
    }, {})
  } catch {
    return {}
  }
}

function saveMissionAssignees(assignees: Record<string, string>) {
  try {
    window.localStorage.setItem(missionAssigneesStorageKey, JSON.stringify(assignees))
  } catch {}
}

function getStoredMissionEdits(): Record<string, Partial<Mission>> {
  try {
    const storedEdits = window.localStorage.getItem(missionEditsStorageKey)
    if (!storedEdits) return {}

    const parsedEdits = JSON.parse(storedEdits)
    if (!parsedEdits || typeof parsedEdits !== 'object' || Array.isArray(parsedEdits)) return {}

    return Object.entries(parsedEdits).reduce<Record<string, Partial<Mission>>>((edits, [missionId, edit]) => {
      if (edit && typeof edit === 'object' && !Array.isArray(edit)) edits[missionId] = edit as Partial<Mission>
      return edits
    }, {})
  } catch {
    return {}
  }
}

function saveMissionEdits(edits: Record<string, Partial<Mission>>) {
  try {
    window.localStorage.setItem(missionEditsStorageKey, JSON.stringify(edits))
  } catch {}
}

function applyStoredMissionAssignees(missions: Mission[]) {
  const assignees = getStoredMissionAssignees()
  const edits = getStoredMissionEdits()
  return missions.map((mission) => ({ ...mission, ...(assignees[mission.id] ? { assigneeId: assignees[mission.id] } : {}), ...edits[mission.id] }))
}

function isStoredProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false

  const project = value as Partial<Project>
  return typeof project.id === 'string' && typeof project.code === 'string' && typeof project.name === 'string' && typeof project.client === 'string' && typeof project.status === 'string' && typeof project.progress === 'number' && typeof project.deadline === 'string' && ['purple', 'lime', 'orange'].includes(project.tone ?? '') && Array.isArray(project.members) && typeof project.nextStep === 'string' && typeof project.activity === 'string'
}

function getStoredCustomProjects(): Project[] {
  try {
    const storedProjects = window.localStorage.getItem(customProjectsStorageKey)
    if (!storedProjects) return []

    const parsedProjects = JSON.parse(storedProjects)
    return Array.isArray(parsedProjects) ? parsedProjects.filter(isStoredProject) : []
  } catch {
    return []
  }
}

function saveCustomProjects(projects: Project[]) {
  try {
    window.localStorage.setItem(customProjectsStorageKey, JSON.stringify(projects))
  } catch {}
}

function getStoredProjectEdits(): Record<string, Partial<Project>> {
  try {
    const storedEdits = window.localStorage.getItem(projectEditsStorageKey)
    if (!storedEdits) return {}

    const parsedEdits = JSON.parse(storedEdits)
    if (!parsedEdits || typeof parsedEdits !== 'object' || Array.isArray(parsedEdits)) return {}

    return Object.entries(parsedEdits).reduce<Record<string, Partial<Project>>>((edits, [projectId, edit]) => {
      if (edit && typeof edit === 'object' && !Array.isArray(edit)) edits[projectId] = edit as Partial<Project>
      return edits
    }, {})
  } catch {
    return {}
  }
}

function saveProjectEdits(edits: Record<string, Partial<Project>>) {
  try {
    window.localStorage.setItem(projectEditsStorageKey, JSON.stringify(edits))
  } catch {}
}

function applyStoredProjectEdits(projects: Project[]) {
  const edits = getStoredProjectEdits()
  return projects.map((project) => ({ ...project, ...edits[project.id] }))
}

function enrichProjectClientIdentity(project: Project, clients: ClientIdentity[]) {
  const client = clients.find((item) => item.name === project.client)
  if (!client) return project
  return { ...project, code: client.shortCode ?? project.code, clientImageUrl: client.imageUrl }
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="m19 5 2-2" /></>,
    people: <><path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" /><circle cx="9.5" cy="7" r="4" /><path d="M17 11a4 4 0 0 0 0-8M21 20v-1a4 4 0 0 0-3-3.87" /></>,
    sparkle: <path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Zm7 12 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" />,
    library: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-5 3 2 5-7" /></>,
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function Avatar({ initials, tone = 'dark', small = false }: { initials: string; tone?: 'dark' | 'lime' | 'purple' | 'photo'; small?: boolean }) {
  return <span className={`avatar avatar-${tone} ${small ? 'avatar-small' : ''}`}>{initials}</span>
}

function ClientMark({ project, className }: { project: Project; className: string }) {
  if (project.clientImageUrl) return <span className={`${className} client-mark has-image`}><img src={project.clientImageUrl} alt={`Perfil de ${project.client}`} /></span>
  return <span className={`${className} client-mark`}>{project.code}</span>
}

function getInitials(name: string) {
  return name.split(/\s+/).map((part) => part.charAt(0)).join('').slice(0, 2).toLocaleUpperCase('pt-BR') || 'SIX'
}

function getProjectCollaborators(project: Project, missions: Mission[], team: TeamMember[]) {
  const assigneeIds = new Set(missions.filter((mission) => mission.projectId === project.id).flatMap((mission) => mission.assigneeId ? [mission.assigneeId] : []))
  const assignedMembers = team.filter((member) => assigneeIds.has(member.id))
  return assignedMembers.length > 0 ? assignedMembers : team.filter((member) => project.members.includes(member.initials))
}

function getProjectHealth(project: Project, missions: Mission[], completed: string[]) {
  const projectMissions = missions.filter((mission) => mission.projectId === project.id)
  const openMissions = projectMissions.filter((mission) => !completed.includes(mission.id))
  if (projectMissions.length === 0) return { label: 'A INICIAR', tone: 'neutral' }
  if (openMissions.length === 0) return { label: 'CONCLUÍDO', tone: 'healthy' }
  if (openMissions.some((mission) => mission.urgent)) return { label: 'ATENÇÃO', tone: 'attention' }
  return { label: 'NO RITMO', tone: 'healthy' }
}

function LoginPreview() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const phrases = [
    'Tornar possível é viver o extraordinário.',
    'Ideias fortes merecem execução extraordinária.',
    'A próxima grande entrega começa por aqui.',
  ]
  const phrase = phrases[new Date().getDate() % phrases.length]

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedUsername = username.trim()

    if (!normalizedUsername || !password) {
      setMessage('Informe seu login e senha para continuar.')
      return
    }

    setIsSubmitting(true)
    setMessage('')
    const result = await loginWithPassword(normalizedUsername, password)
    setIsSubmitting(false)
    if (result.user) {
      window.location.assign('/')
      return
    }

    setMessage(result.error ?? 'Não foi possível entrar.')
  }

  return (
    <main className="login-preview">
      <a className="login-back" href="/">← Voltar ao app</a>
      <div className="login-preview-shell">
        <section className="login-art">
          <div className="login-brand">
            <span>SIX</span>
            <small>OS</small>
          </div>
          <p className="login-eyebrow">SISTEMA OPERACIONAL DA AGÊNCIA</p>
          <h1>Onde a operação encontra o <em>extraordinário.</em></h1>
          <p className="login-phrase">“{phrase}”</p>
          <div className="login-orbits" aria-hidden="true">
            <i className="login-orbit login-orbit-one" />
            <i className="login-orbit login-orbit-two" />
            <b>+</b>
          </div>
        </section>

        <section className="login-form-panel" aria-labelledby="login-title">
          <span className="login-panel-kicker">ACESSO SIX.OS</span>
          <h2 id="login-title">Entre para fazer o <em>impossível.</em></h2>
          <p>Use seu login profissional para acessar a operação da SIX.</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              <span>LOGIN OU E-MAIL</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="seu.login" />
            </label>
            <label>
              <span>SENHA</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Sua senha" />
            </label>
            <button className="login-primary-action" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : <>Continuar <span>→</span></>}</button>
          </form>
          {message && <p className="login-message" role="status">{message}</p>}
          <div className="login-divider"><span>OU, EM BREVE</span></div>
          <div className="login-provider-grid">
            <button className="login-provider-button" type="button" disabled>Google <small>EM BREVE</small></button>
            <button className="login-provider-button" type="button" disabled>Microsoft <small>EM BREVE</small></button>
          </div>
          <p className="login-notice">O acesso público de testes permanece ativo temporariamente. Esta entrada é destinada ao painel administrativo.</p>
        </section>
      </div>
    </main>
  )
}

export default function App() {
  const preview = new URLSearchParams(window.location.search).get('preview')

  if (preview === 'login') return <LoginPreview />
  if (preview === 'admin') return <AdminPage preview />
  return <AppShell />
}

function AppShell() {
  const [activeSection, setActiveSection] = useState('home')
  const [libraryProjectId, setLibraryProjectId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'today' | 'urgent'>('all')
  const [completed, setCompleted] = useState<string[]>(getStoredCompletedMissions)
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isJourneyOpen, setIsJourneyOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(getStoredReadNotifications)
  const [completionMessage, setCompletionMessage] = useState('')
  const [accessSession, setAccessSession] = useState<AccessSession | null>(null)
  const [clientIdentities, setClientIdentities] = useState<ClientIdentity[]>(clientIdentitySeed)
  const [dashboardData, setDashboardData] = useState(() => ({ ...dashboardSeed, missions: applyStoredMissionAssignees([...dashboardSeed.missions, ...getStoredCustomMissions()]), projects: applyStoredProjectEdits([...dashboardSeed.projects, ...getStoredCustomProjects()]) }))

  useEffect(() => {
    void getDashboard().then((dashboard) => setDashboardData({ ...dashboard, missions: applyStoredMissionAssignees([...dashboard.missions, ...getStoredCustomMissions()]), projects: applyStoredProjectEdits([...dashboard.projects, ...getStoredCustomProjects()]) }))
    void getAccessSession().then(setAccessSession)
    void getClientIdentities().then(setClientIdentities).catch(() => undefined)
  }, [])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsCommandOpen(true)
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const displayedMissions = useMemo(() => {
    if (filter === 'urgent') return dashboardData.missions.filter((mission) => mission.urgent)
    if (filter === 'today') return dashboardData.missions.filter((mission) => mission.deadline.startsWith('Hoje'))
    return dashboardData.missions
  }, [dashboardData.missions, filter])

  const projectsWithMissionProgress = useMemo(() => dashboardData.projects.map((project) => {
    const projectMissions = dashboardData.missions.filter((mission) => mission.projectId === project.id)
    if (projectMissions.length === 0) return enrichProjectClientIdentity(project, clientIdentities)

    const completedProjectMissions = projectMissions.filter((mission) => isMissionCompleted(mission, completed)).length
    const isComplete = completedProjectMissions === projectMissions.length

    return enrichProjectClientIdentity({
      ...project,
      progress: Math.round((completedProjectMissions / projectMissions.length) * 100),
      status: isComplete ? 'CONCLUÍDO' : project.status,
    }, clientIdentities)
  }), [clientIdentities, completed, dashboardData.missions, dashboardData.projects])

  const completedMissionIds = useMemo(() => Array.from(new Set([...completed, ...dashboardData.missions.filter((mission) => mission.status === 'completed').map((mission) => mission.id)])), [completed, dashboardData.missions])
  const earnedXp = completed.reduce((total, id) => total + (dashboardData.missions.find((mission) => mission.id === id && mission.status !== 'completed')?.xp ?? 0), 0)
  const totalXp = dashboardData.profile.xp + earnedXp
  const activeMissionCount = dashboardData.missions.filter((mission) => !isMissionCompleted(mission, completed)).length
  const operationalNotifications = useMemo<AppNotification[]>(() => {
    const urgentMissionNotifications = dashboardData.missions.filter((mission) => mission.urgent && !isMissionCompleted(mission, completed)).map((mission) => {
      const assignee = dashboardData.team.find((member) => member.id === mission.assigneeId)
      return { id: `alert-mission-${mission.id}`, title: `Missão urgente: ${mission.title}`, description: `${mission.client} · prazo ${mission.deadline}${assignee ? ` · ${assignee.name}` : ''}.`, time: 'agora', category: 'Projeto' as const, tone: 'orange' as const }
    })
    const projectNotifications = projectsWithMissionProgress.filter((project) => getProjectHealth(project, dashboardData.missions, completed).tone === 'attention').map((project) => ({ id: `alert-project-${project.id}`, title: `${project.name} precisa de atenção`, description: `Há uma missão urgente em andamento nesta frente.`, time: 'agora', category: 'Projeto' as const, tone: 'orange' as const }))
    return [...urgentMissionNotifications, ...projectNotifications, ...dashboardData.notifications]
  }, [completed, dashboardData.missions, dashboardData.notifications, dashboardData.team, projectsWithMissionProgress])
  const recentActivities = useMemo<AppNotification[]>(() => {
    const pendingActivities = dashboardData.missions.filter((mission) => !isMissionCompleted(mission, completed)).map((mission) => ({ id: `activity-open-${mission.id}`, title: `${mission.title} segue em andamento`, description: `${mission.client} · prazo ${mission.deadline}.`, time: mission.deadline, category: 'Projeto' as const, tone: mission.tone }))
    const completedActivities = dashboardData.missions.filter((mission) => isMissionCompleted(mission, completed)).map((mission) => ({ id: `activity-complete-${mission.id}`, title: `${mission.title} foi concluída`, description: `${mission.client} · +${mission.xp} XP para o time.`, time: 'concluída', category: 'Equipe' as const, tone: 'lime' as const }))
    return [...pendingActivities, ...completedActivities].slice(0, 5)
  }, [completed, dashboardData.missions])
  const unreadNotificationCount = operationalNotifications.filter((notification) => !readNotificationIds.includes(notification.id)).length

  function completeMission(id: string) {
    const mission = dashboardData.missions.find((item) => item.id === id)
    if (!mission || isMissionCompleted(mission, completed)) return
    const missionTitle = mission.title
    const missionXp = mission.xp
    const missionIdeas = mission.ideas

    function completeLocally() {
      const next = [...completed, id]
      setCompleted(next)
      saveCompletedMissions(next)
      setCompletionMessage(`+${missionXp} XP conquistados em ${missionTitle}.`)
    }

    void requestMissionCompletion(id).then((result) => {
      if (result.status === 'pending_approval') {
        setDashboardData((current) => ({ ...current, missions: current.missions.map((item) => item.id === id ? { ...item, status: 'in_progress', approvalStatus: 'pending' } : item) }))
        setCompletionMessage(`${missionTitle} foi enviada para aprovação.`)
        return
      }
      setDashboardData((current) => ({ ...current, profile: { ...current.profile, xp: current.profile.xp + missionXp, ideas: current.profile.ideas + missionIdeas }, missions: current.missions.map((item) => item.id === id ? { ...item, status: 'completed', approvalStatus: 'approved' } : item) }))
      setCompletionMessage(`${missionTitle} foi aprovada e liberou +${missionXp} XP.`)
    }).catch(() => {
      if (!accessSession) completeLocally()
      else setCompletionMessage('Não foi possível concluir a missão. Tente novamente.')
    })
  }

  function markNotificationRead(id: string) {
    if (readNotificationIds.includes(id)) return

    const next = [...readNotificationIds, id]
    setReadNotificationIds(next)
    saveReadNotifications(next)
  }

  function markAllNotificationsRead() {
    const next = operationalNotifications.map((notification) => notification.id)
    setReadNotificationIds(next)
    saveReadNotifications(next)
  }

  function createMission(input: { title: string; projectId: string; assigneeId: string; deadline: string; priority: 'normal' | 'urgent'; description?: string; files?: File[] }) {
    const project = dashboardData.projects.find((item) => item.id === input.projectId)
    if (!project) return
    const projectClient = project.client
    const projectId = project.id

    function addMission(missionId: string, persistLocally: boolean) {
      const mission: Mission = { id: missionId, title: input.title, client: projectClient, projectId, assigneeId: input.assigneeId, deadline: formatMissionDeadline(input.deadline), xp: input.priority === 'urgent' ? 120 : 80, ideas: input.priority === 'urgent' ? 30 : 20, tone: input.priority === 'urgent' ? 'orange' : 'purple', urgent: input.priority === 'urgent' }
      if (persistLocally) saveCustomMissions([...getStoredCustomMissions(), mission])
      setDashboardData((current) => ({ ...current, missions: [...current.missions, mission] }))
    }

    async function attachCreationFiles(missionId: string) {
      if (!input.files?.length) return
      const projectLibrary = await getProjectLibrary(projectId)
      const folderId = projectLibrary.folders.find((folder) => folder.slug === 'outros')?.id ?? projectLibrary.folders[0]?.id
      if (!folderId) throw new Error('Nenhuma pasta está disponível neste projeto.')
      await Promise.all(input.files.map(async (file) => { const uploaded = await uploadProjectLibraryFile({ projectId, folderId, file }); await attachProjectLibraryFile(missionId, uploaded.id) }))
    }

    void persistMissionCreate({ title: input.title, projectId: input.projectId, assigneeId: input.assigneeId, dueAt: deadlineToMissionDate(input.deadline), priority: input.priority, description: input.description, xpReward: input.priority === 'urgent' ? 120 : 80 }).then(async (saved) => {
      addMission(saved.id, false)
      try { await attachCreationFiles(saved.id); setCompletionMessage(`${input.title} foi criada, atribuída e os anexos foram enviados.`) } catch (error) { setCompletionMessage(error instanceof Error ? `${input.title} foi criada, mas os anexos falharam: ${error.message}` : `${input.title} foi criada e atribuída.`) }
    }).catch(() => {
      addMission(`mission-local-${Date.now()}`, true)
      setCompletionMessage('Missão criada localmente. Conecte uma sessão para persistir no D1.')
    })
  }

  function reassignMission(id: string, assigneeId: string) {
    const mission = dashboardData.missions.find((item) => item.id === id)
    const assignee = dashboardData.team.find((member) => member.id === assigneeId)
    if (!mission || !assignee) return
    const missionTitle = mission.title
    const assigneeName = assignee.name

    function applyReassignment(persistLocally: boolean) {
      const customMissions = getStoredCustomMissions()
      if (persistLocally && customMissions.some((item) => item.id === id)) saveCustomMissions(customMissions.map((item) => item.id === id ? { ...item, assigneeId } : item))
      else if (persistLocally) saveMissionEdits({ ...getStoredMissionEdits(), [id]: { ...getStoredMissionEdits()[id], assigneeId } })
      setDashboardData((current) => ({ ...current, missions: current.missions.map((item) => item.id === id ? { ...item, assigneeId } : item) }))
      setCompletionMessage(`${missionTitle} foi atribuída para ${assigneeName}.`)
    }
    void persistMissionUpdate(id, { assigneeId }).then(() => applyReassignment(false)).catch(() => applyReassignment(true))
  }

  function updateMission(id: string, input: { title: string; projectId: string; assigneeId: string; deadline: string; priority: 'normal' | 'urgent'; description?: string }) {
    const mission = dashboardData.missions.find((item) => item.id === id)
    const project = dashboardData.projects.find((item) => item.id === input.projectId)
    const assignee = dashboardData.team.find((member) => member.id === input.assigneeId)
    if (!mission || !project || !assignee) return
    const missionTitle = mission.title

    const missionUpdate: Partial<Mission> = {
      title: input.title,
      client: project.client,
      projectId: project.id,
      assigneeId: assignee.id,
      deadline: formatMissionDeadline(input.deadline),
      xp: input.priority === 'urgent' ? 120 : 80,
      ideas: input.priority === 'urgent' ? 30 : 20,
      tone: input.priority === 'urgent' ? 'orange' : 'purple',
      urgent: input.priority === 'urgent',
    }
    function applyUpdate(persistLocally: boolean) {
      const customMissions = getStoredCustomMissions()
      if (persistLocally && customMissions.some((item) => item.id === id)) saveCustomMissions(customMissions.map((item) => item.id === id ? { ...item, ...missionUpdate } : item))
      else if (persistLocally) { const storedEdits = getStoredMissionEdits(); saveMissionEdits({ ...storedEdits, [id]: { ...storedEdits[id], ...missionUpdate } }) }
      setDashboardData((current) => ({ ...current, missions: current.missions.map((item) => item.id === id ? { ...item, ...missionUpdate } : item) }))
      setCompletionMessage(`${missionTitle} foi atualizada.`)
    }
    void persistMissionUpdate(id, { title: input.title, projectId: input.projectId, assigneeId: input.assigneeId, dueAt: deadlineToMissionDate(input.deadline), priority: input.priority, description: input.description, xpReward: missionUpdate.xp }).then(() => applyUpdate(false)).catch(() => applyUpdate(true))
  }

  function createProject(input: { name: string; client: string; deadline: string; tone: Project['tone'] }) {
    const clientIdentity = clientIdentities.find((item) => item.name === input.client)
    const code = clientIdentity?.shortCode ?? (input.client.split(/\s+/).map((part) => part.charAt(0)).join('').toLocaleUpperCase('pt-BR').slice(0, 6) || 'NEW')
    const project: Project = {
      id: `project-local-${Date.now()}`,
      code,
      name: input.name,
      client: input.client,
      status: 'EM CONCEPÇÃO',
      progress: 5,
      deadline: input.deadline,
      tone: input.tone,
      members: ['GS'],
      nextStep: 'Definir a primeira direção e organizar o briefing inicial.',
      activity: 'Projeto criado agora e pronto para receber as primeiras missões.',
      clientImageUrl: clientIdentity?.imageUrl,
    }
    const nextCustomProjects = [...getStoredCustomProjects(), project]

    saveCustomProjects(nextCustomProjects)
    setDashboardData((current) => ({ ...current, projects: [...current.projects, project] }))
  }

  function updateProjectLifecycle(id: string, input: { status: string; deadline: string; nextStep: string }) {
    const project = dashboardData.projects.find((item) => item.id === id)
    if (!project) return

    const projectUpdate: Partial<Project> = { status: input.status, deadline: input.deadline, nextStep: input.nextStep, activity: 'Ciclo do projeto atualizado agora.' }
    const customProjects = getStoredCustomProjects()
    if (customProjects.some((item) => item.id === id)) {
      saveCustomProjects(customProjects.map((item) => item.id === id ? { ...item, ...projectUpdate } : item))
    } else {
      const storedEdits = getStoredProjectEdits()
      saveProjectEdits({ ...storedEdits, [id]: { ...storedEdits[id], ...projectUpdate } })
    }

    setDashboardData((current) => ({ ...current, projects: current.projects.map((item) => item.id === id ? { ...item, ...projectUpdate } : item) }))
    setCompletionMessage(`${project.name} teve seu ciclo atualizado.`)
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActiveSection('home')} aria-label="Voltar ao início">
          <span className="brand-mark">SIX<span>.</span></span>
          <span className="brand-os">OS</span>
        </button>

        <nav className="main-nav" aria-label="Navegação principal">
          <p className="nav-caption">SEU ESPAÇO</p>
          {navigation.slice(0, 5).map((item) => (
            <button className={`nav-item ${activeSection === item.id ? 'active' : ''}`} key={item.id} onClick={() => setActiveSection(item.id)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === 'missions' && activeMissionCount > 0 && <b>{activeMissionCount}</b>}
            </button>
          ))}
          <p className="nav-caption nav-caption-lower">ECOSSISTEMA</p>
          {navigation.slice(5).map((item) => (
            <button className={`nav-item ${activeSection === item.id ? 'active' : ''}`} key={item.id} onClick={() => setActiveSection(item.id)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
          {accessSession?.role === 'admin' && <>
            <p className="nav-caption nav-caption-lower">GESTÃO</p>
            <button className={`nav-item ${activeSection === 'admin' ? 'active' : ''}`} onClick={() => setActiveSection('admin')}>
              <Icon name="people" />
              <span>Administração</span>
            </button>
          </>}
        </nav>

        <button className="ai-prompt" onClick={() => setIsAiOpen(true)}>
          <span className="ai-spark"><Icon name="sparkle" size={16} /></span>
          <span><b>SIX AI</b><small>Pergunte qualquer coisa</small></span>
          <span className="arrow">↗</span>
        </button>

        <button className="account">
          <Avatar initials={accessSession ? getInitials(accessSession.name) : 'GS'} tone="photo" small />
          <span><b>{accessSession?.name ?? 'Guilherme'}</b><small>{accessSession ? accessSession.role === 'admin' ? 'Administrador' : 'Sessão SIX' : 'Modo local'}</small></span>
          <span>•••</span>
        </button>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <div className="crumb"><span>Segunda-feira</span><i /> <strong>04 de agosto</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => setIsCommandOpen(true)} aria-label="Pesquisar">⌘ K</button>
            <button className="round-button" onClick={() => setIsNotificationsOpen(true)} aria-label="Notificações">⌁{unreadNotificationCount > 0 && <span />}</button>
            <button className="date-chip">Hoje <span>⌄</span></button>
          </div>
        </header>

        {activeSection === 'home' ? (
          <Dashboard
            filter={filter}
            onFilterChange={setFilter}
            missions={displayedMissions}
            completed={completedMissionIds}
            onComplete={completeMission}
            totalXp={totalXp}
            onViewMissions={() => setActiveSection('missions')}
            projects={projectsWithMissionProgress}
            projectMissions={dashboardData.missions}
            team={dashboardData.team}
            onViewProjects={() => setActiveSection('projects')}
            agenda={dashboardData.agenda}
            onViewAgenda={() => setActiveSection('agenda')}
            onOpenJourney={() => setIsJourneyOpen(true)}
          />
        ) : activeSection === 'missions' ? (
          <MissionsPage
            missions={dashboardData.missions}
            completed={completedMissionIds}
            onComplete={completeMission}
            totalXp={totalXp}
            baseXp={dashboardData.profile.xp}
            onCreateMission={createMission}
            projects={projectsWithMissionProgress}
            team={dashboardData.team}
            onReassignMission={reassignMission}
            onUpdateMission={updateMission}
          />
        ) : activeSection === 'projects' ? (
          <ProjectsPage projects={projectsWithMissionProgress} clients={clientIdentities} initialSelectedProjectId={libraryProjectId} missions={dashboardData.missions} completed={completedMissionIds} team={dashboardData.team} onCreateProject={createProject} onCreateMission={createMission} onUpdateProjectLifecycle={updateProjectLifecycle} />
        ) : activeSection === 'agenda' ? (
          <AgendaPage events={dashboardData.agenda} missions={dashboardData.missions} projects={projectsWithMissionProgress} team={dashboardData.team} completed={completedMissionIds} />
        ) : activeSection === 'team' ? (
          <TeamPage members={dashboardData.team} missions={dashboardData.missions} projects={projectsWithMissionProgress} completed={completedMissionIds} />
        ) : activeSection === 'analytics' ? (
          <AnalyticsPage analytics={dashboardData.analytics} projects={projectsWithMissionProgress} missions={dashboardData.missions} team={dashboardData.team} completed={completedMissionIds} totalXp={totalXp} baseXp={dashboardData.profile.xp} />
        ) : activeSection === 'library' ? (
          <LibraryPage resources={dashboardData.library} clients={clientIdentities} projects={projectsWithMissionProgress} onOpenProject={(projectId) => { setLibraryProjectId(projectId); setActiveSection('projects') }} />
        ) : activeSection === 'admin' && accessSession?.role === 'admin' ? (
          <AdminPage onClientCreated={(client) => setClientIdentities((current) => [...current.filter((item) => item.id !== client.id), client])} />
        ) : (
          <ComingSoon title={sectionLabels[activeSection]} onBack={() => setActiveSection('home')} />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navigation.slice(0, 5).map((item) => (
          <button className={activeSection === item.id ? 'active' : ''} key={item.id} onClick={() => setActiveSection(item.id)}>
            <Icon name={item.icon} size={20} /><span>{item.label}</span>
          </button>
        ))}
      </nav>

      {isAiOpen && <AiPanel dashboardData={dashboardData} completed={completed} onClose={() => setIsAiOpen(false)} onNavigate={(section) => { setActiveSection(section); setIsAiOpen(false) }} />}
      {isCommandOpen && <CommandPalette onClose={() => setIsCommandOpen(false)} onNavigate={(section) => { setActiveSection(section); setIsCommandOpen(false) }} onOpenAi={() => { setIsAiOpen(true); setIsCommandOpen(false) }} />}
      {isNotificationsOpen && <NotificationsPanel notifications={operationalNotifications} activities={recentActivities} readNotificationIds={readNotificationIds} onClose={() => setIsNotificationsOpen(false)} onMarkAllRead={markAllNotificationsRead} onMarkRead={markNotificationRead} />}
      {isJourneyOpen && <JourneyPanel profile={dashboardData.profile} completedCount={completed.length} missionCount={dashboardData.missions.length} totalXp={totalXp} onClose={() => setIsJourneyOpen(false)} />}
      {completionMessage && <div className="completion-toast" role="status"><span>✦</span>{completionMessage}<button onClick={() => setCompletionMessage('')} aria-label="Fechar aviso">×</button></div>}
    </main>
  )
}

function AdminPage({ preview = false, onClientCreated = () => undefined }: { preview?: boolean; onClientCreated?: (client: ClientIdentity) => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(preview ? adminOverviewPreview : null)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<'user' | 'client' | null>(null)

  useEffect(() => {
    if (preview) return
    void getAdminOverview().then(setOverview).catch((reason: Error) => setError(reason.message))
  }, [preview])

  const data = overview ?? adminOverviewPreview

  async function handleCreateUser(input: CreateAdminUserInput) {
    const member = await createAdminUser(input)
    setOverview((current) => ({ ...(current ?? adminOverviewPreview), team: [...(current ?? adminOverviewPreview).team, member] }))
  }

  async function handleCreateClient(input: { name: string; shortCode: string; imageDataUrl: string | null }) {
    const client = await createAdminClient(input)
    setOverview((current) => ({ ...(current ?? adminOverviewPreview), clientCount: (current ?? adminOverviewPreview).clientCount + 1 }))
    onClientCreated(client)
  }

  return <div className="admin-page">
    <section className="admin-intro">
      <div><span>PAINEL ADMINISTRATIVO</span><h1>Controle a <em>operação.</em></h1><p>Colaboradores, cargos e configurações centrais da Agência SIX em um só lugar.</p></div>
      <div className="admin-intro-side"><div className="admin-status"><i /><span>{preview ? 'PRÉVIA LOCAL' : 'ACESSO ADMINISTRATIVO'}</span><b>{preview ? 'Painel em demonstração' : 'Permissões verificadas'}</b></div>{!preview && <div className="admin-actions"><button onClick={() => setDialog('user')}>NOVO COLABORADOR <span>+</span></button><button onClick={() => setDialog('client')}>NOVO CLIENTE <span>+</span></button></div>}</div>
    </section>

    {error ? <p className="admin-error">{error}</p> : <>
      <section className="admin-metrics">
        <article><span>COLABORADORES</span><b>{data.team.length}</b><small>Perfis ativos na organização</small></article>
        <article><span>CARGOS CONFIGURADOS</span><b>{data.roles.length}</b><small>Escopos prontos para aplicar</small></article>
        <article><span>CLIENTES CADASTRADOS</span><b>{data.clientCount}</b><small>Base operacional atual</small></article>
        <article className="admin-metric-highlight"><span>CONTA ADMIN</span><b>agsix</b><small>Perfil administrativo criado</small></article>
      </section>

      <section className="admin-grid">
        <article className="admin-card admin-team-card"><div className="admin-card-head"><div><span>EQUIPE</span><h2>Perfis e <em>acessos.</em></h2></div><b>{data.team.length} pessoas</b></div><div className="admin-team-list">{data.team.map((member) => <div key={member.id}><i>{member.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</i><p><b>{member.name}</b><small>{member.username ? `@${member.username}` : member.email}</small></p><span>{member.role === 'admin' ? 'ADMIN' : member.role.toUpperCase()}</span></div>)}</div></article>
        <article className="admin-card"><div className="admin-card-head"><div><span>RBAC</span><h2>Cargos e <em>regras.</em></h2></div><b>{data.roles.reduce((total, role) => total + role.permissionCount, 0)} permissões</b></div><div className="admin-role-list">{data.roles.map((role) => <div key={role.code}><p><b>{role.name}</b><small>{role.description}</small></p><span>{role.permissionCount}</span></div>)}</div></article>
      </section>
    </>}
    {dialog === 'user' && <AdminUserDialog roles={data.roles} onClose={() => setDialog(null)} onCreate={handleCreateUser} />}
    {dialog === 'client' && <AdminClientDialog onClose={() => setDialog(null)} onCreate={handleCreateClient} />}
  </div>
}

function AdminUserDialog({ roles, onClose, onCreate }: { roles: AdminOverview['roles']; onClose: () => void; onCreate: (input: CreateAdminUserInput) => Promise<void> }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('specialist')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      await onCreate({ name: name.trim(), email: email.trim(), username: username.trim(), role })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o colaborador.')
    } finally {
      setIsSaving(false)
    }
  }

  return <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Novo colaborador"><form className="mission-create-dialog admin-create-dialog" onSubmit={submit}><button className="close-button" type="button" onClick={onClose} aria-label="Fechar cadastro de colaborador">×</button><span className="mission-create-icon"><Icon name="people" size={21} /></span><p>NOVO COLABORADOR</p><h2>Quem vai tornar<br /><em>possível?</em></h2><label><span>NOME</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} required /></label><label><span>E-MAIL</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label><div className="mission-create-row"><label><span>LOGIN (OPCIONAL)</span><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="nome.sobrenome" /></label><label><span>CARGO</span><select value={role} onChange={(event) => setRole(event.target.value)}>{roles.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label></div>{error && <p className="admin-dialog-error">{error}</p>}<button className="mission-create-submit" type="submit" disabled={isSaving}>{isSaving ? 'SALVANDO…' : <>CRIAR COLABORADOR <span>→</span></>}</button></form></div>
}

function AdminClientDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (input: { name: string; shortCode: string; imageDataUrl: string | null }) => Promise<void> }) {
  const [name, setName] = useState('')
  const [shortCode, setShortCode] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      await onCreate({ name: name.trim(), shortCode: shortCode.trim().toLocaleUpperCase('en-US'), imageDataUrl })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  function readImage(file: File | undefined) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 250000) { setError('Use PNG, JPEG ou WebP de até 250 KB.'); return }
    const reader = new FileReader()
    reader.onload = () => setImageDataUrl(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  return <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Novo cliente"><form className="mission-create-dialog admin-create-dialog" onSubmit={submit}><button className="close-button" type="button" onClick={onClose} aria-label="Fechar cadastro de cliente">×</button><span className="mission-create-icon"><Icon name="folder" size={21} /></span><p>NOVO CLIENTE</p><h2>Uma nova parceria<br /><em>começa aqui.</em></h2><label><span>NOME DO CLIENTE</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} required /></label><label><span>SIGLA DO CLIENTE</span><input value={shortCode} onChange={(event) => setShortCode(event.target.value.toLocaleUpperCase('en-US').slice(0, 6))} placeholder="Ex.: SHO" maxLength={6} required /></label><label className="client-image-input"><span>IMAGEM DO PERFIL (OPCIONAL)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImage(event.target.files?.[0])} /><small>PNG, JPEG ou WebP · até 250 KB</small>{imageDataUrl && <img src={imageDataUrl} alt="Prévia do perfil do cliente" />}</label>{error && <p className="admin-dialog-error">{error}</p>}<button className="mission-create-submit" type="submit" disabled={isSaving}>{isSaving ? 'SALVANDO…' : <>CRIAR CLIENTE <span>→</span></>}</button></form></div>
}

function Dashboard({
  filter,
  onFilterChange,
  missions: visibleMissions,
  completed,
  onComplete,
  totalXp,
  onViewMissions,
  projects,
  projectMissions,
  team,
  onViewProjects,
  agenda,
  onViewAgenda,
  onOpenJourney,
}: {
  filter: 'all' | 'today' | 'urgent'
  onFilterChange: (filter: 'all' | 'today' | 'urgent') => void
  missions: Mission[]
  completed: string[]
  onComplete: (id: string) => void
  totalXp: number
  onViewMissions: () => void
  projects: Project[]
  projectMissions: Mission[]
  team: TeamMember[]
  onViewProjects: () => void
  agenda: AgendaEvent[]
  onViewAgenda: () => void
  onOpenJourney: () => void
}) {
  return (
    <div className="dashboard">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">BOM DIA, GUILHERME <span>✦</span></p>
          <h1>Hoje é um bom dia<br />para <em>tornar possível.</em></h1>
        </div>
        <div className="energy-widget">
          <span className="energy-label">SUA ENERGIA</span>
          <span className="energy-value">92<sup>%</sup></span>
          <div className="energy-track"><i /></div>
          <small>Você está em ritmo extraordinário.</small>
        </div>
      </section>

      <section className="momentum-card">
        <div className="momentum-copy">
          <p>SEU MOMENTO</p>
          <h2>Você está a <span>280 XP</span><br />de ser um <em>Visionário.</em></h2>
          <button onClick={onOpenJourney}>VER MINHA JORNADA <span>→</span></button>
        </div>
        <div className="momentum-art" aria-hidden="true">
          <span className="orbit orbit-one" /><span className="orbit orbit-two" />
          <strong>V</strong><small>CRIADOR</small>
          <p>GO MAKE<br />IT POSSIBLE</p>
        </div>
        <div className="xp-meter"><span><b>{totalXp.toLocaleString('pt-BR')}</b> / 8.700 XP</span><div><i style={{ width: `${Math.min(100, (totalXp / 8700) * 100)}%` }} /></div></div>
      </section>

      <section className="dashboard-grid">
        <div className="main-column">
          <div className="section-heading">
            <div><p className="section-index">01</p><h2>Suas missões</h2></div>
            <div className="segmented-control">
              <button className={filter === 'all' ? 'selected' : ''} onClick={() => onFilterChange('all')}>Todas</button>
              <button className={filter === 'today' ? 'selected' : ''} onClick={() => onFilterChange('today')}>Hoje</button>
              <button className={filter === 'urgent' ? 'selected' : ''} onClick={() => onFilterChange('urgent')}>Urgentes</button>
            </div>
          </div>

          <div className="mission-list">
            {visibleMissions.map((mission, index) => {
              const isComplete = completed.includes(mission.id)
              const isAwaitingApproval = mission.approvalStatus === 'pending'
              return (
                <article className={`mission-card tone-${mission.tone} ${isComplete ? 'completed' : ''}`} key={mission.id}>
                  <span className="mission-number">0{index + 1}</span>
                  <div className="mission-info"><p>{mission.client}</p><h3>{mission.title}</h3><span className="deadline">{mission.deadline}</span>{isAwaitingApproval && <span className="mission-approval-status">EM APROVAÇÃO</span>}</div>
                  <div className="mission-reward"><span>RECOMPENSA</span><b>+{mission.xp} XP</b><small>+{mission.ideas} ideias</small></div>
                  <button className="complete-button" disabled={isComplete || isAwaitingApproval} onClick={() => onComplete(mission.id)}>{isComplete ? 'Feita!' : isAwaitingApproval ? 'Em aprovação' : 'Concluir'} <span>{isComplete ? '✓' : '→'}</span></button>
                </article>
              )
            })}
            {visibleMissions.length === 0 && <p className="empty-state">Nenhuma missão nessa visão. Seu fluxo está em dia.</p>}
          </div>
          <button className="view-all" onClick={onViewMissions}>VER TODAS AS MISSÕES <span>→</span></button>

          <div className="section-heading projects-heading"><div><p className="section-index">02</p><h2>Projetos em órbita</h2></div><button className="text-action" onClick={onViewProjects}>EXPLORAR PROJETOS <span>↗</span></button></div>
          <div className="project-grid">
            {projects.slice(0, 2).map((project) => <ProjectCard project={project} missions={projectMissions} team={team} onOpen={onViewProjects} key={project.id} />)}
          </div>
        </div>

        <aside className="right-column">
          <div className="section-heading compact"><div><p className="section-index">03</p><h2>Sua agenda</h2></div><button className="text-action" onClick={onViewAgenda}>VER TUDO</button></div>
          <div className="agenda-card">
            <div className="calendar-head"><button>‹</button><b>Agosto <span>2026</span></b><button>›</button></div>
            <div className="week-days"><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span><span>D</span></div>
            <div className="calendar-days"><span>27</span><span>28</span><span>29</span><span>30</span><span>31</span><span>1</span><span>2</span><span>3</span><span className="today">4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></div>
            <div className="agenda-line" />
            {agenda.filter((event) => event.day === 'Hoje').slice(0, 3).map((event) => <AgendaItem event={event} key={event.id} />)}
          </div>

          <div className="section-heading compact feed-heading"><div><p className="section-index">04</p><h2>Acontecendo agora</h2></div></div>
          <div className="feed-card">
            <div className="feed-item"><Avatar initials="LM" tone="purple" small /><p><b>Lorraine</b> conquistou<br /><span>+100 ideias</span> por uma grande sacada.</p><small>agora</small></div>
            <div className="feed-item"><Avatar initials="MP" tone="lime" small /><p><b>Mateus</b> concluiu<br />“Desdobramentos de campanha”.</p><small>12m</small></div>
            <button className="feed-more">VER O FEED COMPLETO <span>→</span></button>
          </div>
        </aside>
      </section>
    </div>
  )
}

function MissionsPage({
  missions,
  completed,
  onComplete,
  totalXp,
  baseXp,
  onCreateMission,
  projects,
  team,
  onReassignMission,
  onUpdateMission,
}: {
  missions: Mission[]
  completed: string[]
  onComplete: (id: string) => void
  totalXp: number
  baseXp: number
  onCreateMission: (input: { title: string; projectId: string; assigneeId: string; deadline: string; priority: 'normal' | 'urgent'; description?: string; files?: File[] }) => void
  projects: Project[]
  team: TeamMember[]
  onReassignMission: (id: string, assigneeId: string) => void
  onUpdateMission: (id: string, input: { title: string; projectId: string; assigneeId: string; deadline: string; priority: 'normal' | 'urgent' }) => void
}) {
  const [missionFilter, setMissionFilter] = useState<'open' | 'completed' | 'all'>('open')
  const [projectFilter, setProjectFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedMissionId, setSelectedMissionId] = useState(missions[0]?.id ?? '')
  const visibleMissions = missions.filter((mission) => {
    const matchesStatus = missionFilter === 'all' || (missionFilter === 'completed' ? completed.includes(mission.id) : !completed.includes(mission.id))
    const matchesProject = projectFilter === 'all' || mission.projectId === projectFilter
    const matchesAssignee = assigneeFilter === 'all' || mission.assigneeId === assigneeFilter
    return matchesStatus && matchesProject && matchesAssignee
  })
  const xpEarned = totalXp - baseXp
  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) ?? missions[0]

  return (
    <section className="missions-page">
      <div className="missions-intro">
        <div><p className="eyebrow">CENTRAL DE EXECUÇÃO <span>✦</span></p><h1>Suas missões,<br /><em>em movimento.</em></h1></div>
        <div className="missions-intro-actions"><button className="create-mission-button" onClick={() => setIsCreateOpen(true)}>NOVA MISSÃO <span>+</span></button><div className="mission-score"><span>XP CONQUISTADOS</span><b>+{xpEarned.toLocaleString('pt-BR')}</b><small>{completed.length} de {missions.length} missões concluídas</small></div></div>
      </div>

      <div className="missions-toolbar">
        <div className="missions-filter-controls"><div className="segmented-control" aria-label="Filtrar missões">
          <button className={missionFilter === 'open' ? 'selected' : ''} onClick={() => setMissionFilter('open')}>Em aberto</button>
          <button className={missionFilter === 'completed' ? 'selected' : ''} onClick={() => setMissionFilter('completed')}>Concluídas</button>
          <button className={missionFilter === 'all' ? 'selected' : ''} onClick={() => setMissionFilter('all')}>Todas</button>
        </div><label><span>PROJETO</span><select aria-label="Filtrar por projeto" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">Todos os projetos</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label><span>RESPONSÁVEL</span><select aria-label="Filtrar por responsável" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option value="all">Todo o time</option>{team.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label></div>
        <span>{visibleMissions.length} {visibleMissions.length === 1 ? 'missão' : 'missões'}</span>
      </div>

      <div className="missions-workspace">
        <div className="mission-list mission-list-full">
          {visibleMissions.map((mission, index) => <MissionCard key={mission.id} mission={mission} index={index} isComplete={completed.includes(mission.id)} assignee={team.find((member) => member.id === mission.assigneeId)} onManage={(missionId) => setSelectedMissionId(missionId)} onOpenDetails={(missionId) => { setSelectedMissionId(missionId); setIsDetailsOpen(true) }} onComplete={onComplete} />)}
          {visibleMissions.length === 0 && <p className="empty-state">Nenhuma missão nessa visão. Continue criando possibilidades.</p>}
        </div>
        <div className="mission-side-panel"><aside className="mission-insight"><span>RITMO DA SEMANA</span><b>{Math.round((completed.length / missions.length) * 100)}%</b><p>Você já acumulou <strong>{xpEarned} XP</strong> nesta jornada. O próximo passo começa agora.</p><div><i style={{ width: `${(completed.length / missions.length) * 100}%` }} /></div></aside>{selectedMission && <MissionAssignmentPanel mission={selectedMission} project={projects.find((project) => project.id === selectedMission.projectId)} assignee={team.find((member) => member.id === selectedMission.assigneeId)} team={team} isComplete={completed.includes(selectedMission.id)} onDetails={() => setIsDetailsOpen(true)} onEdit={() => setIsEditOpen(true)} onReassign={onReassignMission} />}</div>
      </div>
      {isCreateOpen && <MissionCreateModal projects={projects} team={team} onClose={() => setIsCreateOpen(false)} onCreate={(input) => { onCreateMission(input); setIsCreateOpen(false) }} />}
      {isEditOpen && selectedMission && <MissionEditModal mission={selectedMission} projects={projects} team={team} onClose={() => setIsEditOpen(false)} onUpdate={(input) => { onUpdateMission(selectedMission.id, input); setIsEditOpen(false) }} />}
      {isDetailsOpen && selectedMission && <MissionDetailsModal mission={selectedMission} onClose={() => setIsDetailsOpen(false)} />}
    </section>
  )
}

function MissionCard({ mission, index, isComplete, assignee, onManage, onOpenDetails, onComplete }: { mission: Mission; index: number; isComplete: boolean; assignee?: TeamMember; onManage?: (id: string) => void; onOpenDetails?: (id: string) => void; onComplete: (id: string) => void }) {
  return <article className={`mission-card tone-${mission.tone} ${isComplete ? 'completed' : ''} ${onOpenDetails ? 'interactive' : ''}`} role={onOpenDetails ? 'button' : undefined} tabIndex={onOpenDetails ? 0 : undefined} onClick={() => onOpenDetails?.(mission.id)} onKeyDown={(event) => { if (onOpenDetails && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpenDetails(mission.id) } }}>
    <span className="mission-number">{String(index + 1).padStart(2, '0')}</span>
    <div className="mission-info"><p>{mission.client}</p><h3>{mission.title}</h3><span className="deadline">{mission.deadline}</span>{mission.approvalStatus === 'pending' && <span className="mission-approval-status">EM APROVAÇÃO</span>}{assignee && <span className="mission-assignee">Responsável: {assignee.name}</span>}{onManage && <button className="mission-manage-button" onClick={(event) => { event.stopPropagation(); onManage(mission.id) }}>GERENCIAR <span>→</span></button>}</div>
    <div className="mission-reward"><span>RECOMPENSA</span><b>+{mission.xp} XP</b><small>+{mission.ideas} ideias</small></div>
    <button className="complete-button" disabled={isComplete || mission.approvalStatus === 'pending'} onClick={(event) => { event.stopPropagation(); onComplete(mission.id) }}>{isComplete ? 'Feita!' : mission.approvalStatus === 'pending' ? 'Em aprovação' : 'Concluir'} <span>{isComplete ? '✓' : '→'}</span></button>
  </article>
}

function MissionAssignmentPanel({ mission, project, assignee, team, isComplete, onDetails, onEdit, onReassign }: { mission: Mission; project?: Project; assignee?: TeamMember; team: TeamMember[]; isComplete: boolean; onDetails: () => void; onEdit: () => void; onReassign: (id: string, assigneeId: string) => void }) {
  const [assigneeId, setAssigneeId] = useState(mission.assigneeId ?? team[0]?.id ?? '')

  useEffect(() => {
    setAssigneeId(mission.assigneeId ?? team[0]?.id ?? '')
  }, [mission.assigneeId, mission.id, team])

  return <aside className="mission-assignment-panel"><div className="mission-assignment-head"><span>GESTÃO DA MISSÃO</span><b>{isComplete ? 'FEITA' : mission.approvalStatus === 'pending' ? 'EM APROVAÇÃO' : 'EM ABERTO'}</b></div><h2>{mission.title}</h2><p>{project?.name ?? mission.client} · {mission.deadline}</p><div className="mission-assignment-owner"><Avatar initials={assignee?.initials ?? '?'} tone={assignee?.tone ?? 'dark'} small /><span><small>RESPONSÁVEL ATUAL</small><b>{assignee?.name ?? 'A definir'}</b></span></div><form onSubmit={(event) => { event.preventDefault(); if (assigneeId) onReassign(mission.id, assigneeId)} }><label><span>REDISTRIBUIR PARA</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>{team.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label><button type="submit" disabled={!assigneeId || assigneeId === mission.assigneeId}>SALVAR RESPONSÁVEL <span>→</span></button></form><button className="mission-edit-button" type="button" onClick={onEdit}>EDITAR MISSÃO <span>↗</span></button><button className="mission-details-button" type="button" onClick={onDetails}>DETALHES COMPLETOS <span>→</span></button></aside>
}

function MissionDetailsModal({ mission, onClose }: { mission: Mission; onClose: () => void }) {
  const [details, setDetails] = useState<MissionDetails | null>(null)
  const [library, setLibrary] = useState<ProjectLibrary>(projectLibrarySeed)
  const [checklistLabel, setChecklistLabel] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [selectedFileId, setSelectedFileId] = useState('')
  const [uploadFolderId, setUploadFolderId] = useState('')
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [message, setMessage] = useState('')

  async function reload() {
    try {
      const next = await getMissionDetails(mission.id)
      setDetails(next)
      if (next.mission.projectId) {
        try { const projectLibrary = await getProjectLibrary(next.mission.projectId); setLibrary(projectLibrary); setUploadFolderId((current) => current || projectLibrary.folders[0]?.id || '') } catch { setMessage('Detalhes carregados, mas a Biblioteca do Projeto não está disponível.') }
      }
    } catch (error) {
      setDetails({ mission: { id: mission.id, title: mission.title, description: 'Conecte uma sessão SIX para carregar os dados persistidos desta missão.', client: mission.client, projectId: mission.projectId ?? '', project: mission.client, assigneeId: mission.assigneeId ?? null, assignee: null, status: mission.status ?? 'open', priority: mission.urgent ? 'urgent' : 'normal', dueAt: deadlineToMissionDate(mission.deadline), xpReward: mission.xp, ideasReward: mission.ideas, rewardLabel: null, approvalStatus: mission.approvalStatus ?? 'not_requested', createdAt: '', completedAt: null, approvedAt: null }, checklist: [], comments: [], attachments: [], history: [], permissions: { canManage: false, canApprove: false } })
      setMessage(error instanceof Error ? `${error.message} Exibindo o resumo local.` : 'Exibindo o resumo local da missão.')
    }
  }

  useEffect(() => { void reload() }, [mission.id])
  useEffect(() => { function handleEscape(event: KeyboardEvent) { if (event.key === 'Escape') onClose() } window.addEventListener('keydown', handleEscape); return () => window.removeEventListener('keydown', handleEscape) }, [onClose])

  async function addChecklist(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!checklistLabel.trim()) return; try { const { item } = await addMissionChecklistItem(mission.id, checklistLabel); setDetails((current) => current ? { ...current, checklist: [...current.checklist, item] } : current); setChecklistLabel('') } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível adicionar o item.') } }
  async function toggleChecklist(itemId: string, isCompleted: boolean) { try { await setMissionChecklistItem(mission.id, itemId, isCompleted); setDetails((current) => current ? { ...current, checklist: current.checklist.map((item) => item.id === itemId ? { ...item, isCompleted: isCompleted ? 1 : 0 } : item) } : current) } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o item.') } }
  async function addComment(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!commentBody.trim()) return; try { const { comment } = await addMissionComment(mission.id, commentBody); setDetails((current) => current ? { ...current, comments: [comment, ...current.comments] } : current); setCommentBody('') } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o comentário.') } }
  async function attachFile() { if (!selectedFileId) return; try { const { attachment } = await attachProjectLibraryFile(mission.id, selectedFileId); setDetails((current) => current ? { ...current, attachments: [attachment, ...current.attachments] } : current); setSelectedFileId('') } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível anexar o arquivo.') } }
  async function uploadAndAttachFile(file?: File) { const folderId = uploadFolderId || library.folders[0]?.id; if (!file || !folderId || !details) return; setIsUploadingFile(true); try { const uploaded = await uploadProjectLibraryFile({ projectId: details.mission.projectId, folderId, file }); const { attachment } = await attachProjectLibraryFile(mission.id, uploaded.id); setLibrary((current) => ({ folders: current.folders.map((folder) => folder.id === folderId ? { ...folder, fileCount: folder.fileCount + 1 } : folder), files: [uploaded, ...current.files.filter((item) => item.id !== uploaded.id)] })); setDetails((current) => current ? { ...current, attachments: [attachment, ...current.attachments] } : current); setMessage(`Arquivo ${uploaded.name} enviado e anexado à missão.`) } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o anexo.') } finally { setIsUploadingFile(false); setIsDraggingFile(false) } }
  async function complete() { try { const result = await requestMissionCompletion(mission.id); setMessage(result.status === 'pending_approval' ? 'Entrega enviada para aprovação.' : 'Missão aprovada e XP liberado.'); await reload() } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a missão.') } }

  return <div className="mission-create-overlay mission-details-overlay" role="dialog" aria-modal="true" aria-label="Detalhes da missão"><section className="mission-details-dialog"><button className="close-button" type="button" onClick={onClose} aria-label="Fechar detalhes da missão">×</button>{!details ? <p className="mission-details-loading">Carregando missão…</p> : <><header><p>MISSÃO COMPLETA</p><h2>{details.mission.title}</h2><span>{details.mission.client} · {details.mission.project}</span></header><div className="mission-details-meta"><b>{details.mission.priority.toLocaleUpperCase('pt-BR')}</b><span>{details.mission.assignee ?? 'Responsável a definir'}</span><span>{details.mission.dueAt ? new Date(details.mission.dueAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Prazo a definir'}</span><span>+{details.mission.xpReward} XP</span></div><p className="mission-details-description">{details.mission.description || 'Sem descrição adicionada.'}</p><div className="mission-details-grid"><section><h3>CHECKLIST</h3><div className="mission-checklist">{details.checklist.map((item) => <label key={item.id}><input type="checkbox" checked={Boolean(item.isCompleted)} onChange={(event) => { void toggleChecklist(item.id, event.target.checked) }} /><span>{item.label}</span></label>)}</div><form onSubmit={addChecklist}><input value={checklistLabel} onChange={(event) => setChecklistLabel(event.target.value)} placeholder="Adicionar item" maxLength={240} /><button>ADICIONAR</button></form></section><section><h3>ANEXOS DO PROJETO</h3>{details.attachments.map((attachment) => <a className="mission-attachment" key={attachment.id} href={`/api/projects/${details.mission.projectId}/library/files/${attachment.libraryFileId}`}><span>{attachment.fileName}</span><b>V{attachment.fileVersion} ↓</b></a>)}<div className="mission-attach-form"><select value={selectedFileId} onChange={(event) => setSelectedFileId(event.target.value)}><option value="">Selecionar arquivo da biblioteca</option>{library.files.filter((file) => !details.attachments.some((attachment) => attachment.libraryFileId === file.id)).map((file) => <option value={file.id} key={file.id}>{file.name} · V{file.version}</option>)}</select><button type="button" onClick={() => { void attachFile() }} disabled={!selectedFileId}>ANEXAR</button></div><div className={`mission-dropzone ${isDraggingFile ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDraggingFile(true) }} onDragLeave={() => setIsDraggingFile(false)} onDrop={(event) => { event.preventDefault(); void uploadAndAttachFile(event.dataTransfer.files[0]) }}><label><input type="file" onChange={(event) => { void uploadAndAttachFile(event.target.files?.[0]); event.currentTarget.value = '' }} />{isUploadingFile ? 'ENVIANDO ARQUIVO…' : 'ADICIONAR NOVO ARQUIVO +'}</label><select value={uploadFolderId} onChange={(event) => setUploadFolderId(event.target.value)}>{library.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><p>Arraste um arquivo aqui para enviar e anexar.</p></div></section></div><section className="mission-comments"><h3>COMENTÁRIOS</h3><form onSubmit={addComment}><textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Registre uma atualização para o time" maxLength={3000} /><button>COMENTAR</button></form>{details.comments.map((comment) => <article key={comment.id}><b>{comment.author}</b><p>{comment.body}</p></article>)}</section><section className="mission-history"><h3>HISTÓRICO</h3>{details.history.map((entry) => <p key={entry.id}><b>{entry.actor ?? 'Sistema'}</b> · {entry.detail ?? entry.action}</p>)}</section>{message && <p className="mission-detail-message">{message}</p>}{details.mission.status !== 'completed' && <button className="mission-detail-complete" type="button" onClick={() => { void complete() }}>{details.permissions.canApprove ? 'APROVAR E CONCLUIR' : 'ENVIAR PARA APROVAÇÃO'} <span>→</span></button>}</>}</section></div>
}

function MissionEditModal({ mission, projects, team, onClose, onUpdate }: { mission: Mission; projects: Project[]; team: TeamMember[]; onClose: () => void; onUpdate: (input: { title: string; projectId: string; assigneeId: string; deadline: string; priority: 'normal' | 'urgent' }) => void }) {
  const [title, setTitle] = useState(mission.title)
  const [projectId, setProjectId] = useState(mission.projectId ?? projects[0]?.id ?? '')
  const [assigneeId, setAssigneeId] = useState(mission.assigneeId ?? team[0]?.id ?? '')
  const [deadline, setDeadline] = useState(() => missionDateTimeInputValue(mission.deadline))
  const [priority, setPriority] = useState<'normal' | 'urgent'>(mission.urgent ? 'urgent' : 'normal')

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Editar missão"><form className="mission-create-dialog mission-edit-dialog" onSubmit={(event) => { event.preventDefault(); if (title.trim() && projectId && assigneeId && deadline.trim()) onUpdate({ title: title.trim(), projectId, assigneeId, deadline, priority }) }}><button className="close-button" type="button" onClick={onClose} aria-label="Fechar edição de missão">×</button><span className="mission-create-icon"><Icon name="target" size={21} /></span><p>EDITAR MISSÃO</p><h2>Ajuste o próximo<br /><em>movimento.</em></h2><label><span>TÍTULO</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required /></label><div className="mission-create-row"><label><span>PROJETO</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label><span>RESPONSÁVEL</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} required>{team.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.role}</option>)}</select></label></div><div className="mission-create-row"><label><span>PRAZO</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} required /></label><label><span>PRIORIDADE</span><select value={priority} onChange={(event) => setPriority(event.target.value as 'normal' | 'urgent')}><option value="normal">Normal</option><option value="urgent">Urgente</option></select></label></div><button className="mission-create-submit" type="submit">SALVAR ALTERAÇÕES <span>→</span></button></form></div>
}

function MissionCreateModal({ projects, team, initialProjectId, onClose, onCreate }: { projects: Project[]; team: TeamMember[]; initialProjectId?: string; onClose: () => void; onCreate: (input: { title: string; projectId: string; assigneeId: string; deadline: string; priority: 'normal' | 'urgent'; description?: string; files?: File[] }) => void }) {
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? '')
  const [assigneeId, setAssigneeId] = useState(team[0]?.id ?? '')
  const [deadline, setDeadline] = useState(() => missionDateTimeInputValue('Hoje · 17h'))
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Criar missão"><form className="mission-create-dialog mission-create-dialog-expanded" onSubmit={(event) => { event.preventDefault(); if (title.trim() && projectId && assigneeId && deadline.trim()) onCreate({ title: title.trim(), projectId, assigneeId, deadline, priority, description: description.trim(), files }) }}><button className="close-button" type="button" onClick={onClose} aria-label="Fechar criação de missão">×</button><span className="mission-create-icon"><Icon name="target" size={21} /></span><p>NOVA MISSÃO</p><h2>Qual ideia vamos<br /><em>tornar possível?</em></h2><label><span>TÍTULO</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Desdobramentos de campanha" required /></label><label><span>DESCRIÇÃO, LINKS E CONTEXTO</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Escreva o briefing da missão e cole links de referências, imagens ou vídeos." maxLength={4000} /></label><label className="mission-create-files"><span>IMAGENS E VÍDEOS (OPCIONAL)</span><input type="file" accept="image/*,video/*" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><small>{files.length ? `${files.length} arquivo${files.length === 1 ? '' : 's'} será${files.length === 1 ? '' : 'ão'} enviado${files.length === 1 ? '' : 's'} à Biblioteca do Projeto.` : 'Envie imagens ou vídeos junto da missão.'}</small></label><div className="mission-create-row"><label><span>PROJETO</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label><span>RESPONSÁVEL</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} required>{team.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.role}</option>)}</select></label></div><div className="mission-create-row"><label><span>PRAZO</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} required /></label><label><span>PRIORIDADE</span><select value={priority} onChange={(event) => setPriority(event.target.value as 'normal' | 'urgent')}><option value="normal">Normal</option><option value="urgent">Urgente</option></select></label></div><button className="mission-create-submit" type="submit">CRIAR MISSÃO <span>→</span></button></form></div>
}

function AgendaPage({ events, missions, projects, team, completed }: { events: AgendaEvent[]; missions: Mission[]; projects: Project[]; team: TeamMember[]; completed: string[] }) {
  const missionEvents = missions.filter((mission) => !completed.includes(mission.id)).map((mission) => {
    const project = projects.find((item) => item.id === mission.projectId)
    const assignee = team.find((member) => member.id === mission.assigneeId)
    const timeParts = mission.deadline.match(/(\d{1,2})(?::(\d{2}))?h?/)
    const hour = timeParts?.[1]?.padStart(2, '0') ?? '18'
    const minute = timeParts?.[2] ?? '00'

    return {
      id: `agenda-mission-${mission.id}`,
      time: `${hour}:${minute}`,
      title: mission.title,
      subtitle: `${project?.name ?? mission.client} · Missão atribuída`,
      day: mission.deadline.startsWith('Hoje') ? 'Hoje' : 'Amanhã',
      category: 'Entrega' as const,
      tone: mission.tone,
      duration: 'Entrega',
      attendees: assignee ? [assignee.initials] : [],
      description: `Entrega da missão “${mission.title}” para ${project?.name ?? mission.client}.${assignee ? ` Responsável: ${assignee.name}.` : ''}`,
    }
  })
  const agendaEvents = [...events, ...missionEvents].sort((first, second) => {
    const dayDifference = (first.day === 'Hoje' ? 0 : 1) - (second.day === 'Hoje' ? 0 : 1)
    return dayDifference || first.time.localeCompare(second.time)
  })
  const [agendaFilter, setAgendaFilter] = useState<'all' | AgendaEvent['category']>('all')
  const [selectedEventId, setSelectedEventId] = useState(agendaEvents[0]?.id ?? '')
  const visibleEvents = agendaEvents.filter((event) => agendaFilter === 'all' || event.category === agendaFilter)
  const selectedEvent = visibleEvents.find((event) => event.id === selectedEventId) ?? visibleEvents[0] ?? agendaEvents[0]

  if (!selectedEvent) return <section className="agenda-page"><p className="empty-state">Nenhum evento programado por enquanto.</p></section>

  return (
    <section className="agenda-page">
      <div className="agenda-intro"><div><p className="eyebrow">AGENDA COMPARTILHADA <span>✦</span></p><h1>Ritmo de<br /><em>possibilidades.</em></h1></div><div className="agenda-date-summary"><span>HOJE</span><b>04</b><small>{missionEvents.length} {missionEvents.length === 1 ? 'missão pendente' : 'missões pendentes'}</small></div></div>
      <div className="agenda-toolbar"><div className="segmented-control" aria-label="Filtrar agenda"><button className={agendaFilter === 'all' ? 'selected' : ''} onClick={() => setAgendaFilter('all')}>Todos</button><button className={agendaFilter === 'Reunião' ? 'selected' : ''} onClick={() => setAgendaFilter('Reunião')}>Reuniões</button><button className={agendaFilter === 'Criação' ? 'selected' : ''} onClick={() => setAgendaFilter('Criação')}>Criação</button><button className={agendaFilter === 'Entrega' ? 'selected' : ''} onClick={() => setAgendaFilter('Entrega')}>Entregas</button></div><span>{visibleEvents.length} eventos programados</span></div>

      <div className="agenda-workspace">
        <div className="agenda-timeline">
          {visibleEvents.map((event) => {
            const isSelected = event.id === selectedEvent.id
            return <button className={`agenda-timeline-item tone-${event.tone} ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedEventId(event.id)} aria-pressed={isSelected} key={event.id}>
              <time>{event.time}</time><span className="agenda-timeline-dot" /><span className="agenda-timeline-copy"><small>{event.day} · {event.category}</small><b>{event.title}</b><em>{event.subtitle}</em></span><span className="agenda-timeline-duration">{event.duration}</span>
            </button>
          })}
          {visibleEvents.length === 0 && <p className="empty-state">Nenhum evento nesse filtro.</p>}
        </div>
        <aside className={`agenda-detail tone-${selectedEvent.tone}`}>
          <div className="agenda-detail-head"><span>{selectedEvent.day} · {selectedEvent.time}</span><b>{selectedEvent.category}</b></div><h2>{selectedEvent.title}</h2><p>{selectedEvent.subtitle}</p><div className="agenda-detail-section"><span>DURAÇÃO</span><b>{selectedEvent.duration}</b></div><div className="agenda-detail-section"><span>CONTEXTO</span><p>{selectedEvent.description}</p></div><div className="agenda-detail-footer"><div className="avatars">{selectedEvent.attendees.map((member, index) => <Avatar initials={member} tone={index === 1 ? 'lime' : 'dark'} small key={member} />)}<span>+{Math.max(0, selectedEvent.attendees.length - 2)}</span></div><small>{selectedEvent.attendees.length} pessoas confirmadas</small></div>
        </aside>
      </div>
    </section>
  )
}

function TeamPage({ members, missions, projects, completed }: { members: TeamMember[]; missions: Mission[]; projects: Project[]; completed: string[] }) {
  const [teamFilter, setTeamFilter] = useState<'all' | 'available' | 'focus'>('all')
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? '')
  const visibleMembers = members.filter((member) => {
    if (teamFilter === 'all') return true
    return teamFilter === 'available' ? member.availability === 'Disponível' : member.availability === 'Em foco'
  })
  const selectedMember = visibleMembers.find((member) => member.id === selectedMemberId) ?? visibleMembers[0] ?? members[0]
  const openMissionCount = missions.filter((mission) => !completed.includes(mission.id)).length
  const membersWithOpenMissions = members.filter((member) => missions.some((mission) => mission.assigneeId === member.id && !completed.includes(mission.id))).length
  const selectedMemberMissions = missions.filter((mission) => mission.assigneeId === selectedMember?.id)

  if (!selectedMember) return <section className="team-page"><p className="empty-state">Ainda não há pessoas cadastradas na equipe.</p></section>

  return (
    <section className="team-page">
      <div className="team-intro"><div><p className="eyebrow">PESSOAS & POTENCIAL <span>✦</span></p><h1>Quem torna<br /><em>possível.</em></h1></div><div className="team-summary"><span>MISSÕES EM ABERTO</span><b>{openMissionCount}</b><small>{membersWithOpenMissions} pessoas com entregas em andamento</small></div></div>
      <div className="team-toolbar"><div className="segmented-control" aria-label="Filtrar equipe"><button className={teamFilter === 'all' ? 'selected' : ''} onClick={() => setTeamFilter('all')}>Todos</button><button className={teamFilter === 'available' ? 'selected' : ''} onClick={() => setTeamFilter('available')}>Disponíveis</button><button className={teamFilter === 'focus' ? 'selected' : ''} onClick={() => setTeamFilter('focus')}>Em foco</button></div><span>{visibleMembers.length} pessoas nesta visão</span></div>

      <div className="team-workspace">
        <div className="team-member-list">
          {visibleMembers.map((member) => {
            const isSelected = member.id === selectedMember.id
            const availabilityClass = member.availability === 'Disponível' ? 'available' : member.availability === 'No limite' ? 'limit' : 'focus'
            const memberMissions = missions.filter((mission) => mission.assigneeId === member.id)
            const memberOpenMissions = memberMissions.filter((mission) => !completed.includes(mission.id)).length
            return <button className={`team-member-card ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedMemberId(member.id)} aria-pressed={isSelected} key={member.id}><Avatar initials={member.initials} tone={member.tone} /><span className="team-member-copy"><b>{member.name}</b><small>{member.role}</small><em>{memberOpenMissions > 0 ? `${memberOpenMissions} missão${memberOpenMissions > 1 ? 'ões' : ''} em aberto` : memberMissions.length > 0 ? 'Entregas concluídas' : 'Sem missões atribuídas'}</em></span><span className={`team-member-status ${availabilityClass}`}>{member.availability}</span><span className="team-member-capacity"><b>{member.capacity}%</b><i><span style={{ width: `${member.capacity}%` }} /></i></span></button>
          })}
          {visibleMembers.length === 0 && <p className="empty-state">Nenhuma pessoa nesse filtro.</p>}
        </div>
        <aside className="team-detail"><div className="team-detail-profile"><Avatar initials={selectedMember.initials} tone={selectedMember.tone} /><div><span>{selectedMember.availability}</span><h2>{selectedMember.name}</h2><p>{selectedMember.role}</p></div></div><div className="team-detail-section"><span>FOCO ATUAL</span><p>{selectedMember.focus}</p></div><div className="team-detail-section"><span>LEITURA DO RITMO</span><p>{selectedMember.note}</p></div><div className="team-detail-section"><span>MISSÕES ATRIBUÍDAS</span><div className="member-mission-list">{selectedMemberMissions.length > 0 ? selectedMemberMissions.map((mission) => { const project = projects.find((item) => item.id === mission.projectId); const isComplete = completed.includes(mission.id); return <article className={isComplete ? 'completed' : ''} key={mission.id}><div><b>{mission.title}</b><small>{project?.name ?? mission.client} · {mission.deadline}</small></div><span>{isComplete ? 'FEITA' : 'EM ABERTO'}</span></article> }) : <p className="member-mission-empty">Ainda não há missões atribuídas a esta pessoa.</p>}</div></div><div className="team-detail-section"><span>PROJETOS EM ÓRBITA</span><div className="member-projects">{selectedMember.projects.map((project) => <b key={project}>{project}</b>)}</div></div><div className="team-detail-capacity"><span>CAPACIDADE COMPROMETIDA</span><b>{selectedMember.capacity}%</b><i><span style={{ width: `${selectedMember.capacity}%` }} /></i></div></aside>
      </div>
    </section>
  )
}

function AnalyticsPage({ analytics, projects, missions, team, completed, totalXp, baseXp }: { analytics: AnalyticsData; projects: Project[]; missions: Mission[]; team: TeamMember[]; completed: string[]; totalXp: number; baseXp: number }) {
  const [metric, setMetric] = useState<'xp' | 'focus'>('xp')
  const weeklyMaximum = Math.max(...analytics.weekly.map((point) => metric === 'xp' ? point.xp : point.focus))
  const weeklyTotal = analytics.weekly.reduce((total, point) => total + point.xp, 0)
  const earnedXp = totalXp - baseXp
  const completedMissionCount = missions.filter((mission) => completed.includes(mission.id)).length
  const deliveryRate = missions.length > 0 ? Math.round((completedMissionCount / missions.length) * 100) : 0
  const activeContributors = team.filter((member) => missions.some((mission) => mission.assigneeId === member.id && !completed.includes(mission.id))).length
  const healthyProjectCount = projects.filter((project) => getProjectHealth(project, missions, completed).tone === 'healthy').length
  const teamDelivery = team.map((member) => {
    const assignedMissions = missions.filter((mission) => mission.assigneeId === member.id)
    const completedCount = assignedMissions.filter((mission) => completed.includes(mission.id)).length
    return { member, assignedCount: assignedMissions.length, completedCount, openCount: assignedMissions.length - completedCount }
  }).filter(({ assignedCount }) => assignedCount > 0)
  const projectDelivery = projects.map((project) => {
    const assignedMissions = missions.filter((mission) => mission.projectId === project.id)
    const completedCount = assignedMissions.filter((mission) => completed.includes(mission.id)).length
    return { project, assignedCount: assignedMissions.length, completedCount, health: getProjectHealth(project, missions, completed) }
  })

  return (
    <section className="analytics-page">
      <div className="analytics-intro"><div><p className="eyebrow">SEU IMPACTO <span>✦</span></p><h1>Evolução que<br /><em>ganha forma.</em></h1></div><div className="analytics-streak"><span>SEQUÊNCIA CRIATIVA</span><b>{analytics.streak} dias</b><small>Você manteve o ritmo em toda a semana.</small></div></div>
      <div className="analytics-metrics"><button className={`analytics-metric ${metric === 'xp' ? 'selected' : ''}`} onClick={() => setMetric('xp')}><span>XP DA SEMANA</span><b>+{(weeklyTotal + earnedXp).toLocaleString('pt-BR')}</b><small>ritmo consistente <i>↗</i></small></button><button className={`analytics-metric ${metric === 'focus' ? 'selected' : ''}`} onClick={() => setMetric('focus')}><span>FOCO MÉDIO</span><b>{Math.round(analytics.weekly.reduce((total, point) => total + point.focus, 0) / analytics.weekly.length)}%</b><small>{activeContributors === 1 ? '1 pessoa em ação' : `${activeContributors} pessoas em ação`}</small></button><div className="analytics-metric static"><span>ENTREGAS CONCLUÍDAS</span><b>{deliveryRate}%</b><small>{completedMissionCount} de {missions.length} missões concluídas</small></div><div className="analytics-metric static"><span>FRENTES SAUDÁVEIS</span><b>{healthyProjectCount}/{projects.length}</b><small>frentes no ritmo ou concluídas</small></div></div>

      <div className="analytics-workspace"><div className="analytics-chart-card"><div className="analytics-chart-head"><div><span>EVOLUÇÃO SEMANAL</span><h2>{metric === 'xp' ? 'XP conquistados' : 'Ritmo de foco'}</h2></div><button className="chart-toggle" onClick={() => setMetric(metric === 'xp' ? 'focus' : 'xp')}>VER {metric === 'xp' ? 'FOCO' : 'XP'} <span>↔</span></button></div><div className="analytics-chart" aria-label={metric === 'xp' ? 'Gráfico de XP semanal' : 'Gráfico de foco semanal'}>{analytics.weekly.map((point) => { const value = metric === 'xp' ? point.xp : point.focus; const height = Math.max(8, (value / weeklyMaximum) * 100); return <div className="analytics-bar" key={point.label}><span>{metric === 'xp' ? `+${value}` : `${value}%`}</span><i><b style={{ height: `${height}%` }} /></i><small>{point.label}</small></div> })}</div></div><aside className="project-health-card"><span>SAÚDE DOS PROJETOS</span><h2>Carteira em<br /><em>movimento.</em></h2><div>{projectDelivery.map(({ project, health }) => <article key={project.id}><div><b>{project.name}</b><small>{health.label} · {project.status}</small></div><strong>{project.progress}%</strong><i><span style={{ width: `${project.progress}%` }} /></i></article>)}</div></aside></div>
      <div className="analytics-breakdown"><section className="analytics-breakdown-card"><span>ENTREGAS POR PESSOA</span><h2>Quem está<br /><em>movendo a frente.</em></h2><div>{teamDelivery.map(({ member, assignedCount, completedCount, openCount }) => <article key={member.id}><Avatar initials={member.initials} tone={member.tone} small /><div><b>{member.name}</b><small>{completedCount} concluída{completedCount === 1 ? '' : 's'} · {openCount} em aberto</small></div><strong>{completedCount}/{assignedCount}</strong></article>)}{teamDelivery.length === 0 && <p className="analytics-empty">Ainda não há missões atribuídas.</p>}</div></section><section className="analytics-breakdown-card"><span>ENTREGAS POR FRENTE</span><h2>Onde o trabalho<br /><em>ganha forma.</em></h2><div>{projectDelivery.map(({ project, assignedCount, completedCount, health }) => <article key={project.id}><span className={`analytics-health-dot ${health.tone}`} /><div><b>{project.name}</b><small>{health.label} · {completedCount}/{assignedCount || 0} entregas concluídas</small></div><strong>{project.progress}%</strong></article>)}</div></section></div>
    </section>
  )
}

function LibraryPage({ clients, projects, onOpenProject }: { resources: LibraryResource[]; clients: ClientIdentity[]; projects: Project[]; onOpenProject: (projectId: string) => void }) {
  const [selectedClientId, setSelectedClientId] = useState('all')
  const visibleClients = selectedClientId === 'all' ? clients : clients.filter((client) => client.id === selectedClientId)
  const visibleProjects = selectedClientId === 'all' ? projects : projects.filter((project) => project.client === clients.find((client) => client.id === selectedClientId)?.name)
  const selectedClient = clients.find((client) => client.id === selectedClientId)

  return <section className="library-page client-directory-page"><div className="library-intro"><div><p className="eyebrow">DIRETÓRIO DE CLIENTES <span>✦</span></p><h1>Arquivos que<br /><em>contam histórias.</em></h1></div><div className="library-summary"><span>CLIENTES ATIVOS</span><b>{clients.length}</b><small>Selecione um cliente para acessar seus projetos e materiais.</small></div></div><div className="client-directory-selector"><label><span>CLIENTE</span><select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}><option value="all">Todos os clientes</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name} · {client.shortCode ?? 'SEM SIGLA'}</option>)}</select></label><p>Os arquivos permanentes do cliente ficam nesta biblioteca; campanhas ficam nos projetos.</p></div>{selectedClient && <ClientLibraryManager client={selectedClient} />}<section className="client-library-index"><div className="client-library-index-head"><div><span>{selectedClientId === 'all' ? 'TODOS OS CLIENTES' : 'PROJETOS DO CLIENTE'}</span><p>Abra uma frente para acessar sua biblioteca específica de campanha.</p></div><b>{visibleProjects.length} projetos</b></div><div className="client-library-grid">{visibleClients.map((client) => { const clientProjects = projects.filter((project) => project.client === client.name); return <article key={client.id}><div className={`client-library-mark ${client.imageUrl ? 'has-image' : ''}`}>{client.imageUrl ? <img src={client.imageUrl} alt="" /> : client.shortCode ?? client.name.slice(0, 3).toLocaleUpperCase('pt-BR')}</div><div><span>CLIENTE</span><h2>{client.name}</h2><p>{clientProjects.length} projeto{clientProjects.length === 1 ? '' : 's'} vinculado{clientProjects.length === 1 ? '' : 's'}</p></div><div className="client-library-projects">{clientProjects.length > 0 ? clientProjects.map((project) => <button onClick={() => onOpenProject(project.id)} key={project.id}><b>{project.name}</b><small>Biblioteca do projeto · {project.status}</small><i>↗</i></button>) : <p>Este cliente ainda não possui projetos com arquivos.</p>}</div></article> })}</div>{visibleClients.length === 0 && <p className="empty-state">Cliente não encontrado.</p>}</section></section>
}

function ClientLibraryManager({ client }: { client: ClientIdentity }) {
  const [library, setLibrary] = useState<ProjectLibrary>({ folders: [], files: [] })
  const [folderId, setFolderId] = useState('')
  const [message, setMessage] = useState('')
  const [folderName, setFolderName] = useState('')
  const [isFolderFormOpen, setIsFolderFormOpen] = useState(false)
  useEffect(() => { void getClientLibrary(client.id).then((next) => { setLibrary(next); setFolderId(next.folders[0]?.id ?? '') }).catch(() => setMessage('Não foi possível carregar a biblioteca.')) }, [client.id])
  const folder = library.folders.find((item) => item.id === folderId)
  const files = library.files.filter((item) => item.folderId === folderId)
  async function upload(file?: File) { if (!file || !folderId) return; try { const uploaded = await uploadClientLibraryFile(client.id, folderId, file); setLibrary((current) => ({ folders: current.folders.map((item) => item.id === folderId && !current.files.some((entry) => entry.id === uploaded.id) ? { ...item, fileCount: item.fileCount + 1 } : item), files: [uploaded, ...current.files.filter((item) => item.id !== uploaded.id)] })); setMessage(`Arquivo enviado: versão ${uploaded.version}.`) } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha no upload.') } }
  async function createFolder(event: FormEvent<HTMLFormElement>) { event.preventDefault(); try { const created = await createClientLibraryFolder(client.id, folderName); setLibrary((current) => ({ ...current, folders: [...current.folders, created] })); setFolderId(created.id); setFolderName(''); setIsFolderFormOpen(false); setMessage(`Pasta ${created.name} criada.`) } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível criar a pasta.') } }
  return <section className="client-library-manager"><div><span>BIBLIOTECA DO CLIENTE</span><h2>{client.name}</h2></div><div className="client-library-manager-body"><nav><div className="client-library-folder-actions"><b>PASTAS</b><button type="button" onClick={() => setIsFolderFormOpen((current) => !current)}>NOVA +</button></div>{isFolderFormOpen && <form className="client-library-folder-form" onSubmit={createFolder}><input value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={48} placeholder="Nome da pasta" required /><button>CRIAR</button></form>}{library.folders.map((item) => <button className={item.id === folderId ? 'selected' : ''} onClick={() => setFolderId(item.id)} key={item.id}>{item.name}<b>{item.fileCount}</b></button>)}</nav><div><header><b>{folder?.name ?? 'Pasta'}</b><label><input type="file" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} />ADICIONAR ARQUIVO +</label></header>{message && <p>{message}</p>}{files.length ? files.map((file) => <article key={file.id}><b>{file.name}</b><small>Versão {file.version} · {file.fileType}</small><a href={`/api/clients/${client.id}/library/files/${file.id}`}>BAIXAR</a></article>) : <p>Nenhum arquivo nesta pasta.</p>}</div></div></section>
}

function ProjectsPage({ projects, clients, initialSelectedProjectId, missions, completed, team, onCreateProject, onCreateMission, onUpdateProjectLifecycle }: { projects: Project[]; clients: ClientIdentity[]; initialSelectedProjectId: string | null; missions: Mission[]; completed: string[]; team: TeamMember[]; onCreateProject: (input: { name: string; client: string; deadline: string; tone: Project['tone'] }) => void; onCreateMission: (input: { title: string; projectId: string; assigneeId: string; deadline: string; priority: 'normal' | 'urgent'; description?: string; files?: File[] }) => void; onUpdateProjectLifecycle: (id: string, input: { status: string; deadline: string; nextStep: string }) => void }) {
  const [selectedProjectId, setSelectedProjectId] = useState(initialSelectedProjectId ?? projects[0]?.id ?? '')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isMissionCreateOpen, setIsMissionCreateOpen] = useState(false)
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0]
  const projectMissions = missions.filter((mission) => mission.projectId === selectedProject?.id)
  const projectCollaborators = selectedProject ? getProjectCollaborators(selectedProject, missions, team) : []
  const projectHealth = selectedProject ? getProjectHealth(selectedProject, missions, completed) : { label: 'A INICIAR', tone: 'neutral' }

  useEffect(() => {
    if (initialSelectedProjectId && projects.some((project) => project.id === initialSelectedProjectId)) setSelectedProjectId(initialSelectedProjectId)
  }, [initialSelectedProjectId, projects])

  if (!selectedProject) return <section className="projects-page"><p className="empty-state">Ainda não há projetos para acompanhar.</p></section>

  return (
    <section className="projects-page">
      <div className="projects-intro">
        <div><p className="eyebrow">CENTRAL DE PROJETOS <span>✦</span></p><h1>Ideias em<br /><em>órbita.</em></h1></div>
        <div className="projects-intro-actions"><button className="create-mission-button" onClick={() => setIsCreateOpen(true)}>NOVA FRENTE <span>+</span></button><p>Cada frente reúne as missões atribuídas ao time, com progresso calculado pelas entregas concluídas.</p></div>
      </div>

      <div className="project-overview">
        <div className="project-list-panel">
          <div className="projects-toolbar"><span>PROJETOS ATIVOS</span><b>{projects.length}</b></div>
          <div className="project-list">
            {projects.map((project) => {
              const isSelected = project.id === selectedProject.id
              return <button className={`project-list-card tone-${project.tone} ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedProjectId(project.id)} aria-pressed={isSelected} key={project.id}>
                <ClientMark project={project} className="project-list-code" />
                <span className="project-list-copy"><small>{project.status}</small><b>{project.name}</b><em>{project.deadline}</em></span>
                <span className="project-list-progress"><b>{project.progress}%</b><i><span style={{ width: `${project.progress}%` }} /></i></span>
              </button>
            })}
          </div>
        </div>

        <aside className={`project-detail tone-${selectedProject.tone}`}>
          <div className="project-detail-header"><span>{selectedProject.status}</span><ClientMark project={selectedProject} className="project-detail-client-mark" /></div>
          <h2>{selectedProject.name}</h2><p className="project-client">{selectedProject.client}</p>
          <div className="project-detail-progress"><div><span>PROGRESSO GERAL</span><b>{selectedProject.progress}%</b></div><i><span style={{ width: `${selectedProject.progress}%` }} /></i></div>
          <div className={`project-health project-health-${projectHealth.tone}`}><span>SAÚDE DA FRENTE</span><b>{projectHealth.label}</b></div>
          <div className="project-detail-section"><span>PRÓXIMO MOVIMENTO</span><p>{selectedProject.nextStep}</p></div>
          <div className="project-detail-section"><span>ÚLTIMA ATUALIZAÇÃO</span><p>{selectedProject.activity}</p></div>
          <div className="project-detail-section"><div className="project-missions-heading"><span>MISSÕES ATRIBUÍDAS</span><button onClick={() => setIsMissionCreateOpen(true)}>NOVA MISSÃO <b>+</b></button></div><div className="project-mission-list">{projectMissions.length > 0 ? projectMissions.map((mission) => { const assignee = team.find((member) => member.id === mission.assigneeId); const isComplete = completed.includes(mission.id); return <article className={isComplete ? 'completed' : ''} key={mission.id}><div><b>{mission.title}</b><small>{assignee ? assignee.name : 'Responsável a definir'}</small></div><span>{isComplete ? 'FEITA' : 'EM ABERTO'}</span></article> }) : <p className="project-mission-empty">Esta frente ainda não tem missões. Crie a primeira nesta frente.</p>}</div></div>
          <button className="project-library-button" onClick={() => setIsLibraryOpen(true)}>BIBLIOTECA DO PROJETO <span>↗</span></button>
          <button className="project-lifecycle-button" onClick={() => setIsLifecycleOpen(true)}>GERENCIAR CICLO DA FRENTE <span>↗</span></button>
          <div className="project-detail-footer"><div className="avatars">{projectCollaborators.slice(0, 3).map((member, index) => <Avatar initials={member.initials} tone={index === 1 ? 'lime' : member.tone} small key={member.id} />)}{projectCollaborators.length > 3 && <span>+{projectCollaborators.length - 3}</span>}</div><small>{projectCollaborators.length === 1 ? '1 pessoa na frente' : `${projectCollaborators.length} pessoas na frente`}</small></div>
        </aside>
      </div>
      {isCreateOpen && <ProjectCreateModal clients={clients} onClose={() => setIsCreateOpen(false)} onCreate={(input) => { onCreateProject(input); setIsCreateOpen(false) }} />}
      {isMissionCreateOpen && <MissionCreateModal projects={projects} team={team} initialProjectId={selectedProject.id} onClose={() => setIsMissionCreateOpen(false)} onCreate={(input) => { onCreateMission(input); setIsMissionCreateOpen(false) }} />}
      {isLifecycleOpen && <ProjectLifecycleModal project={selectedProject} onClose={() => setIsLifecycleOpen(false)} onUpdate={(input) => { onUpdateProjectLifecycle(selectedProject.id, input); setIsLifecycleOpen(false) }} />}
      {isLibraryOpen && <ProjectLibraryModal project={selectedProject} onClose={() => setIsLibraryOpen(false)} />}
    </section>
  )
}

function ProjectLibraryModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [library, setLibrary] = useState<ProjectLibrary>(projectLibrarySeed)
  const [selectedFolderSlug, setSelectedFolderSlug] = useState(projectLibrarySeed.folders[0]?.slug ?? '')
  const [isLoading, setIsLoading] = useState(true)
  const [hasRemoteLibrary, setHasRemoteLibrary] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [isFolderFormOpen, setIsFolderFormOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setHasRemoteLibrary(false)
    setSelectedFolderSlug(projectLibrarySeed.folders[0]?.slug ?? '')

    void getProjectLibrary(project.id).then((nextLibrary) => {
      if (!isCurrent) return
      setLibrary(nextLibrary)
      setSelectedFolderSlug(nextLibrary.folders[0]?.slug ?? '')
      setHasRemoteLibrary(true)
    }).catch(() => {
      if (isCurrent) setLibrary(projectLibrarySeed)
    }).finally(() => {
      if (isCurrent) setIsLoading(false)
    })

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      isCurrent = false
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose, project.id])

  const selectedFolder = library.folders.find((folder) => folder.slug === selectedFolderSlug) ?? library.folders[0]
  const visibleFiles = library.files.filter((file) => file.folderId === selectedFolder?.id)

  async function handleFileSelection(file: File | undefined) {
    if (!file || !selectedFolder || isUploading) return

    setIsUploading(true)
    setUploadMessage('')
    try {
      const uploadedFile = await uploadProjectLibraryFile({ projectId: project.id, folderId: selectedFolder.id, file })
      setLibrary((current) => {
        const previousFile = current.files.find((item) => item.id === uploadedFile.id)
        return {
          files: previousFile ? current.files.map((item) => item.id === uploadedFile.id ? uploadedFile : item) : [uploadedFile, ...current.files],
          folders: previousFile ? current.folders : current.folders.map((folder) => folder.id === selectedFolder.id ? { ...folder, fileCount: folder.fileCount + 1 } : folder),
        }
      })
      setHasRemoteLibrary(true)
      setUploadMessage(uploadedFile.version === 1 ? 'Arquivo enviado para a biblioteca.' : `Nova versão ${uploadedFile.version} enviada.`)
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Não foi possível enviar o arquivo')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleFolderCreation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = folderName.trim()
    if (!name || isCreatingFolder) return

    setIsCreatingFolder(true)
    setUploadMessage('')
    try {
      const folder = await createProjectLibraryFolder(project.id, name)
      setLibrary((current) => ({ ...current, folders: [...current.folders, folder] }))
      setSelectedFolderSlug(folder.slug)
      setFolderName('')
      setIsFolderFormOpen(false)
      setUploadMessage('Pasta criada para este projeto.')
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Não foi possível criar a pasta')
    } finally {
      setIsCreatingFolder(false)
    }
  }

  return <div className="mission-create-overlay project-library-overlay" role="dialog" aria-modal="true" aria-label={`Biblioteca do projeto ${project.name}`}><section className="project-library-dialog"><button className="close-button" type="button" onClick={onClose} aria-label="Fechar biblioteca do projeto">×</button><div className="project-library-head"><div><span>BIBLIOTECA DO PROJETO</span><h2>{project.name}</h2><p>{project.client} · {project.code}</p></div><ClientMark project={project} className="project-library-client-mark" /></div><div className="project-library-status"><span>ARMAZENAMENTO</span><b>Cloudflare R2 conectado na prévia local</b><small>O conteúdo, o histórico e as versões ficam separados dos metadados do D1.</small></div><div className="project-library-layout"><div className="project-library-folders"><div className="project-library-folders-head"><span>PASTAS DO CLIENTE</span><button onClick={() => setIsFolderFormOpen((current) => !current)}>NOVA +</button></div>{isFolderFormOpen && <form className="project-library-folder-form" onSubmit={handleFolderCreation}><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Ex.: Aprovações" maxLength={48} required /><button type="submit" disabled={isCreatingFolder}>{isCreatingFolder ? '…' : 'CRIAR'}</button></form>}<div>{library.folders.map((folder) => <button className={folder.slug === selectedFolder?.slug ? 'selected' : ''} onClick={() => setSelectedFolderSlug(folder.slug)} aria-pressed={folder.slug === selectedFolder?.slug} key={folder.id}><i>⌁</i><b>{folder.name}</b><small>{folder.fileCount} arquivo{folder.fileCount === 1 ? '' : 's'}</small></button>)}</div></div><div className="project-library-files"><div className="project-library-files-head"><div><span>{selectedFolder?.name ?? 'Pasta'}</span><b>{visibleFiles.length} arquivo{visibleFiles.length === 1 ? '' : 's'}</b></div><label className={`project-library-upload ${isUploading ? 'uploading' : ''}`}><input type="file" onChange={(event) => { void handleFileSelection(event.target.files?.[0]); event.currentTarget.value = '' }} disabled={isUploading} />{isUploading ? 'ENVIANDO…' : 'ADICIONAR ARQUIVO +'}</label></div>{uploadMessage && <p className="project-library-message" role="status">{uploadMessage}</p>}{isLoading && <small className="project-library-loading">Sincronizando estrutura…</small>}{visibleFiles.length > 0 ? <div className="project-library-file-list">{visibleFiles.map((file) => <article key={file.id}><i>{file.fileType}</i><div><b>{file.name}</b><small>Versão {file.version} · {file.historyCount} registro{file.historyCount === 1 ? '' : 's'} no histórico</small></div><a href={`/api/projects/${encodeURIComponent(project.id)}/library/files/${encodeURIComponent(file.id)}`}>BAIXAR</a></article>)}</div> : <div className="project-library-empty"><b>Nenhum arquivo nesta pasta</b><p>{hasRemoteLibrary ? 'Use “Adicionar arquivo” para enviar o primeiro material para esta pasta.' : 'Faça login para consultar a biblioteca persistida deste projeto.'}</p></div>}</div></div><div className="project-library-footer"><span>MEGA.nz será tratado como link compartilhado opcional, nunca como origem principal.</span><b>ARQUIVOS DE ATÉ 25 MB</b></div></section></div>
}

function ProjectLifecycleModal({ project, onClose, onUpdate }: { project: Project; onClose: () => void; onUpdate: (input: { status: string; deadline: string; nextStep: string }) => void }) {
  const [status, setStatus] = useState(project.status)
  const [deadline, setDeadline] = useState(project.deadline)
  const [nextStep, setNextStep] = useState(project.nextStep)

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Gerenciar ciclo do projeto"><form className="mission-create-dialog project-lifecycle-dialog" onSubmit={(event) => { event.preventDefault(); if (status && deadline.trim() && nextStep.trim()) onUpdate({ status, deadline: deadline.trim(), nextStep: nextStep.trim() }) }}><button className="close-button" type="button" onClick={onClose} aria-label="Fechar ciclo do projeto">×</button><span className="mission-create-icon"><Icon name="folder" size={21} /></span><p>CICLO DO PROJETO</p><h2>O que move<br /><em>{project.name}?</em></h2><label><span>STATUS DA FRENTE</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>EM CONCEPÇÃO</option><option>EM PRODUÇÃO</option><option>EM APROVAÇÃO</option><option>PAUSADO</option><option>CONCLUÍDO</option></select></label><label><span>PRÓXIMO MARCO</span><input autoFocus value={deadline} onChange={(event) => setDeadline(event.target.value)} required /></label><label><span>PRÓXIMO MOVIMENTO</span><textarea value={nextStep} onChange={(event) => setNextStep(event.target.value)} required /></label><button className="mission-create-submit" type="submit">ATUALIZAR CICLO <span>→</span></button></form></div>
}

function ProjectCreateModal({ clients, onClose, onCreate }: { clients: ClientIdentity[]; onClose: () => void; onCreate: (input: { name: string; client: string; deadline: string; tone: Project['tone'] }) => void }) {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [deadline, setDeadline] = useState('Próximo marco · em definição')
  const [tone, setTone] = useState<Project['tone']>('lime')

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Criar projeto"><form className="mission-create-dialog project-create-dialog" onSubmit={(event) => { event.preventDefault(); if (name.trim() && client && deadline.trim()) onCreate({ name: name.trim(), client, deadline: deadline.trim(), tone }) }}><button className="close-button" type="button" onClick={onClose} aria-label="Fechar criação de projeto">×</button><span className="mission-create-icon"><Icon name="folder" size={21} /></span><p>NOVA FRENTE</p><h2>Qual projeto vamos<br /><em>colocar em órbita?</em></h2><label><span>NOME DO PROJETO</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Campanha de Natal" required /></label><label><span>CLIENTE</span><select value={client} onChange={(event) => setClient(event.target.value)} required><option value="" disabled>Selecione o cliente</option>{clients.map((item) => <option value={item.name} key={item.id}>{item.name} · {item.shortCode ?? 'SEM SIGLA'}</option>)}</select><small className="project-create-client-note">Para cadastrar outro cliente, use Administração → Novo cliente.</small></label><div className="mission-create-row"><label><span>PRÓXIMO MARCO</span><input value={deadline} onChange={(event) => setDeadline(event.target.value)} placeholder="Próximo marco · em definição" required /></label><label><span>IDENTIDADE</span><select value={tone} onChange={(event) => setTone(event.target.value as Project['tone'])}><option value="lime">Lima</option><option value="purple">Roxo</option><option value="orange">Laranja</option></select></label></div><button className="mission-create-submit" type="submit" disabled={clients.length === 0}>CRIAR PROJETO <span>→</span></button></form></div>
}

function ProjectCard({ project, missions, team, onOpen }: { project: Project; missions: Mission[]; team: TeamMember[]; onOpen: () => void }) {
  const coverTone = project.tone === 'lime' ? 'project-green' : `project-${project.tone}`
  const collaborators = getProjectCollaborators(project, missions, team)

  return <article className={`project-card ${coverTone}`}><div className="project-cover"><ClientMark project={project} className="project-cover-mark" /><i /><p>TORNAR<br />POSSÍVEL</p></div><div className="project-details"><div><p>{project.status}</p><h3>{project.name}</h3></div><b>{project.progress}%</b></div><div className="project-progress"><i style={{ width: `${project.progress}%` }} /></div><div className="project-footer"><div className="avatars">{collaborators.slice(0, 3).map((member, index) => <Avatar initials={member.initials} tone={index === 1 ? 'lime' : member.tone} small key={member.id} />)}{collaborators.length > 3 && <span>+{collaborators.length - 3}</span>}</div><button onClick={onOpen}>ABRIR PROJETO <span>↗</span></button></div></article>
}

function AgendaItem({ event }: { event: AgendaEvent }) {
  return <div className="agenda-item"><span className={`agenda-dot ${event.tone}`} /><time>{event.time}</time><p><b>{event.title}</b><small>{event.subtitle}</small></p></div>
}

function ComingSoon({ title, onBack }: { title: string; onBack: () => void }) {
  return <section className="coming-soon"><p>EM CONSTRUÇÃO</p><h1>{title}</h1><span>Este módulo já tem navegação preparada. A próxima etapa conecta sua base de dados e os fluxos reais.</span><button onClick={onBack}>VOLTAR PARA O INÍCIO <span>←</span></button></section>
}

function JourneyPanel({ profile, completedCount, missionCount, totalXp, onClose }: { profile: DashboardData['profile']; completedCount: number; missionCount: number; totalXp: number; onClose: () => void }) {
  const milestones = [{ name: 'Criador', target: 0, detail: 'Transforma intenção em entrega.' }, { name: 'Visionário', target: 8700, detail: 'Enxerga possibilidades antes do óbvio.' }, { name: 'Catalisador', target: 12000, detail: 'Move pessoas e ideias para a frente.' }]
  const currentMilestone = [...milestones].reverse().find((milestone) => totalXp >= milestone.target) ?? milestones[0]
  const nextMilestone = milestones.find((milestone) => milestone.target > totalXp)
  const progressStart = currentMilestone.target
  const progressEnd = nextMilestone?.target ?? currentMilestone.target + 3000
  const progress = Math.min(100, ((totalXp - progressStart) / (progressEnd - progressStart)) * 100)
  const achievements = [{ title: 'Ritmo extraordinário', detail: 'Energia sustentada acima de 90%.', unlocked: true }, { title: 'Entrega de impacto', detail: `${completedCount} de ${missionCount} missões concluídas.`, unlocked: completedCount > 0 }, { title: 'Visão de futuro', detail: 'Alcance 12.000 XP para desbloquear.', unlocked: totalXp >= 12000 }]

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return <div className="journey-overlay" role="dialog" aria-modal="true" aria-label="Minha jornada"><div className="journey-dialog"><button className="close-button" onClick={onClose} aria-label="Fechar jornada">×</button><div className="journey-hero"><span>SEU NÍVEL ATUAL</span><div className="journey-level-mark">{currentMilestone.name.charAt(0)}</div><p>{currentMilestone.name.toUpperCase()}</p><h2>{currentMilestone.detail}</h2><small>{profile.ideas.toLocaleString('pt-BR')} ideias registradas até aqui.</small></div><div className="journey-progress"><div><span>{totalXp.toLocaleString('pt-BR')} XP</span><b>{nextMilestone ? `Faltam ${(nextMilestone.target - totalXp).toLocaleString('pt-BR')} XP para ${nextMilestone.name}` : 'Você alcançou o nível máximo atual.'}</b></div><i><span style={{ width: `${progress}%` }} /></i><div className="journey-milestones">{milestones.map((milestone) => <span className={totalXp >= milestone.target ? 'reached' : ''} key={milestone.name}><b>{milestone.name}</b><small>{milestone.target.toLocaleString('pt-BR')} XP</small></span>)}</div></div><div className="journey-achievements"><div><span>CONQUISTAS</span><h3>O que você já<br /><em>tornou possível.</em></h3></div><div className="achievement-list">{achievements.map((achievement) => <article className={achievement.unlocked ? 'unlocked' : ''} key={achievement.title}><span>{achievement.unlocked ? '✦' : '○'}</span><div><b>{achievement.title}</b><p>{achievement.detail}</p></div></article>)}</div></div></div></div>
}

function CommandPalette({ onClose, onNavigate, onOpenAi }: { onClose: () => void; onNavigate: (section: string) => void; onOpenAi: () => void }) {
  const [query, setQuery] = useState('')
  const commands = [
    ...navigation.map((item) => ({ id: item.id, label: item.label, hint: 'Abrir módulo', icon: item.icon, action: 'navigate' as const })),
    { id: 'six-ai', label: 'SIX AI', hint: 'Fazer uma pergunta', icon: 'sparkle' as IconName, action: 'ai' as const },
  ]
  const matchingCommands = commands.filter((command) => command.label.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Busca rápida"><div className="command-dialog"><div className="command-input"><Icon name="sparkle" size={17} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no SIX.OS…" aria-label="Buscar no SIX.OS" /><kbd>ESC</kbd></div><p>IR PARA</p><div className="command-list">{matchingCommands.map((command) => <button onClick={() => command.action === 'ai' ? onOpenAi() : onNavigate(command.id)} key={command.id}><span className="command-icon"><Icon name={command.icon} size={16} /></span><span><b>{command.label}</b><small>{command.hint}</small></span><i>↵</i></button>)}{matchingCommands.length === 0 && <span className="command-empty">Nenhum atalho encontrado.</span>}</div><div className="command-footer"><span><kbd>↑↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>esc</kbd> fechar</span></div></div></div>
}

function NotificationsPanel({ notifications, activities, readNotificationIds, onClose, onMarkAllRead, onMarkRead }: { notifications: AppNotification[]; activities: AppNotification[]; readNotificationIds: string[]; onClose: () => void; onMarkAllRead: () => void; onMarkRead: (id: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const visibleNotifications = notifications.filter((notification) => filter === 'all' || !readNotificationIds.includes(notification.id))
  const unreadCount = notifications.filter((notification) => !readNotificationIds.includes(notification.id)).length

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return <div className="notifications-overlay" role="dialog" aria-modal="true" aria-label="Notificações"><aside className="notifications-panel"><div className="notifications-head"><div><span>ATUALIZAÇÕES</span><h2>Notificações</h2></div><button onClick={onClose} aria-label="Fechar notificações">×</button></div><div className="notifications-controls"><div className="segmented-control"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Todas</button><button className={filter === 'unread' ? 'selected' : ''} onClick={() => setFilter('unread')}>Não lidas {unreadCount > 0 && <b>{unreadCount}</b>}</button></div><button onClick={onMarkAllRead}>MARCAR TODAS COMO LIDAS</button></div><div className="notifications-list">{visibleNotifications.map((notification) => { const isRead = readNotificationIds.includes(notification.id); return <button className={`notification-item tone-${notification.tone} ${isRead ? 'read' : ''}`} onClick={() => onMarkRead(notification.id)} key={notification.id}><span className="notification-dot" /><span><small>{notification.category} · {notification.time}</small><b>{notification.title}</b><p>{notification.description}</p></span>{!isRead && <i>novo</i>}</button> })}{visibleNotifications.length === 0 && <p className="empty-state">Nenhum aviso nesta visão.</p>}</div><div className="notifications-activity"><span>ATIVIDADE RECENTE</span><div>{activities.map((activity) => <article className={`tone-${activity.tone}`} key={activity.id}><i /><p><b>{activity.title}</b><small>{activity.description}</small></p><time>{activity.time}</time></article>)}{activities.length === 0 && <p className="notifications-empty">Nenhuma atividade recente.</p>}</div></div></aside></div>
}

type AiInsight = {
  answer: string
  action?: { label: string; section: 'agenda' | 'missions' | 'team' | 'projects' | 'analytics' }
}

function getAiInsight(question: string, dashboardData: DashboardData, completed: string[]): AiInsight {
  const normalizedQuestion = question.toLocaleLowerCase('pt-BR')
  const openMissions = dashboardData.missions.filter((mission) => !completed.includes(mission.id))

  if (normalizedQuestion.includes('sobrecarregado') || normalizedQuestion.includes('capacidade') || normalizedQuestion.includes('equipe')) {
    const highestCapacity = dashboardData.team.reduce((current, member) => member.capacity > current.capacity ? member : current)
    return { answer: `${highestCapacity.name} está com ${highestCapacity.capacity}% de capacidade e em ${highestCapacity.availability.toLocaleLowerCase('pt-BR')}. ${highestCapacity.note}`, action: { label: 'VER EQUIPE', section: 'team' } }
  }

  if (normalizedQuestion.includes('semana') || normalizedQuestion.includes('resuma') || normalizedQuestion.includes('resumo')) {
    const weeklyXp = dashboardData.analytics.weekly.reduce((total, point) => total + point.xp, 0)
    return { answer: `A semana soma ${weeklyXp.toLocaleString('pt-BR')} XP de ritmo criativo. Há ${openMissions.length} missões em aberto e ${dashboardData.analytics.deliveryRate}% das entregas seguem no prazo.`, action: { label: 'VER ANALYTICS', section: 'analytics' } }
  }

  if (normalizedQuestion.includes('cronograma') || normalizedQuestion.includes('agenda') || normalizedQuestion.includes('hoje')) {
    const todayEvents = dashboardData.agenda.filter((event) => event.day === 'Hoje')
    const nextEvent = todayEvents[0]
    return nextEvent ? { answer: `Seu próximo compromisso é “${nextEvent.title}” às ${nextEvent.time}. Depois, você tem ${todayEvents.length - 1} eventos programados hoje.`, action: { label: 'ABRIR AGENDA', section: 'agenda' } } : { answer: 'Sua agenda está livre no momento.' }
  }

  const urgentMission = openMissions.find((mission) => mission.urgent) ?? openMissions[0]
  return urgentMission ? { answer: `A prioridade mais próxima é “${urgentMission.title}” para ${urgentMission.client}, com prazo ${urgentMission.deadline}. Concluir essa missão rende +${urgentMission.xp} XP.`, action: { label: 'VER MISSÕES', section: 'missions' } } : { answer: 'Todas as missões da semana foram concluídas. É um ótimo momento para revisar os próximos projetos.' }
}

function AiPanel({ dashboardData, completed, onClose, onNavigate }: { dashboardData: DashboardData; completed: string[]; onClose: () => void; onNavigate: (section: 'agenda' | 'missions' | 'team' | 'projects' | 'analytics') => void }) {
  const [question, setQuestion] = useState('')
  const [insight, setInsight] = useState<AiInsight | null>(null)

  function ask(questionToAsk: string) {
    const trimmedQuestion = questionToAsk.trim()
    if (!trimmedQuestion) return
    setInsight(getAiInsight(trimmedQuestion, dashboardData, completed))
    setQuestion('')
  }

  return <div className="ai-overlay" role="dialog" aria-modal="true" aria-label="SIX AI"><div className="ai-dialog"><button className="close-button" onClick={onClose} aria-label="Fechar">×</button><span className="ai-dialog-icon"><Icon name="sparkle" size={24} /></span><p>SIX AI</p><h2>O que vamos<br /><em>tornar possível?</em></h2><form onSubmit={(event) => { event.preventDefault(); ask(question) }}><label><span>✦</span><input autoFocus value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pergunte sobre projetos, prazos ou ideias…" /><button type="submit" aria-label="Enviar pergunta">↵</button></label></form>{insight && <div className="ai-response"><span>LEITURA SIX AI</span><p>{insight.answer}</p>{insight.action && <button onClick={() => onNavigate(insight.action!.section)}>{insight.action.label} <b>→</b></button>}</div>}<div className="suggestions"><button onClick={() => ask('Quem está sobrecarregado?')}>Quem está sobrecarregado?</button><button onClick={() => ask('Resuma minha semana')}>Resuma minha semana</button><button onClick={() => ask('Monte um cronograma')}>Monte um cronograma</button></div></div></div>
}
