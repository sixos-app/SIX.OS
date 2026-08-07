import { type FormEvent, type ReactNode, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LogoWhite } from './Logo'
import { dashboardSeed, type AgendaEvent, type AnalyticsData, type AppNotification, type DashboardData, type LibraryResource, type Mission, type Project, type TeamMember } from './data/dashboard'
import { getAccessSession, loginWithPassword, type AccessSession } from './data/accessRepository'
import { adminOverviewPreview, createAdminClient, createAdminUser, getAdminOverview, type AdminOverview, type CreateAdminUserInput } from './data/adminRepository'
import { clientIdentitySeed, getClientIdentities, type ClientIdentity } from './data/clientRepository'
import { getDashboard } from './data/dashboardRepository'
import { createProjectLibraryFolder, getProjectLibrary, projectLibrarySeed, uploadProjectLibraryFile, type ProjectLibrary } from './data/projectLibraryRepository'
import { createClientLibraryFolder, getClientLibrary, uploadClientLibraryFile } from './data/clientLibraryRepository'
import { addMissionChecklistItem, addMissionComment, attachProjectLibraryFile, createMission as persistMissionCreate, getMissionDetails, requestMissionCompletion, setMissionChecklistItem, updateMission as persistMissionUpdate, type MissionDetails } from './data/missionRepository'
import { createCalendarEvent, deleteCalendarEvent, getAgenda, updateCalendarEvent, type AgendaPermissions, type AgendaScope, type CalendarEventRecord, type CalendarEventType, type CalendarVisibility } from './data/agendaRepository'
import { getProfileData, updateProfile, getGamificationConfig, updateGamificationConfig, type UserProfile, type ProfileData, type GamificationConfig, type Sticker, type LevelConfigItem, type RewardConfigItem } from './data/profileRepository'

type IconName =
  | 'home'
  | 'calendar'
  | 'folder'
  | 'target'
  | 'people'
  | 'sparkle'
  | 'library'
  | 'chart'
  | 'profile'
  | 'activity'

const navigation: { id: string; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Início', icon: 'home' },
  { id: 'feed', label: 'Feed', icon: 'activity' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'projects', label: 'Projetos', icon: 'folder' },
  { id: 'missions', label: 'Missões', icon: 'target' },
  { id: 'team', label: 'Equipe', icon: 'people' },
  { id: 'library', label: 'Biblioteca', icon: 'library' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'profile', label: 'Perfil', icon: 'profile' },
]

const sectionLabels: Record<string, string> = {
  feed: 'Feed da Agência',
  agenda: 'Agenda compartilhada',
  projects: 'Projetos em movimento',
  missions: 'Missões da equipe',
  team: 'Nossa equipe',
  library: 'Biblioteca SIX',
  analytics: 'Analytics',
  profile: 'Meu perfil',
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

function canManageMissions(session: AccessSession | null) {
  return session !== null && ['admin', 'management', 'coordinator'].includes(session.role)
}

function canCompleteMission(session: AccessSession | null, mission: Mission) {
  return canManageMissions(session) || (session?.role === 'specialist' && session.id === mission.assigneeId)
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
    profile: <><circle cx="12" cy="8" r="4" /><path d="M20 21c0-3.3-3.6-6-8-6s-8 2.7-8 6" /></>,
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
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

function LoginPreview({ onLoginSuccess }: { onLoginSuccess?: (session: AccessSession) => void }) {
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
      if (onLoginSuccess) {
        onLoginSuccess(result.user)
      } else {
        window.location.assign('/')
      }
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
            <LogoWhite className="login-brand-logo" />
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
  const [accessSession, setAccessSession] = useState<AccessSession | null>(null)
  const [loading, setLoading] = useState(true)
  const preview = new URLSearchParams(window.location.search).get('preview')

  useEffect(() => {
    void getAccessSession()
      .then((session) => {
        setAccessSession(session)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  if (preview === 'admin') return <AdminPage preview />

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#171717', color: '#c6ff38', fontFamily: 'monospace', fontSize: '12px' }}>
        SIX.OS CARREGANDO...
      </div>
    )
  }

  if (!accessSession && preview !== 'login') {
    return <LoginPreview onLoginSuccess={(session) => setAccessSession(session)} />
  }

  if (preview === 'login') return <LoginPreview onLoginSuccess={(session) => setAccessSession(session)} />

  return <AppShell accessSession={accessSession} setAccessSession={setAccessSession} />
}
function SettingsModal({ onClose }: { onClose: () => void }) {
  const [notifications, setNotifications] = useState(true)
  const [soundAlerts, setSoundAlerts] = useState(true)
  const [language, setLanguage] = useState('pt-BR')
  const [saved, setSaved] = useState(false)

  return (
    <div className="generic-modal-overlay" role="dialog" aria-modal="true">
      <div className="generic-modal-dialog">
        <button className="close-button" type="button" onClick={onClose}>×</button>
        <div className="generic-modal-head">
          <h2>Configurações <em>do Sistema</em></h2>
        </div>
        <form className="generic-modal-form" onSubmit={(e) => { e.preventDefault(); setSaved(true); setTimeout(onClose, 1200); }}>
          <label>
            <span>IDIOMA DA INTERFACE</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>NOTIFICAÇÕES PUSH E SISTEMA</span>
            <input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} style={{ width: 'auto' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>ALERTAS SONOROS DE MISSÃO</span>
            <input type="checkbox" checked={soundAlerts} onChange={(e) => setSoundAlerts(e.target.checked)} style={{ width: 'auto' }} />
          </label>
          {saved && <p style={{ color: '#c6ff38', fontSize: '11px', margin: 0 }}>Configurações salvas com sucesso!</p>}
          <button className="generic-modal-submit" type="submit">SALVAR CONFIGURAÇÕES →</button>
        </form>
      </div>
    </div>
  )
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newPassword || newPassword.length < 4) {
      setMessage('A nova senha deve ter no mínimo 4 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('A confirmação de senha não confere.')
      return
    }
    setSuccess(true)
    setMessage('Senha alterada com sucesso!')
    setTimeout(onClose, 1500)
  }

  return (
    <div className="generic-modal-overlay" role="dialog" aria-modal="true">
      <div className="generic-modal-dialog">
        <button className="close-button" type="button" onClick={onClose}>×</button>
        <div className="generic-modal-head">
          <h2>Alterar <em>Senha</em></h2>
        </div>
        <form className="generic-modal-form" onSubmit={handleSubmit}>
          <label>
            <span>SENHA ATUAL</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </label>
          <label>
            <span>NOVA SENHA</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </label>
          <label>
            <span>CONFIRMAR NOVA SENHA</span>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </label>
          {message && <p style={{ color: success ? '#c6ff38' : '#ff5936', fontSize: '11px', margin: 0 }}>{message}</p>}
          <button className="generic-modal-submit" type="submit">ATUALIZAR SENHA →</button>
        </form>
      </div>
    </div>
  )
}

function PreferencesModal({ onClose }: { onClose: () => void }) {
  const [density, setDensity] = useState('comfortable')
  const [landingSection, setLandingSection] = useState('home')
  const [saved, setSaved] = useState(false)

  return (
    <div className="generic-modal-overlay" role="dialog" aria-modal="true">
      <div className="generic-modal-dialog">
        <button className="close-button" type="button" onClick={onClose}>×</button>
        <div className="generic-modal-head">
          <h2>Preferências <em>de Exibição</em></h2>
        </div>
        <form className="generic-modal-form" onSubmit={(e) => { e.preventDefault(); setSaved(true); setTimeout(onClose, 1200); }}>
          <label>
            <span>DENSIDADE DA INTERFACE</span>
            <select value={density} onChange={(e) => setDensity(e.target.value)}>
              <option value="comfortable">Confortável (Padrão SIX)</option>
              <option value="compact">Compacto (Alta Densidade)</option>
            </select>
          </label>
          <label>
            <span>TELA INICIAL DE ABERTURA</span>
            <select value={landingSection} onChange={(e) => setLandingSection(e.target.value)}>
              <option value="home">Início (Dashboard)</option>
              <option value="feed">Feed da Agência</option>
              <option value="missions">Missões</option>
              <option value="agenda">Agenda</option>
            </select>
          </label>
          {saved && <p style={{ color: '#c6ff38', fontSize: '11px', margin: 0 }}>Preferências salvas!</p>}
          <button className="generic-modal-submit" type="submit">SALVAR PREFERÊNCIAS →</button>
        </form>
      </div>
    </div>
  )
}


function TeamMemberProfileModal({ member, team, missions, projects, onClose }: { member: TeamMember; team: TeamMember[]; missions: Mission[]; projects: Project[]; completed?: string[]; onClose: () => void }) {
  const memberMissions = missions.filter(m => m.assigneeId === member.id)
  const completedCount = memberMissions.filter(m => m.status === 'completed' || m.approvalStatus === 'approved').length
  const memberProjects = projects.filter(p => (p as any).teamIds?.includes(member.id) || p.client.toLowerCase().includes(member.name.toLowerCase()))
  const initials = member.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="generic-modal-overlay" role="dialog" aria-modal="true">
      <div className="team-member-modal">
        <button className="close-button" type="button" onClick={onClose}>×</button>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '20px', marginBottom: '24px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#c6ff38', color: '#111', display: 'grid', placeItems: 'center', fontSize: '24px', fontWeight: '900' }}>
            {initials}
          </div>
          <div>
            <span style={{ fontSize: '9px', fontWeight: '900', letterSpacing: '1.2px', color: '#c6ff38', textTransform: 'uppercase' }}>{member.role}</span>
            <h1 style={{ margin: '2px 0 4px', fontSize: '26px', letterSpacing: '-1px' }}>{member.name}</h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#aaa' }}>{((member as any).email || `${member.name.toLowerCase().replace(/\s+/g, ".")}@agenciasix.com.br`)} · {member.availability}</p>
          </div>
        </div>

        <div className="profile-stats-grid" style={{ marginTop: 0, marginBottom: '24px' }}>
          <div className="profile-stat-card highlight" style={{ background: '#c6ff38', borderColor: '#c6ff38' }}>
            <span style={{ color: '#171717' }}>CAPACIDADE ATUAL</span>
            <b style={{ color: '#171717' }}>{member.capacity}%</b>
            <small style={{ color: 'rgba(0,0,0,0.6)' }}>alocação em projetos</small>
          </div>
          <div className="profile-stat-card">
            <span>MISSÕES</span>
            <b>{memberMissions.length}</b>
            <small>{completedCount} concluídas</small>
          </div>
          <div className="profile-stat-card">
            <span>PROJETOS</span>
            <b>{memberProjects.length || 1}</b>
            <small>frentes ativas</small>
          </div>
          <div className="profile-stat-card">
            <span>STATUS</span>
            <b style={{ fontSize: '14px', textTransform: 'uppercase', color: '#c6ff38' }}>{member.availability}</b>
            <small>disponibilidade</small>
          </div>
        </div>

        <div className="profile-content">
          <div>
            <section className="profile-section">
              <div className="profile-section-head">
                <div><span>OPERAÇÃO</span><h2>Missões <em>Atribuídas</em></h2></div>
              </div>
              <div className="mission-list">
                {memberMissions.map((m) => (
                  <div key={m.id} className="mission-card" style={{ gridTemplateColumns: '1fr auto', minHeight: '60px', padding: '10px 14px' }}>
                    <div>
                      <b style={{ fontSize: '12px', display: 'block' }}>{m.title}</b>
                      <small style={{ color: '#888', fontSize: '10px' }}>{m.client} · Prazo {m.deadline}</small>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: m.status === 'completed' ? '#c6ff38' : '#ff7047' }}>
                      +{m.xp} XP
                    </span>
                  </div>
                ))}
                {memberMissions.length === 0 && <p className="empty-state">Nenhuma missão atribuída no momento.</p>}
              </div>
            </section>
          </div>

          <div>
            <section className="profile-section">
              <div className="profile-section-head">
                <div><span>NOTA OPERACIONAL</span><h2>Resumo <em>do Perfil</em></h2></div>
              </div>
              <p style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.6, margin: 0 }}>{member.note}</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function MissionHandoffModal({ mission, team, onClose, onHandoff }: { mission: Mission; team: TeamMember[]; onClose: () => void; onHandoff: (nextStage: string, assigneeId: string, note: string) => void }) {
  const stages = ['Concepção', 'Atendimento', 'Redação', 'Criação', 'Revisão', 'Entrega']
  const [nextStage, setNextStage] = useState(stages[0])
  const [assigneeId, setAssigneeId] = useState(team[0]?.id ?? '')
  const [note, setNote] = useState('')

  return (
    <div className="generic-modal-overlay" role="dialog" aria-modal="true">
      <div className="generic-modal-dialog">
        <button className="close-button" type="button" onClick={onClose}>×</button>
        <div className="generic-modal-head">
          <h2>Encaminhar <em>Missão</em></h2>
        </div>
        <p style={{ fontSize: '11px', color: '#aaa', margin: '0 0 16px' }}>Missão: <b>{mission.title}</b> ({mission.client})</p>
        <form className="generic-modal-form" onSubmit={(e) => {
          e.preventDefault()
          if (nextStage && assigneeId) {
            onHandoff(nextStage, assigneeId, note.trim())
          }
        }}>
          <label>
            <span>PRÓXIMA ETAPA DO FLUXO DE AGÊNCIA</span>
            <select value={nextStage} onChange={(e) => setNextStage(e.target.value)}>
              {stages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            <span>PRÓXIMO RESPONSÁVEL</span>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              {team.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
            </select>
          </label>
          <label>
            <span>NOTA DE ENCAMINHAMENTO / INSTRUÇÕES</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Descreva observações ou direcionamentos para a próxima etapa…" maxLength={1000} />
          </label>
          <button className="generic-modal-submit" type="submit">ENCAMINHAR ETAPA E NOTIFICAR →</button>
        </form>
      </div>
    </div>
  )
}

function AdminResetPasswordModal({ member, onClose, onReset }: { member: any; onClose: () => void; onReset: (newPassword: string) => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [done, setDone] = useState(false)

  return (
    <div className="generic-modal-overlay" role="dialog" aria-modal="true">
      <div className="generic-modal-dialog">
        <button className="close-button" type="button" onClick={onClose}>×</button>
        <div className="generic-modal-head">
          <h2>Redefinir Senha <em>de {member.name}</em></h2>
        </div>
        <form className="generic-modal-form" onSubmit={(e) => {
          e.preventDefault()
          if (newPassword.trim()) {
            onReset(newPassword.trim())
            setDone(true)
            setTimeout(onClose, 1200)
          }
        }}>
          <label>
            <span>NOVA SENHA INICIAL</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Digite a nova senha..." required />
          </label>
          {done && <p style={{ color: '#c6ff38', fontSize: '11px', margin: 0 }}>Senha redefinida com sucesso!</p>}
          <button className="generic-modal-submit" type="submit">REDEFINIR SENHA →</button>
        </form>
      </div>
    </div>
  )
}

function AdminEditUserPermissionsModal({ member, roles, onClose, onSave }: { member: any; roles: any[]; onClose: () => void; onSave: (role: string, department: string) => void }) {
  const [selectedRole, setSelectedRole] = useState(member.role)
  const [department, setDepartment] = useState('Criação & Conteúdo')
  const [done, setDone] = useState(false)

  return (
    <div className="generic-modal-overlay" role="dialog" aria-modal="true">
      <div className="generic-modal-dialog">
        <button className="close-button" type="button" onClick={onClose}>×</button>
        <div className="generic-modal-head">
          <h2>Editar Permissões <em>de {member.name}</em></h2>
        </div>
        <form className="generic-modal-form" onSubmit={(e) => {
          e.preventDefault()
          onSave(selectedRole, department)
          setDone(true)
          setTimeout(onClose, 1200)
        }}>
          <label>
            <span>CARGO E ESCOPO RBAC</span>
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              {roles.map(r => <option key={r.code} value={r.code}>{r.name} ({r.permissionCount} permissões)</option>)}
            </select>
          </label>
          <label>
            <span>DEPARTAMENTO</span>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="Atendimento">Atendimento</option>
              <option value="Redação & Conteúdo">Redação & Conteúdo</option>
              <option value="Criação & Design">Criação & Design</option>
              <option value="Mídia & Analytics">Mídia & Analytics</option>
              <option value="Tecnologia">Tecnologia</option>
              <option value="Administração">Administração</option>
            </select>
          </label>
          {done && <p style={{ color: '#c6ff38', fontSize: '11px', margin: 0 }}>Permissões atualizadas com sucesso!</p>}
          <button className="generic-modal-submit" type="submit">SALVAR PERMISSÕES →</button>
        </form>
      </div>
    </div>
  )
}

function AppleCalendar({ agenda, missions, team, onAddEvent }: { agenda: AgendaEvent[]; missions: Mission[]; team: TeamMember[]; onAddEvent: (event: any) => void }) {
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly' | 'daily'>('monthly')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isAddEventOpen, setIsAddEventOpen] = useState(false)
  const [editingDayPopup, setEditingDayPopup] = useState<{ day: number; event: any | null } | null>(null)

  const events = useMemo(() => {
    const items = agenda.map(a => ({
      id: a.id,
      title: a.title,
      date: a.day === 'Hoje' ? new Date().toISOString().slice(0, 10) : '2026-08-05',
      time: a.time,
      type: (a.title.toLowerCase().includes('reunião') || a.title.toLowerCase().includes('sync') ? 'reuniao' : a.title.toLowerCase().includes('aniversário') ? 'aniversario' : 'compromisso'),
      categoryLabel: a.title.toLowerCase().includes('reunião') ? 'Reunião' : 'Compromisso',
      description: (a as any).project ?? (a as any).scope
    }))

    const missionEvents = missions.map(m => ({
      id: `m-${m.id}`,
      title: `Prazo: ${m.title}`,
      date: '2026-08-05',
      time: '18:00',
      type: 'missao',
      categoryLabel: 'Missão',
      description: `${m.client} · ${(m as any).assignee || "Responsável"}`
    }))

    const birthdays = [
      { id: 'bday-1', title: 'Aniversário de Lorraine', date: '2026-08-12', time: 'Dia todo', type: 'aniversario', categoryLabel: 'Aniversário', description: 'Redação & Conteúdo' },
      { id: 'bday-2', title: 'Aniversário de Guilherme', date: '2026-08-24', time: 'Dia todo', type: 'aniversario', categoryLabel: 'Aniversário', description: 'Administração & Tech' }
    ]

    return [...items, ...missionEvents, ...birthdays]
  }, [agenda, missions])

  const filteredEvents = events.filter(e => selectedCategory === 'all' || e.type === selectedCategory)
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <section className="apple-calendar">
      <div className="apple-calendar-header">
        <div>
          <span className="eyebrow">AGENDA SINCRO NATIVA ✦ APPLE STYLE</span>
          <h2 style={{ margin: 0, fontSize: '24px', letterSpacing: '-1px' }}>Agosto de <em>2026</em></h2>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="apple-calendar-views">
            <button className={viewMode === 'monthly' ? 'active' : ''} onClick={() => setViewMode('monthly')}>MENSAL</button>
            <button className={viewMode === 'weekly' ? 'active' : ''} onClick={() => setViewMode('weekly')}>SEMANAL</button>
            <button className={viewMode === 'daily' ? 'active' : ''} onClick={() => setViewMode('daily')}>DIÁRIO</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', background: selectedCategory === 'all' ? '#171717' : '#eee', color: selectedCategory === 'all' ? '#c6ff38' : '#333', border: 0, cursor: 'pointer', fontWeight: 700 }} onClick={() => setSelectedCategory('all')}>TODOS</button>
        <button style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', background: selectedCategory === 'reuniao' ? '#4328b7' : '#e0dbff', color: selectedCategory === 'reuniao' ? '#fff' : '#4328b7', border: 0, cursor: 'pointer', fontWeight: 700 }} onClick={() => setSelectedCategory('reuniao')}>REUNIÕES</button>
        <button style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', background: selectedCategory === 'missao' ? '#2e4e00' : '#e2f9a2', color: selectedCategory === 'missao' ? '#fff' : '#2e4e00', border: 0, cursor: 'pointer', fontWeight: 700 }} onClick={() => setSelectedCategory('missao')}>MISSÕES & PRAZOS</button>
        <button style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', background: selectedCategory === 'aniversario' ? '#8d1c5a' : '#ffe6f3', color: selectedCategory === 'aniversario' ? '#fff' : '#8d1c5a', border: 0, cursor: 'pointer', fontWeight: 700 }} onClick={() => setSelectedCategory('aniversario')}>ANIVERSÁRIOS</button>
      </div>

      {viewMode === 'monthly' && (
        <>
          <div className="week-days" style={{ gridTemplateColumns: 'repeat(7, 1fr)', fontSize: '10px', fontWeight: '800', textAlign: 'center', marginBottom: '8px', color: '#888' }}>
            <span>DOM</span><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span>
          </div>
          <div className="apple-calendar-grid">
            {daysInMonth.map((day) => {
              const isToday = day === 4 || day === 5
              const dayEvents = filteredEvents.slice((day * 3) % filteredEvents.length, ((day * 3) % filteredEvents.length) + 2)
              return (
                <div key={day} className={`apple-calendar-day ${isToday ? 'today' : ''}`} onClick={() => setEditingDayPopup({ day, event: dayEvents[0] || null })}>
                  <b style={{ color: isToday ? '#171717' : '#555', fontWeight: isToday ? '900' : '600' }}>{day}</b>
                  {dayEvents.map((ev, idx) => (
                    <span key={idx} className={`apple-calendar-event ${ev.type}`} onClick={(e) => { e.stopPropagation(); setEditingDayPopup({ day, event: ev }); }}>
                      {ev.time !== 'Dia todo' ? `${ev.time} ` : ''}{ev.title}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}

      {viewMode === 'weekly' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginTop: '16px' }}>
          {['Segunda (04)', 'Terça (05)', 'Quarta (06)', 'Quinta (07)', 'Sexta (08)', 'Sábado (09)', 'Domingo (10)'].map((dayLabel, idx) => (
            <div key={idx} style={{ background: '#f7f6f2', padding: '12px', borderRadius: '10px', border: '1px solid #e2e2db' }}>
              <b style={{ fontSize: '11px', display: 'block', marginBottom: '10px', color: '#171717' }}>{dayLabel}</b>
              <div style={{ display: 'grid', gap: '6px' }}>
                {filteredEvents.slice(idx % filteredEvents.length, (idx % filteredEvents.length) + 2).map((ev, eIdx) => (
                  <div key={eIdx} className={`apple-calendar-event ${ev.type}`} style={{ padding: '6px 8px' }}>
                    <small style={{ display: 'block', fontSize: '8px', opacity: 0.8 }}>{ev.time}</small>
                    <b>{ev.title}</b>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'daily' && (
        <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
          <b style={{ fontSize: '14px' }}>Compromissos do Dia (05 de Agosto)</b>
          {filteredEvents.map((ev, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', background: '#f7f6f2', borderRadius: '10px', borderLeft: `4px solid ${ev.type === 'reuniao' ? '#4328b7' : ev.type === 'missao' ? '#c6ff38' : '#8d1c5a'}` }}>
              <time style={{ fontWeight: '800', fontSize: '12px', minWidth: '60px' }}>{ev.time}</time>
              <div>
                <b style={{ fontSize: '13px', display: 'block' }}>{ev.title}</b>
                <small style={{ color: '#666', fontSize: '10px' }}>{ev.description}</small>
              </div>
              <span className={`apple-calendar-event ${ev.type}`} style={{ marginLeft: 'auto' }}>{ev.categoryLabel}</span>
            </div>
          ))}
        </div>
      )}

      {isAddEventOpen && (
        <div className="generic-modal-overlay" role="dialog">
          <div className="generic-modal-dialog">
            <button className="close-button" type="button" onClick={() => setIsAddEventOpen(false)}>×</button>
            <div className="generic-modal-head">
              <h2>Novo <em>Evento / Reunião</em></h2>
            </div>
            <form className="generic-modal-form" onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              onAddEvent({
                id: `agenda-${Date.now()}`,
                title: formData.get('title') as string,
                day: 'Hoje',
                time: formData.get('time') as string,
                scope: formData.get('scope') as string,
                project: formData.get('project') as string
              })
              setIsAddEventOpen(false)
            }}>
              <label>
                <span>TÍTULO DO EVENTO</span>
                <input name="title" required placeholder="Ex: Reunião de Alinhamento com Atendimento" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  <span>HORÁRIO</span>
                  <input name="time" type="time" defaultValue="14:00" required />
                </label>
                <label>
                  <span>TIPO DE EVENTO</span>
                  <select name="scope">
                    <option value="Reunião Pessoal">Reunião Pessoal</option>
                    <option value="Reunião de Equipe">Reunião de Equipe</option>
                    <option value="Prazos">Prazo de Entrega</option>
                    <option value="Compromisso">Compromisso</option>
                  </select>
                </label>
              </div>
              <label>
                <span>PROJETO VINCULADO (OPCIONAL)</span>
                <input name="project" placeholder="Ex: Sicredi — Campanha Conectados" />
              </label>
              <button className="generic-modal-submit" type="submit">CRIAR EVENTO E AGENDAR →</button>
            </form>
          </div>
        </div>
      )}

      {editingDayPopup && (
        <div className="generic-modal-overlay" role="dialog" aria-modal="true">
          <div className="generic-modal-dialog" style={{ width: 'min(480px, 100%)' }}>
            <button className="close-button" type="button" onClick={() => setEditingDayPopup(null)}>×</button>
            <div className="generic-modal-head">
              <h2>{editingDayPopup.event ? 'Editar Evento' : 'Novo Evento no Dia'} <em>{editingDayPopup.day} de Agosto</em></h2>
            </div>
            <form className="generic-modal-form" onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              onAddEvent({
                id: editingDayPopup.event ? editingDayPopup.event.id : `event-day-${editingDayPopup.day}-${Date.now()}`,
                title: formData.get('title') as string,
                day: 'Hoje',
                time: formData.get('time') as string,
                scope: formData.get('scope') as string,
                project: formData.get('project') as string
              })
              setEditingDayPopup(null)
            }}>
              <label>
                <span>TÍTULO DO EVENTO</span>
                <input name="title" defaultValue={editingDayPopup.event?.title ?? ''} required placeholder="Ex: Reunião de Alinhamento" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  <span>HORÁRIO</span>
                  <input name="time" type="time" defaultValue={editingDayPopup.event?.time && editingDayPopup.event.time !== 'Dia todo' ? editingDayPopup.event.time : '14:00'} required />
                </label>
                <label>
                  <span>CATEGORIA</span>
                  <select name="scope" defaultValue={editingDayPopup.event?.categoryLabel ?? 'Reunião Pessoal'}>
                    <option value="Reunião Pessoal">Reunião Pessoal</option>
                    <option value="Reunião de Equipe">Reunião de Equipe</option>
                    <option value="Prazo">Prazo de Entrega</option>
                    <option value="Compromisso">Compromisso</option>
                  </select>
                </label>
              </div>
              <label>
                <span>DETALHES / PROJETO</span>
                <input name="project" defaultValue={editingDayPopup.event?.description ?? ''} placeholder="Ex: Projeto Sicredi" />
              </label>
              <button className="generic-modal-submit" type="submit">
                {editingDayPopup.event ? 'SALVAR ALTERAÇÕES →' : 'CRIAR EVENTO →'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="generic-modal-overlay" role="dialog" aria-modal="true">
      <div className="generic-modal-dialog">
        <button className="close-button" type="button" onClick={onClose}>×</button>
        <div className="generic-modal-head">
          <h2>Ajuda & <em>Suporte SIX.OS</em></h2>
        </div>
        <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#ccc' }}>
          <h3 style={{ color: '#c6ff38', fontSize: '14px', margin: '0 0 10px' }}>Atalhos de Teclado Rápido</h3>
          <ul style={{ paddingLeft: '20px', margin: '0 0 20px' }}>
            <li><kbd style={{ background: '#333', padding: '2px 6px', borderRadius: '4px' }}>⌘ K</kbd> — Abrir Busca Global e Comandos</li>
            <li><kbd style={{ background: '#333', padding: '2px 6px', borderRadius: '4px' }}>Esc</kbd> — Fechar modais e janelas sobrepostas</li>
          </ul>
          <h3 style={{ color: '#c6ff38', fontSize: '14px', margin: '0 0 10px' }}>Suporte da Operação</h3>
          <p style={{ margin: '0 0 10px' }}>Dúvidas ou problemas operacionais? Fale diretamente com a equipe de tecnologia da SIX através do e-mail <b>suporte@sixos.app</b>.</p>
        </div>
      </div>
    </div>
  )
}
function AppShell({ accessSession, setAccessSession }: { accessSession: AccessSession | null; setAccessSession: (session: AccessSession | null) => void }) {
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
  const [clientIdentities, setClientIdentities] = useState<ClientIdentity[]>(clientIdentitySeed)
  const [dashboardData, setDashboardData] = useState(() => ({ ...dashboardSeed, missions: applyStoredMissionAssignees([...dashboardSeed.missions, ...getStoredCustomMissions()]), projects: applyStoredProjectEdits([...dashboardSeed.projects, ...getStoredCustomProjects()]) }))
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<'settings' | 'change-password' | 'preferences' | 'help' | null>(null)

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    setAccessSession(null)
    window.location.assign('/?preview=login')
  }

  const [feedItemsCount, setFeedItemsCount] = useState(0)
  const [seenFeedCount, setSeenFeedCount] = useState(() => {
    return parseInt(localStorage.getItem('sixos_seen_feed') || '0', 10) || 0
  })

  useEffect(() => {
    void getDashboard().then((dashboard) => setDashboardData({ ...dashboard, missions: applyStoredMissionAssignees([...dashboard.missions, ...getStoredCustomMissions()]), projects: applyStoredProjectEdits([...dashboard.projects, ...getStoredCustomProjects()]) }))
    void getClientIdentities().then(setClientIdentities).catch(() => undefined)

    function checkFeed() {
      fetch('/api/feed')
        .then(res => res.json())
        .then((data: any) => {
          if (Array.isArray(data)) {
            setFeedItemsCount(data.length)
          }
        })
        .catch(() => undefined)
    }
    checkFeed()
    const interval = setInterval(checkFeed, 30000)
    return () => clearInterval(interval)
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
    void fetch('/api/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'project_created',
        title: 'iniciou o projeto',
        targetName: input.name,
        link: '/?section=projects'
      })
    }).catch(() => undefined)
    return project
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
          <LogoWhite className="brand-logo" />
        </button>

        <nav className="main-nav" aria-label="Navegação principal">
          <p className="nav-caption">SEU ESPAÇO</p>
          {navigation.slice(0, 5).map((item) => {
            const hasNewFeed = item.id === 'feed' && feedItemsCount > seenFeedCount
            return (
              <button
                className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id)
                  if (item.id === 'feed') {
                    setSeenFeedCount(feedItemsCount)
                    localStorage.setItem('sixos_seen_feed', String(feedItemsCount))
                  }
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.id === 'missions' && activeMissionCount > 0 && <b>{activeMissionCount}</b>}
                {hasNewFeed && <span style={{ marginLeft: 'auto', background: '#8b73ff', width: '7px', height: '7px', borderRadius: '50%', boxShadow: '0 0 8px #8b73ff', border: '1px solid #c6ff38' }} />}
              </button>
            )
          })}
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

        <div className="account-container">
          {isAccountMenuOpen && (
            <div className="account-popover-menu">
              <button type="button" onClick={() => { setIsAccountMenuOpen(false); setActiveSection('profile'); }}>
                <Icon name="profile" /> <span>Meu Perfil</span>
              </button>
              <button type="button" onClick={() => { setIsAccountMenuOpen(false); setActiveModal('settings'); }}>
                <span>⚙️</span> <span>Configurações</span>
              </button>
              <button type="button" onClick={() => { setIsAccountMenuOpen(false); setActiveModal('change-password'); }}>
                <span>🔑</span> <span>Alterar senha</span>
              </button>
              <button type="button" onClick={() => { setIsAccountMenuOpen(false); setActiveModal('preferences'); }}>
                <span>🎛️</span> <span>Preferências</span>
              </button>
              <button type="button" onClick={() => { setIsAccountMenuOpen(false); setActiveModal('help'); }}>
                <span>❓</span> <span>Ajuda & Suporte</span>
              </button>
              <div className="menu-divider" />
              <button className="danger" type="button" onClick={() => { setIsAccountMenuOpen(false); void handleLogout(); }}>
                <span>🚪</span> <span>Sair</span>
              </button>
            </div>
          )}
          <button className="account" type="button" onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}>
            <Avatar initials={accessSession ? getInitials(accessSession.name) : 'GS'} tone="photo" small />
            <span><b>{accessSession?.name ?? 'Guilherme'}</b><small>{accessSession ? accessSession.role === 'admin' ? 'Administrador' : 'Sessão SIX' : 'Modo local'}</small></span>
            <span>•••</span>
          </button>
        </div>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <div className="crumb"><span>Segunda-feira</span><i /> <strong>04 de agosto</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => setIsCommandOpen(true)} aria-label="Pesquisar">⌘ K</button>
            <button className="round-button" onClick={() => setIsNotificationsOpen(true)} aria-label="Notificações">⌁{unreadNotificationCount > 0 && <span />}</button>
            <button className="date-chip" onClick={() => setActiveSection("agenda")} aria-label="Abrir agenda completa">Hoje <span>⌄</span></button>
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
            onViewFeed={() => setActiveSection('feed')}
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
            accessSession={accessSession}
            onReassignMission={reassignMission}
            onUpdateMission={updateMission}
          />
        ) : activeSection === 'projects' ? (
          <ProjectsPage projects={projectsWithMissionProgress} clients={clientIdentities} initialSelectedProjectId={libraryProjectId} missions={dashboardData.missions} completed={completedMissionIds} team={dashboardData.team} canManageMissions={canManageMissions(accessSession)} onCreateProject={createProject} onCreateMission={createMission} onUpdateProjectLifecycle={updateProjectLifecycle} />
        ) : activeSection === 'agenda' ? (
          <AgendaPage events={dashboardData.agenda} missions={dashboardData.missions} projects={projectsWithMissionProgress} team={dashboardData.team} completed={completedMissionIds} accessSession={accessSession} />
        ) : activeSection === 'team' ? (
          <TeamPage members={dashboardData.team} missions={dashboardData.missions} projects={projectsWithMissionProgress} completed={completedMissionIds} />
        ) : activeSection === 'analytics' ? (
          <AnalyticsPage analytics={dashboardData.analytics} projects={projectsWithMissionProgress} missions={dashboardData.missions} team={dashboardData.team} completed={completedMissionIds} totalXp={totalXp} baseXp={dashboardData.profile.xp} />
        ) : activeSection === 'profile' ? (
          <ProfilePage accessSession={accessSession} onLogoutSuccess={() => setAccessSession(null)} />
        ) : activeSection === 'feed' ? (
          <FeedPage team={dashboardData.team} />
        ) : activeSection === 'library' ? (
          <LibraryPage resources={dashboardData.library} clients={clientIdentities} projects={projectsWithMissionProgress} onOpenProject={(projectId) => { setLibraryProjectId(projectId); setActiveSection('projects') }} />
        ) : activeSection === 'admin' && accessSession?.role === 'admin' ? (
          <AdminPage onClientCreated={(client) => setClientIdentities((current) => [...current.filter((item) => item.id !== client.id), client])} />
        ) : (
          <ComingSoon title={sectionLabels[activeSection]} onBack={() => setActiveSection('home')} />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navigation.slice(0, 5).map((item) => {
          const hasNewFeed = item.id === 'feed' && feedItemsCount > seenFeedCount
          return (
            <button
              className={activeSection === item.id ? 'active' : ''}
              key={item.id}
              onClick={() => {
                setActiveSection(item.id)
                if (item.id === 'feed') {
                  setSeenFeedCount(feedItemsCount)
                  localStorage.setItem('sixos_seen_feed', String(feedItemsCount))
                }
              }}
              style={{ position: 'relative' }}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
              {hasNewFeed && <span style={{ position: 'absolute', top: '6px', right: '14px', background: '#8b73ff', width: '6px', height: '6px', borderRadius: '50%', boxShadow: '0 0 8px #8b73ff', border: '1px solid #c6ff38' }} />}
            </button>
          )
        })}
      </nav>

      {isAiOpen && <AiPanel dashboardData={dashboardData} completed={completed} onClose={() => setIsAiOpen(false)} onNavigate={(section) => { setActiveSection(section); setIsAiOpen(false) }} />}
      {isCommandOpen && <CommandPalette onClose={() => setIsCommandOpen(false)} onNavigate={(section) => { setActiveSection(section); setIsCommandOpen(false) }} onOpenAi={() => { setIsAiOpen(true); setIsCommandOpen(false) }} />}
      {isNotificationsOpen && <NotificationsPanel notifications={operationalNotifications} activities={recentActivities} readNotificationIds={readNotificationIds} onClose={() => setIsNotificationsOpen(false)} onMarkAllRead={markAllNotificationsRead} onMarkRead={markNotificationRead} />}
      {isJourneyOpen && <JourneyPanel profile={dashboardData.profile} completedCount={completed.length} missionCount={dashboardData.missions.length} totalXp={totalXp} onClose={() => setIsJourneyOpen(false)} />}
      {completionMessage && <div className="completion-toast" role="status"><span>✦</span>{completionMessage}<button onClick={() => setCompletionMessage('')} aria-label="Fechar aviso">×</button></div>}
      {activeModal === 'settings' && <SettingsModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'change-password' && <ChangePasswordModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'preferences' && <PreferencesModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'help' && <HelpModal onClose={() => setActiveModal(null)} />}
    </main>
  )
}

function AdminPage({ preview = false, onClientCreated = () => undefined }: { preview?: boolean; onClientCreated?: (client: ClientIdentity) => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(preview ? adminOverviewPreview : null)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<'user' | 'client' | null>(null)
  const [gamificationConfig, setGamificationConfig] = useState<GamificationConfig | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configMessage, setConfigMessage] = useState('')

  const [slackWebhook, setSlackWebhook] = useState('')
  const [savingSlack, setSavingSlack] = useState(false)
  const [runrunToken, setRunrunToken] = useState('')
  const [savingRunrun, setSavingRunrun] = useState(false)
  const [integrationMessage, setIntegrationMessage] = useState('')

  useEffect(() => {
    if (preview) return
    void getAdminOverview().then((res) => { setOverview(res); setError('') }).catch(() => { setOverview(adminOverviewPreview); setError('') })
    void getGamificationConfig().then(setGamificationConfig).catch(() => undefined)

    fetch('/api/admin/integrations')
      .then(res => res.json())
      .then((data: any) => {
        if (Array.isArray(data)) {
          const slack = data.find(item => item.provider === 'slack')
          const runrun = data.find(item => item.provider === 'runrunit')
          if (slack?.configJson) {
            try {
              setSlackWebhook(JSON.parse(slack.configJson).webhookUrl || '')
            } catch {}
          }
          if (runrun?.configJson) {
            try {
              setRunrunToken(JSON.parse(runrun.configJson).token || '')
            } catch {}
          }
        }
      })
      .catch(() => undefined)
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

  async function handleSaveConfig() {
    if (!gamificationConfig) return
    setSavingConfig(true)
    setConfigMessage('')
    try {
      await updateGamificationConfig(gamificationConfig)
      setConfigMessage('Configurações de gamificação salvas com sucesso!')
      setTimeout(() => setConfigMessage(''), 3000)
    } catch (reason: unknown) {
      setConfigMessage(reason instanceof Error ? reason.message : 'Erro ao salvar configurações')
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleSaveIntegration(provider: string, configJson: string, isActive: boolean) {
    if (provider === 'slack') setSavingSlack(true)
    if (provider === 'runrunit') setSavingRunrun(true)
    setIntegrationMessage('')
    try {
      const res = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, configJson, isActive })
      })
      if (!res.ok) throw new Error()
      setIntegrationMessage(`Integração com ${provider} salva com sucesso!`)
      setTimeout(() => setIntegrationMessage(''), 3000)
    } catch {
      setIntegrationMessage('Erro ao salvar integração.')
    } finally {
      setSavingSlack(false)
      setSavingRunrun(false)
    }
  }

  return <div className="admin-page">
    <section className="admin-intro">
      <div><span>PAINEL ADMINISTRATIVO</span><h1>Controle a <em>operação.</em></h1><p>Colaboradores, cargos e configurações centrais da Agência SIX em um só lugar.</p></div>
      <div className="admin-intro-side"><div className="admin-status"><i /><span>{preview ? 'PRÉVIA LOCAL' : 'ACESSO ADMINISTRATIVO'}</span><b>{preview ? 'Painel em demonstração' : 'Permissões verificadas'}</b></div>{!preview && <div className="admin-actions"><button onClick={() => setDialog('user')}>NOVO COLABORADOR <span>+</span></button><button onClick={() => setDialog('client')}>NOVO CLIENTE <span>+</span></button></div>}</div>
    </section>

    {error && !data ? <p className="admin-error">{error}</p> : <>
      <section className="admin-metrics">
        <article><span>COLABORADORES</span><b>{data.team.length}</b><small>Perfis ativos na organização</small></article>
        <article><span>CARGOS CONFIGURADOS</span><b>{data.roles.length}</b><small>Escopos prontos para aplicar</small></article>
        <article><span>CLIENTES CADASTRADOS</span><b>{data.clientCount}</b><small>Base operacional atual</small></article>
        <article className="admin-metric-highlight"><span>CONTA ADMIN</span><b>agsix</b><small>Perfil administrative criado</small></article>
      </section>

      <section className="admin-grid">
        <article className="admin-card admin-team-card"><div className="admin-card-head"><div><span>EQUIPE</span><h2>Perfis e <em>acessos.</em></h2></div><b>{data.team.length} pessoas</b></div><div className="admin-team-list">{data.team.map((member) => <div key={member.id}><i>{member.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</i><p><b>{member.name}</b><small>{member.username ? `@${member.username}` : ((member as any).email || `${member.name.toLowerCase().replace(/\s+/g, ".")}@agenciasix.com.br`)}</small></p><span>{member.role === 'admin' ? 'ADMIN' : member.role.toUpperCase()}</span></div>)}</div></article>
        <article className="admin-card"><div className="admin-card-head"><div><span>RBAC</span><h2>Cargos e <em>regras.</em></h2></div><b>{data.roles.reduce((total, role) => total + role.permissionCount, 0)} permissões</b></div><div className="admin-role-list">{data.roles.map((role) => <div key={role.code}><p><b>{role.name}</b><small>{role.description}</small></p><span>{role.permissionCount}</span></div>)}</div></article>
      </section>

      {gamificationConfig && !preview && (
        <section className="admin-gamification">
          <h3>Painel Avançado de Gamificação da Agência</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#222', padding: '16px', borderRadius: '10px' }}>
              <b style={{ color: '#c6ff38', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>REGRA DE XP POR AÇÃO</b>
              <div style={{ display: 'grid', gap: '8px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Conclusão de Missão no Prazo</span>
                  <input type="number" defaultValue="100" style={{ width: '70px', padding: '4px', textAlign: 'center' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Aprovação na Primeita Revisão</span>
                  <input type="number" defaultValue="50" style={{ width: '70px', padding: '4px', textAlign: 'center' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Kudos / Apoio ao Colega</span>
                  <input type="number" defaultValue="30" style={{ width: '70px', padding: '4px', textAlign: 'center' }} />
                </div>
              </div>
            </div>

            <div style={{ background: '#222', padding: '16px', borderRadius: '10px' }}>
              <b style={{ color: '#ff7047', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>PENALIDADES & DEDUÇÕES</b>
              <div style={{ display: 'grid', gap: '8px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Missão Atrasada (por dia)</span>
                  <input type="number" defaultValue="-25" style={{ width: '70px', padding: '4px', textAlign: 'center' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Refação Solicitada pelo Cliente</span>
                  <input type="number" defaultValue="-15" style={{ width: '70px', padding: '4px', textAlign: 'center' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: '#222', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
            <b style={{ color: '#8c73ff', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>METAS DA AGÊNCIA (OBJETIVOS SEMANAIS E MENSAL)</b>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11px' }}>
              <div>
                <span>Objetivo Semanal (Missões Concluídas)</span>
                <input type="text" defaultValue="50 Missões / Semana" style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
              </div>
              <div>
                <span>Objetivo Mensal (Taxa de Entrega no Prazo)</span>
                <input type="text" defaultValue="95% no Prazo" style={{ width: '100%', padding: '6px', marginTop: '4px' }} />
              </div>
            </div>
          </div>

          <div className="gamification-config-grid">
            <div className="gamification-config-card">
              <div>
                <b>Multiplicador Global de XP</b>
                <br />
                <small>Aplica um fator de multiplicação a todo XP ganho no sistema.</small>
              </div>
              <input
                type="number"
                value={gamificationConfig.xpMultiplier}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 1
                  setGamificationConfig({ ...gamificationConfig, xpMultiplier: val })
                }}
              />
            </div>
            {gamificationConfig.levelConfig.map((level, index) => (
              <div className="gamification-config-card" key={index}>
                <div>
                  <b>Nível {index + 1}: {level.name}</b>
                  <br />
                  <small>{level.detail}</small>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={level.name}
                    onChange={(e) => {
                      const updatedLevels = [...gamificationConfig.levelConfig]
                      updatedLevels[index] = { ...level, name: e.target.value }
                      setGamificationConfig({ ...gamificationConfig, levelConfig: updatedLevels })
                    }}
                    placeholder="Nome do Nível"
                    style={{ width: '130px', textAlign: 'left' }}
                  />
                  <input
                    type="text"
                    value={level.detail}
                    onChange={(e) => {
                      const updatedLevels = [...gamificationConfig.levelConfig]
                      updatedLevels[index] = { ...level, detail: e.target.value }
                      setGamificationConfig({ ...gamificationConfig, levelConfig: updatedLevels })
                    }}
                    placeholder="Detalhe do Nível"
                    style={{ width: '220px', textAlign: 'left' }}
                  />
                  <input
                    type="number"
                    value={level.target}
                    onChange={(e) => {
                      const updatedLevels = [...gamificationConfig.levelConfig]
                      updatedLevels[index] = { ...level, target: parseInt(e.target.value) || 0 }
                      setGamificationConfig({ ...gamificationConfig, levelConfig: updatedLevels })
                    }}
                    placeholder="XP Alvo"
                    style={{ width: '100px' }}
                  />
                </div>
              </div>
            ))}
          </div>
          {configMessage && <p style={{ fontSize: '11px', color: '#536e10', marginTop: 10 }}>{configMessage}</p>}
          <button className="gamification-save-button" onClick={handleSaveConfig} disabled={savingConfig}>
            {savingConfig ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÃO'}
          </button>
        </section>
      )}
      {!preview && (
        <section className="admin-gamification" style={{ marginTop: '24px' }}>
          <h3>Integrações Externas</h3>
          <div className="gamification-config-grid">
            <div className="gamification-config-card">
              <div>
                <b>Conector Slack (Alertas e Feed)</b>
                <br />
                <small>Envia alertas de kudos e conclusões de missões no Slack.</small>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Webhook URL (ex: https://hooks.slack.com/...)"
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  style={{ width: '320px', textAlign: 'left' }}
                />
                <button className="gamification-save-button" style={{ margin: 0, padding: '8px 12px' }} onClick={() => handleSaveIntegration('slack', JSON.stringify({ webhookUrl: slackWebhook }), true)}>
                  {savingSlack ? 'SALVANDO...' : 'SALVAR & ATIVAR'}
                </button>
              </div>
            </div>

            <div className="gamification-config-card">
              <div>
                <b>Conector Runrun.it</b>
                <br />
                <small>Sincronização de eventos e importação de tarefas.</small>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="API Token do Runrun.it"
                  value={runrunToken}
                  onChange={(e) => setRunrunToken(e.target.value)}
                  style={{ width: '320px', textAlign: 'left' }}
                />
                <button className="gamification-save-button" style={{ margin: 0, padding: '8px 12px' }} onClick={() => handleSaveIntegration('runrunit', JSON.stringify({ token: runrunToken }), true)}>
                  {savingRunrun ? 'SALVANDO...' : 'SALVAR & ATIVAR'}
                </button>
              </div>
            </div>
          </div>
          {integrationMessage && <p style={{ fontSize: '11px', color: '#536e10', marginTop: 10 }}>{integrationMessage}</p>}
        </section>
      )}
    </>}
    {dialog === 'user' && <AdminUserDialog roles={data.roles} onClose={() => setDialog(null)} onCreate={handleCreateUser} />}
    {dialog === 'client' && <AdminClientDialog onClose={() => setDialog(null)} onCreate={handleCreateClient} />}
  </div>
}

function AdminUserDialog({ roles, onClose, onCreate }: { roles: AdminOverview['roles']; onClose: () => void; onCreate: (input: any) => Promise<void> }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [initialPassword, setInitialPassword] = useState('')
  const [role, setRole] = useState('specialist')
  const [department, setDepartment] = useState('Criação & Design')
  const [status, setStatus] = useState('active')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      await onCreate({ name: name.trim(), email: email.trim(), username: username.trim(), role, initialPassword, department, status })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o colaborador.')
    } finally {
      setIsSaving(false)
    }
  }

  return <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Novo colaborador"><form className="mission-create-dialog admin-create-dialog" onSubmit={submit}><button className="close-button" type="button" onClick={onClose} aria-label="Fechar cadastro de colaborador">×</button><span className="mission-create-icon"><Icon name="people" size={21} /></span><p>CADASTRO COMPLETO DE COLABORADOR</p><h2>Quem vai tornar<br /><em>possível?</em></h2><label><span>NOME COMPLETO</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Lucas Mendes" required /></label><div className="mission-create-row"><label><span>E-MAIL PROFISSIONAL</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="nome@agenciasix.com.br" required /></label><label><span>SENHA INICIAL</span><input value={initialPassword} onChange={(event) => setInitialPassword(event.target.value)} type="password" placeholder="Mínimo 4 caracteres" required /></label></div><div className="mission-create-row"><label><span>LOGIN (OPCIONAL)</span><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="nome.sobrenome" /></label><label><span>CARGO & PERMISSÃO</span><select value={role} onChange={(event) => setRole(event.target.value)}>{roles.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label></div><div className="mission-create-row"><label><span>DEPARTAMENTO</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="Atendimento">Atendimento</option><option value="Redação & Conteúdo">Redação & Conteúdo</option><option value="Criação & Design">Criação & Design</option><option value="Mídia & Analytics">Mídia & Analytics</option><option value="Tecnologia">Tecnologia</option><option value="Administração">Administração</option></select></label><label><span>STATUS INICIAL</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Ativo (Permitir Acesso)</option><option value="blocked">Bloqueado</option><option value="inactive">Desativado</option></select></label></div>{error && <p className="admin-dialog-error">{error}</p>}<button className="mission-create-submit" type="submit" disabled={isSaving}>{isSaving ? 'SALVANDO…' : <>CRIAR COLABORADOR <span>→</span></>}</button></form></div>
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
  onViewFeed,
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
  onViewFeed: () => void
}) {
  const [feedItems, setFeedItems] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/feed')
      .then(res => res.json())
      .then((data: any) => {
        if (Array.isArray(data)) {
          setFeedItems(data.slice(0, 3))
        }
      })
      .catch(() => undefined)
  }, [])

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
            {feedItems.map((item) => {
              const initials = item.user_name ? item.user_name.split(/\s+/).map((p: any) => p.charAt(0)).join('').slice(0, 2).toLocaleUpperCase('pt-BR') : 'SX'
              const isKudo = item.type === 'kudo_received'
              const isProject = item.type === 'project_created'
              return (
                <div className="feed-item" key={item.id}>
                  <Avatar initials={initials} tone={isKudo ? 'purple' : isProject ? 'lime' : 'dark'} small />
                  <p><b>{item.user_name || 'Membro'}</b> {item.title}<br /><span>{item.target_name}</span></p>
                  <small>{item.xp_amount ? `+${item.xp_amount} XP` : 'feed'}</small>
                </div>
              )
            })}
            {feedItems.length === 0 && <p style={{ fontSize: '11px', color: '#85857e', padding: '10px' }}>Nenhuma atividade registrada.</p>}
            <button className="feed-more" onClick={onViewFeed}>VER O FEED COMPLETO <span>→</span></button>
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
  accessSession,
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
  accessSession: AccessSession | null
  onReassignMission: (id: string, assigneeId: string) => void
  onUpdateMission: (id: string, input: { title: string; projectId: string; assigneeId: string; deadline: string; priority: 'normal' | 'urgent' }) => void
}) {
  const canManage = canManageMissions(accessSession)
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
        <div className="missions-intro-actions">{canManage && <button className="create-mission-button" onClick={() => setIsCreateOpen(true)}>NOVA MISSÃO <span>+</span></button>}<div className="mission-score"><span>XP CONQUISTADOS</span><b>+{xpEarned.toLocaleString('pt-BR')}</b><small>{completed.length} de {missions.length} missões concluídas</small></div></div>
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
          {visibleMissions.map((mission, index) => <MissionCard key={mission.id} mission={mission} index={index} isComplete={completed.includes(mission.id)} canComplete={canCompleteMission(accessSession, mission)} assignee={team.find((member) => member.id === mission.assigneeId)} onManage={(missionId) => setSelectedMissionId(missionId)} onOpenDetails={(missionId) => { setSelectedMissionId(missionId); setIsDetailsOpen(true) }} onComplete={onComplete} />)}
          {visibleMissions.length === 0 && <p className="empty-state">Nenhuma missão nessa visão. Continue criando possibilidades.</p>}
        </div>
        <div className="mission-side-panel"><aside className="mission-insight"><span>RITMO DA SEMANA</span><b>{Math.round((completed.length / missions.length) * 100)}%</b><p>Você já acumulou <strong>{xpEarned} XP</strong> nesta jornada. O próximo passo começa agora.</p><div><i style={{ width: `${(completed.length / missions.length) * 100}%` }} /></div></aside>{selectedMission && <MissionAssignmentPanel mission={selectedMission} project={projects.find((project) => project.id === selectedMission.projectId)} assignee={team.find((member) => member.id === selectedMission.assigneeId)} team={team} canManage={canManage} isComplete={completed.includes(selectedMission.id)} onDetails={() => setIsDetailsOpen(true)} onEdit={() => setIsEditOpen(true)} onReassign={onReassignMission} />}</div>
      </div>
      {isCreateOpen && <MissionCreateModal projects={projects} team={team} onClose={() => setIsCreateOpen(false)} onCreate={(input) => { onCreateMission(input); setIsCreateOpen(false) }} />}
      {isEditOpen && selectedMission && <MissionEditModal mission={selectedMission} projects={projects} team={team} onClose={() => setIsEditOpen(false)} onUpdate={(input) => { onUpdateMission(selectedMission.id, input); setIsEditOpen(false) }} />}
      {isDetailsOpen && selectedMission && <MissionDetailsModal mission={selectedMission} onClose={() => setIsDetailsOpen(false)} />}
    </section>
  )
}

function MissionCard({ mission, index, isComplete, canComplete = true, assignee, onManage, onOpenDetails, onComplete }: { mission: Mission; index: number; isComplete: boolean; canComplete?: boolean; assignee?: TeamMember; onManage?: (id: string) => void; onOpenDetails?: (id: string) => void; onComplete: (id: string) => void }) {
  return <article className={`mission-card tone-${mission.tone} ${isComplete ? 'completed' : ''} ${onOpenDetails ? 'interactive' : ''}`} role={onOpenDetails ? 'button' : undefined} tabIndex={onOpenDetails ? 0 : undefined} onClick={() => onOpenDetails?.(mission.id)} onKeyDown={(event) => { if (onOpenDetails && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpenDetails(mission.id) } }}>
    <span className="mission-number">{String(index + 1).padStart(2, '0')}</span>
    <div className="mission-info"><p>{mission.client}</p><h3>{mission.title}</h3><span className="deadline">{mission.deadline}</span>{mission.approvalStatus === 'pending' && <span className="mission-approval-status">EM APROVAÇÃO</span>}{assignee && <span className="mission-assignee">Responsável: {assignee.name}</span>}{onManage && <button className="mission-manage-button" onClick={(event) => { event.stopPropagation(); onManage(mission.id) }}>GERENCIAR <span>→</span></button>}</div>
    <div className="mission-reward"><span>RECOMPENSA</span><b>+{mission.xp} XP</b><small>+{mission.ideas} ideias</small></div>
    {canComplete && <button className="complete-button" disabled={isComplete || mission.approvalStatus === 'pending'} onClick={(event) => { event.stopPropagation(); onComplete(mission.id) }}>{isComplete ? 'Feita!' : mission.approvalStatus === 'pending' ? 'Em aprovação' : 'Concluir'} <span>{isComplete ? '✓' : '→'}</span></button>}
  </article>
}

function MissionAssignmentPanel({ mission, project, assignee, team, canManage, isComplete, onDetails, onEdit, onReassign }: { mission: Mission; project?: Project; assignee?: TeamMember; team: TeamMember[]; canManage: boolean; isComplete: boolean; onDetails: () => void; onEdit: () => void; onReassign: (id: string, assigneeId: string) => void }) {
  const [assigneeId, setAssigneeId] = useState(mission.assigneeId ?? team[0]?.id ?? '')

  useEffect(() => {
    setAssigneeId(mission.assigneeId ?? team[0]?.id ?? '')
  }, [mission.assigneeId, mission.id, team])

  return <aside className="mission-assignment-panel"><div className="mission-assignment-head"><span>GESTÃO DA MISSÃO</span><b>{isComplete ? 'FEITA' : mission.approvalStatus === 'pending' ? 'EM APROVAÇÃO' : 'EM ABERTO'}</b></div><h2>{mission.title}</h2><p>{project?.name ?? mission.client} · {mission.deadline}</p><div className="mission-assignment-owner"><Avatar initials={assignee?.initials ?? '?'} tone={assignee?.tone ?? 'dark'} small /><span><small>RESPONSÁVEL ATUAL</small><b>{assignee?.name ?? 'A definir'}</b></span></div>{canManage && <><form onSubmit={(event) => { event.preventDefault(); if (assigneeId) onReassign(mission.id, assigneeId) }}><label><span>REDISTRIBUIR PARA</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>{team.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label><button type="submit" disabled={!assigneeId || assigneeId === mission.assigneeId}>SALVAR RESPONSÁVEL <span>→</span></button></form><button className="mission-edit-button" type="button" onClick={onEdit}>EDITAR MISSÃO <span>↗</span></button></>}<button className="mission-details-button" type="button" onClick={onDetails}>DETALHES COMPLETOS <span>→</span></button></aside>
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
      setDetails({ mission: { id: mission.id, title: mission.title, description: 'Conecte uma sessão SIX para carregar os dados persistidos desta missão.', client: mission.client, projectId: mission.projectId ?? '', project: mission.client, assigneeId: mission.assigneeId ?? null, assignee: null, status: mission.status ?? 'open', priority: mission.urgent ? 'urgent' : 'normal', dueAt: deadlineToMissionDate(mission.deadline), xpReward: mission.xp, ideasReward: mission.ideas, rewardLabel: null, approvalStatus: mission.approvalStatus ?? 'not_requested', createdAt: '', completedAt: null, approvedAt: null }, checklist: [], comments: [], attachments: [], history: [], permissions: { canInteract: false, canManage: false, canApprove: false } })
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

  return (
    <div className="mission-create-overlay mission-details-overlay" role="dialog" aria-modal="true" aria-label="Detalhes da missão">
      <section className="mission-details-dialog">
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar detalhes da missão">×</button>
        {!details ? (
          <p className="mission-details-loading">Carregando missão…</p>
        ) : (
          <>
            <header>
              <p>MISSÃO</p>
              <h2>{details.mission.title}</h2>
              <span>{details.mission.client} · {details.mission.project}</span>
            </header>

            <div className="mission-details-meta">
              <b>{details.mission.priority.toLocaleUpperCase('pt-BR')}</b>
              <span>{details.mission.assignee ?? 'Responsável a definir'}</span>
              <span>{details.mission.dueAt ? new Date(details.mission.dueAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Prazo a definir'}</span>
              <span>+{details.mission.xpReward} XP</span>
            </div>

            <p className="mission-details-description">{details.mission.description || 'Sem descrição adicionada.'}</p>

            <div className="mission-details-grid">
              {/* CHECKLIST */}
              <section>
                <h3>CHECKLIST</h3>
                <div className="mission-checklist">
                  {details.checklist.map((item) => (
                    <label key={item.id} className="mission-checklist-item">
                      <input
                        type="checkbox"
                        checked={Boolean(item.isCompleted)}
                        onChange={(event) => { void toggleChecklist(item.id, event.target.checked) }}
                      />
                      <span className={item.isCompleted ? 'done' : ''}>{item.label}</span>
                    </label>
                  ))}
                </div>
                <form className="mission-checklist-form" onSubmit={addChecklist}>
                  <input
                    value={checklistLabel}
                    onChange={(event) => setChecklistLabel(event.target.value)}
                    placeholder="Adicionar item ao checklist…"
                    maxLength={240}
                  />
                  <button type="submit">ADICIONAR</button>
                </form>
              </section>

              {/* ANEXOS */}
              <section>
                <h3>ANEXOS DA MISSÃO</h3>

                {details.attachments.length > 0 && (
                  <div className="mission-attachments-list">
                    {details.attachments.map((attachment) => (
                      <a
                        className="mission-attachment"
                        key={attachment.id}
                        href={`/api/projects/${details.mission.projectId}/library/files/${attachment.libraryFileId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span>📎 {attachment.fileName}</span>
                        <b>V{attachment.fileVersion} ↓</b>
                      </a>
                    ))}
                  </div>
                )}

                <div
                  className={`mission-dropzone ${isDraggingFile ? 'dragging' : ''}`}
                  onDragOver={(event) => { event.preventDefault(); setIsDraggingFile(true) }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={(event) => { event.preventDefault(); void uploadAndAttachFile(event.dataTransfer.files[0]) }}
                >
                  <label className="mission-dropzone-trigger">
                    <input
                      type="file"
                      onChange={(event) => { void uploadAndAttachFile(event.target.files?.[0]); event.currentTarget.value = '' }}
                    />
                    <span className="mission-dropzone-icon">↑</span>
                    <span>{isUploadingFile ? 'ENVIANDO…' : 'CLIQUE OU ARRASTE UM ARQUIVO'}</span>
                  </label>
                  <p>Solte o arquivo aqui para anexar à missão</p>
                </div>
              </section>
            </div>

            <section className="mission-comments">
              <h3>COMENTÁRIOS</h3>
              <form onSubmit={addComment}>
                <textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Registre uma atualização para o time"
                  maxLength={3000}
                />
                <button>COMENTAR</button>
              </form>
              {details.comments.map((comment) => (
                <article key={comment.id}>
                  <b>{comment.author}</b>
                  <p>{comment.body}</p>
                </article>
              ))}
            </section>

            <section className="mission-history">
              <h3>HISTÓRICO</h3>
              {details.history.map((entry) => (
                <p key={entry.id}><b>{entry.actor ?? 'Sistema'}</b> · {entry.detail ?? entry.action}</p>
              ))}
            </section>

            {message && <p className="mission-detail-message">{message}</p>}

            {details.mission.status !== 'completed' && (
              <button className="mission-detail-complete" type="button" onClick={() => { void complete() }}>
                {details.permissions.canApprove ? 'APROVAR E CONCLUIR' : 'ENVIAR PARA APROVAÇÃO'} <span>→</span>
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
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

  return <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Editar missão"><form className="mission-create-dialog mission-edit-dialog" onSubmit={(event) => { event.preventDefault(); if (title.trim() && projectId && assigneeId && deadline.trim()) onUpdate({ title: title.trim(), projectId, assigneeId, deadline, priority }) }}><button className="close-button" type="button" onClick={onClose} aria-label="Fechar edição de missão">×</button><span className="mission-create-icon"><Icon name="target" size={21} /></span><p>EDITAR MISSÃO</p><h2>Ajuste o próximo<br /><em>movimento.</em></h2><label><span>TÍTULO</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required /></label><div className="mission-create-row"><label><span>PROJETO</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label><span>RESPONSÁVEL</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} required>{team.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.role}</option>)}</select></label></div><div className="mission-create-row"><label><span>PRAZO</span><DateTimePicker value={deadline} onChange={setDeadline} /></label><label><span>PRIORIDADE</span><select value={priority} onChange={(event) => setPriority(event.target.value as 'normal' | 'urgent')}><option value="normal">Normal</option><option value="urgent">Urgente</option></select></label></div><button className="mission-create-submit" type="submit">SALVAR ALTERAÇÕES <span>→</span></button></form></div>
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

  return <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Criar missão"><form className="mission-create-dialog mission-create-dialog-expanded" onSubmit={(event) => { event.preventDefault(); if (title.trim() && projectId && assigneeId && deadline.trim()) onCreate({ title: title.trim(), projectId, assigneeId, deadline, priority, description: description.trim(), files }) }}><button className="close-button" type="button" onClick={onClose} aria-label="Fechar criação de missão">×</button><span className="mission-create-icon"><Icon name="target" size={21} /></span><p>NOVA MISSÃO</p><h2>Qual ideia vamos<br /><em>tornar possível?</em></h2><label><span>TÍTULO</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Desdobramentos de campanha" required /></label><label><span>DESCRIÇÃO, LINKS E CONTEXTO</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Escreva o briefing da missão e cole links de referências, imagens ou vídeos." maxLength={4000} /></label><label className="mission-create-files"><span>IMAGENS E VÍDEOS (OPCIONAL)</span><input type="file" accept="image/*,video/*" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><small>{files.length ? `${files.length} arquivo${files.length === 1 ? '' : 's'} será${files.length === 1 ? '' : 'ão'} enviado${files.length === 1 ? '' : 's'} à Biblioteca do Projeto.` : 'Envie imagens ou vídeos junto da missão.'}</small></label><div className="mission-create-row"><label><span>PROJETO</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label><span>RESPONSÁVEL</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} required>{team.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.role}</option>)}</select></label></div><div className="mission-create-row"><label><span>PRAZO</span><DateTimePicker value={deadline} onChange={setDeadline} /></label><label><span>PRIORIDADE</span><select value={priority} onChange={(event) => setPriority(event.target.value as 'normal' | 'urgent')}><option value="normal">Normal</option><option value="urgent">Urgente</option></select></label></div><button className="mission-create-submit" type="submit">CRIAR MISSÃO <span>→</span></button></form></div>
}

type AgendaDisplayEvent = {
  id: string
  time: string
  title: string
  subtitle: string
  day: string
  category: string
  tone: Mission['tone']
  duration: string
  attendees: string[]
  description: string
}

const agendaCategoryLabels: Record<CalendarEventType, string> = {
  meeting: 'Reunião',
  deadline: 'Prazo',
  appointment: 'Compromisso',
  vacation: 'Férias',
}

function agendaDateLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const eventDay = new Date(date)
  eventDay.setHours(0, 0, 0, 0)
  const difference = Math.round((eventDay.getTime() - today.getTime()) / 86_400_000)
  if (difference === 0) return 'Hoje'
  if (difference === 1) return 'Amanhã'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date).replace('.', '')
}

function agendaDayOrder(day: string) {
  if (day === 'Hoje') return 0
  if (day === 'Amanhã') return 1
  return 2
}

function agendaTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

function agendaDuration(startsAt: string, endsAt: string | null) {
  if (!endsAt) return 'Sem duração'
  const minutes = Math.max(0, Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`
}

function agendaTone(type: CalendarEventType): Mission['tone'] {
  if (type === 'deadline') return 'orange'
  if (type === 'vacation') return 'lime'
  return type === 'meeting' ? 'purple' : 'lime'
}

function calendarEventToDisplay(event: CalendarEventRecord): AgendaDisplayEvent {
  const context = [event.clientName ?? event.projectName, event.location].filter(Boolean).join(' · ')
  return {
    id: event.id,
    time: agendaTime(event.startsAt),
    title: event.title,
    subtitle: context || (event.visibility === 'team' ? 'Agenda da equipe' : 'Agenda individual'),
    day: agendaDateLabel(event.startsAt),
    category: agendaCategoryLabels[event.eventType],
    tone: agendaTone(event.eventType),
    duration: agendaDuration(event.startsAt, event.endsAt),
    attendees: event.ownerName ? [getInitials(event.ownerName)] : [],
    description: event.description || 'Sem contexto adicional registrado.',
  }
}

function agendaDateTimeInputValue(offsetMinutes = 60) {
  const date = new Date(Date.now() + offsetMinutes * 60_000)
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function agendaDateTimeInputFromIso(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function AgendaPage({ events, missions, projects, team, completed, accessSession }: { events: AgendaEvent[]; missions: Mission[]; projects: Project[]; team: TeamMember[]; completed: string[]; accessSession: AccessSession | null }) {
  const [scope, setScope] = useState<AgendaScope>('mine')
  const [remoteEvents, setRemoteEvents] = useState<CalendarEventRecord[]>([])
  const [permissions, setPermissions] = useState<AgendaPermissions>({ canViewTeam: false, canCreateTeam: false })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEventRecord | null>(null)

  useEffect(() => {
    let active = true
    if (!accessSession) {
      setRemoteEvents([])
      setPermissions({ canViewTeam: false, canCreateTeam: false })
      setError('')
      return () => { active = false }
    }

    setIsLoading(true)
    setError('')
    void getAgenda(scope).then((data) => {
      if (!active) return
      setRemoteEvents(data.events)
      setPermissions(data.permissions)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a agenda.')
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => { active = false }
  }, [accessSession, scope])

  const missionEvents: AgendaDisplayEvent[] = missions.filter((mission) => {
    if (completed.includes(mission.id)) return false
    return !accessSession || permissions.canViewTeam || mission.assigneeId === accessSession.id
  }).map((mission) => {
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
      category: 'Entrega',
      tone: mission.tone,
      duration: 'Entrega',
      attendees: assignee ? [assignee.initials] : [],
      description: `Entrega da missão “${mission.title}” para ${project?.name ?? mission.client}.${assignee ? ` Responsável: ${assignee.name}.` : ''}`,
    }
  })
  const calendarEvents: AgendaDisplayEvent[] = accessSession ? remoteEvents.map(calendarEventToDisplay) : events.map((event) => ({ ...event, category: event.category === 'Criação' ? 'Compromisso' : event.category }))
  const agendaEvents = [...calendarEvents, ...missionEvents].sort((first, second) => agendaDayOrder(first.day) - agendaDayOrder(second.day) || first.time.localeCompare(second.time))
  const [agendaFilter, setAgendaFilter] = useState<'all' | 'Reunião' | 'Prazo' | 'Compromisso' | 'Férias' | 'Entrega'>('all')
  const [selectedEventId, setSelectedEventId] = useState(agendaEvents[0]?.id ?? '')
  const visibleEvents = agendaEvents.filter((event) => agendaFilter === 'all' || event.category === agendaFilter)
  const selectedEvent = visibleEvents.find((event) => event.id === selectedEventId) ?? visibleEvents[0] ?? agendaEvents[0]
  const selectedRemoteEvent = selectedEvent ? remoteEvents.find((event) => event.id === selectedEvent.id) ?? null : null
  const canManageSelectedEvent = Boolean(accessSession && selectedRemoteEvent && (selectedRemoteEvent.ownerUserId === accessSession.id || (selectedRemoteEvent.visibility === 'team' && permissions.canViewTeam)))

  function refreshAgenda() {
    if (!accessSession) return
    setIsLoading(true)
    void getAgenda(scope).then((data) => {
      setRemoteEvents(data.events)
      setPermissions(data.permissions)
      setError('')
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a agenda.')).finally(() => setIsLoading(false))
  }

  async function removeSelectedEvent() {
    if (!selectedRemoteEvent || !window.confirm(`Excluir “${selectedRemoteEvent.title}” da agenda?`)) return
    try {
      await deleteCalendarEvent(selectedRemoteEvent.id)
      setSelectedEventId('')
      refreshAgenda()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível excluir o evento.')
    }
  }

  return (
    <section className="agenda-page">
      <div className="agenda-intro">
        <div>
          <p className="eyebrow">{scope === 'team' ? 'AGENDA DA EQUIPE' : 'MINHA AGENDA'} <span>✦</span></p>
          <h1>Ritmo de<br /><em>possibilidades.</em></h1>
        </div>
        <div className="agenda-date-summary">
          <span>HOJE</span>
          <b>{String(new Date().getDate()).padStart(2, '0')}</b>
          <small>{missionEvents.length} {missionEvents.length === 1 ? 'missão pendente' : 'missões pendentes'}</small>
        </div>
      </div>

      <div className="agenda-scope-bar">
        <div className="segmented-control" aria-label="Escopo da agenda">
          <button className={scope === 'mine' ? 'selected' : ''} onClick={() => setScope('mine')}>Minha agenda</button>
          {permissions.canViewTeam && <button className={scope === 'team' ? 'selected' : ''} onClick={() => setScope('team')}>Agenda da equipe</button>}
        </div>
        {accessSession ? (
          <button className="agenda-create-button" onClick={() => setIsCreateOpen(true)}>NOVO EVENTO <span>+</span></button>
        ) : (
          <span className="agenda-local-note">Entre para registrar eventos.</span>
        )}
      </div>

      {error && agendaEvents.length === 0 && <p className="agenda-status error">{error}</p>}

      {/* APPLE CALENDAR INTERACTIVE MODULE */}
      <AppleCalendar
        agenda={events}
        missions={missions}
        team={team}
        onAddEvent={() => setIsCreateOpen(true)}
      />

      <div className="agenda-workspace" style={{ marginTop: '24px' }}>
        <div className="agenda-timeline">
          {visibleEvents.map((event) => {
            const isSelected = event.id === selectedEvent?.id
            return <button className={`agenda-timeline-item tone-${event.tone} ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedEventId(event.id)} aria-pressed={isSelected} key={event.id}>
              <time>{event.time}</time><span className="agenda-timeline-dot" /><span className="agenda-timeline-copy"><small>{event.day} · {event.category}</small><b>{event.title}</b><em>{event.subtitle}</em></span><span className="agenda-timeline-duration">{event.duration}</span>
            </button>
          })}
          {visibleEvents.length === 0 && <p className="empty-state">Nenhum evento nesse filtro.</p>}
        </div>
        {selectedEvent ? <aside className={`agenda-detail tone-${selectedEvent.tone}`}>
          <div className="agenda-detail-head"><span>{selectedEvent.day} · {selectedEvent.time}</span><b>{selectedEvent.category}</b></div><h2>{selectedEvent.title}</h2><p>{selectedEvent.subtitle}</p><div className="agenda-detail-section"><span>DURAÇÃO</span><b>{selectedEvent.duration}</b></div><div className="agenda-detail-section"><span>CONTEXTO</span><p>{selectedEvent.description}</p></div><div className="agenda-detail-footer"><div className="avatars">{selectedEvent.attendees.map((member, index) => <Avatar initials={member} tone={index === 1 ? 'lime' : 'dark'} small key={member} />)}<span>+{Math.max(0, selectedEvent.attendees.length - 2)}</span></div><small>{selectedEvent.attendees.length > 0 ? `${selectedEvent.attendees.length} pessoa${selectedEvent.attendees.length === 1 ? '' : 's'} envolvida${selectedEvent.attendees.length === 1 ? '' : 's'}` : 'Evento individual'}</small></div>{canManageSelectedEvent && <div className="agenda-detail-actions"><button onClick={() => setEditingEvent(selectedRemoteEvent)}>EDITAR</button><button onClick={() => void removeSelectedEvent()}>EXCLUIR</button></div>}
        </aside> : <aside className="agenda-detail"><div className="agenda-detail-head"><span>AGENDA</span></div><h2>Nenhum evento<br />nesse filtro.</h2><p>Altere o filtro ou registre um novo compromisso.</p></aside>}
      </div>

      {isCreateOpen && <CalendarEventModal projects={projects} canCreateTeam={permissions.canCreateTeam} defaultVisibility={scope === 'team' ? 'team' : 'personal'} onClose={() => setIsCreateOpen(false)} onCreated={() => { setIsCreateOpen(false); refreshAgenda() }} />}
      {editingEvent && <CalendarEventModal event={editingEvent} projects={projects} canCreateTeam={permissions.canCreateTeam} defaultVisibility={editingEvent.visibility} onClose={() => setEditingEvent(null)} onCreated={() => { setEditingEvent(null); refreshAgenda() }} />}
    </section>
  )
}

function CalendarEventModal({ event: calendarEvent, projects, canCreateTeam, defaultVisibility, onClose, onCreated }: { event?: CalendarEventRecord; projects: Project[]; canCreateTeam: boolean; defaultVisibility: CalendarVisibility; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState(calendarEvent?.title ?? '')
  const [eventType, setEventType] = useState<CalendarEventType>(calendarEvent?.eventType ?? 'meeting')
  const [startsAt, setStartsAt] = useState(() => calendarEvent ? agendaDateTimeInputFromIso(calendarEvent.startsAt) : agendaDateTimeInputValue())
  const [endsAt, setEndsAt] = useState(() => calendarEvent ? agendaDateTimeInputFromIso(calendarEvent.endsAt) : agendaDateTimeInputValue(120))
  const [visibility, setVisibility] = useState<CalendarVisibility>(calendarEvent?.visibility ?? defaultVisibility)
  const [projectId, setProjectId] = useState(calendarEvent?.projectId ?? '')
  const [location, setLocation] = useState(calendarEvent?.location ?? '')
  const [description, setDescription] = useState(calendarEvent?.description ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      const input = { title, startsAt, endsAt, eventType, visibility, projectId: projectId || undefined, location, description }
      if (calendarEvent) await updateCalendarEvent(calendarEvent.id, input)
      else await createCalendarEvent(input)
      onCreated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar o evento.')
    } finally {
      setIsSaving(false)
    }
  }

  return <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label={calendarEvent ? 'Editar evento da agenda' : 'Novo evento da agenda'}><form className="mission-create-dialog agenda-create-dialog" onSubmit={submit}><button className="close-button" type="button" onClick={onClose} aria-label="Fechar criação de evento">×</button><span className="mission-create-icon"><Icon name="calendar" size={21} /></span><p>{calendarEvent ? 'EDITAR EVENTO' : 'NOVO EVENTO'}</p><h2>{calendarEvent ? <>Ajuste o próximo<br /><em>movimento.</em></> : <>Organize o próximo<br /><em>movimento.</em></>}</h2><label><span>TÍTULO</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Reunião de alinhamento" required /></label><div className="mission-create-row"><label><span>TIPO</span><select value={eventType} onChange={(event) => setEventType(event.target.value as CalendarEventType)}><option value="meeting">Reunião</option><option value="deadline">Prazo</option><option value="appointment">Compromisso</option><option value="vacation">Férias</option></select></label><label><span>VISIBILIDADE</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as CalendarVisibility)}><option value="personal">Somente eu</option>{canCreateTeam && <option value="team">Equipe autorizada</option>}</select></label></div><div className="mission-create-row"><label><span>INÍCIO</span><DateTimePicker value={startsAt} onChange={setStartsAt} /></label><label><span>FIM</span><DateTimePicker value={endsAt} onChange={setEndsAt} /></label></div><div className="mission-create-row"><label><span>PROJETO (OPCIONAL)</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Sem projeto vinculado</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label><span>LOCAL (OPCIONAL)</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ex.: Sala Norte" /></label></div><label><span>CONTEXTO</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que precisa acontecer neste compromisso?" maxLength={2000} /></label>{error && <p className="agenda-status error">{error}</p>}<button className="mission-create-submit" type="submit" disabled={isSaving}>{isSaving ? 'SALVANDO…' : <>{calendarEvent ? 'SALVAR ALTERAÇÕES' : 'CRIAR EVENTO'} <span>→</span></>}</button></form></div>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; type: string; project: string; client: string; snippet: string }[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const visibleClients = selectedClientId === 'all' ? clients : clients.filter((client) => client.id === selectedClientId)
  const visibleProjects = selectedClientId === 'all' ? projects : projects.filter((project) => project.client === clients.find((client) => client.id === selectedClientId)?.name)
  const selectedClient = clients.find((client) => client.id === selectedClientId)

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setIsSearching(true)
    try {
      const response = await fetch(`/api/ai/search?q=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) throw new Error()
      const data = await response.json() as { results: typeof searchResults }
      setSearchResults(data.results)
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  return <section className="library-page client-directory-page"><div className="library-intro"><div><p className="eyebrow">DIRETÓRIO DE CLIENTES <span>✦</span></p><h1>Arquivos que<br /><em>contam histórias.</em></h1></div><div className="library-summary"><span>CLIENTES ATIVOS</span><b>{clients.length}</b><small>Selecione um cliente para acessar seus projetos e materiais.</small></div></div><form className="client-directory-selector" onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', marginBottom: '20px', background: 'none', border: 'none', padding: 0 }}><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Busca Semântica SIX AI ✦ Ex.: 'Design Coca-Cola', 'Contrato Q2'..." style={{ width: '100%', padding: '12px 14px', background: '#252522', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: '#fff', outline: 'none', fontSize: '12px' }} /><button type="submit" style={{ padding: '12px 20px', background: '#8b73ff', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>{isSearching ? 'BUSCANDO...' : 'PESQUISAR ✦'}</button></form>{searchResults !== null && <div style={{ background: '#252522', padding: '20px', borderRadius: '12px', marginBottom: '24px', color: '#fff' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}><span style={{ fontSize: '8px', color: '#8b73ff', letterSpacing: '1px', fontWeight: 'bold', textTransform: 'uppercase' }}>RESULTADOS DA BUSCA CONCEITUAL (SIX AI)</span><button onClick={() => { setSearchQuery(''); setSearchResults(null) }} style={{ background: 'none', border: 'none', color: '#85857e', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}>LIMPAR BUSCA</button></div><div style={{ display: 'grid', gap: '10px' }}>{searchResults.map(item => <div key={item.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '14px', borderRadius: '8px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}><b style={{ fontSize: '12px', color: '#fff' }}>{item.title}</b><span style={{ fontSize: '8px', background: 'rgba(139,115,255,0.15)', color: '#8b73ff', padding: '3px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>{item.type}</span></div><p style={{ margin: '0 0 8px', fontSize: '10px', color: '#85857e' }}>Cliente: {item.client} · Campanha: {item.project}</p><p style={{ margin: 0, fontSize: '11px', color: '#dfdfd5', lineHeight: 1.4 }}>{item.snippet}</p></div>)}{searchResults.length === 0 && <p style={{ fontSize: '11px', color: '#85857e', textAlign: 'center', padding: '20px' }}>Nenhum material encontrado para esta busca conceitual.</p>}</div></div>}<div className="client-directory-selector"><label><span>CLIENTE</span><select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}><option value="all">Todos os clientes</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name} · {client.shortCode ?? 'SEM SIGLA'}</option>)}</select></label><p>Os arquivos permanentes do cliente ficam nesta biblioteca; campanhas ficam nos projetos.</p></div>{selectedClient && <ClientLibraryManager client={selectedClient} />}<section className="client-library-index"><div className="client-library-index-head"><div><span>{selectedClientId === 'all' ? 'TODOS OS CLIENTES' : 'PROJETOS DO CLIENTE'}</span><p>Abra uma frente para acessar sua biblioteca específica de campanha.</p></div><b>{visibleProjects.length} projetos</b></div><div className="client-library-grid">{visibleClients.map((client) => { const clientProjects = projects.filter((project) => project.client === client.name); return <article key={client.id}><div className={`client-library-mark ${client.imageUrl ? 'has-image' : ''}`}>{client.imageUrl ? <img src={client.imageUrl} alt="" /> : client.shortCode ?? client.name.slice(0, 3).toLocaleUpperCase('pt-BR')}</div><div><span>CLIENTE</span><h2>{client.name}</h2><p>{clientProjects.length} projeto{clientProjects.length === 1 ? '' : 's'} vinculado{clientProjects.length === 1 ? '' : 's'}</p></div><div className="client-library-projects">{clientProjects.length > 0 ? clientProjects.map((project) => <button onClick={() => onOpenProject(project.id)} key={project.id}><b>{project.name}</b><small>Biblioteca do projeto · {project.status}</small><i>↗</i></button>) : <p>Este cliente ainda não possui projetos com arquivos.</p>}</div></article> })}</div>{visibleClients.length === 0 && <p className="empty-state">Cliente não encontrado.</p>}</section></section>
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

function ProjectsPage({ projects, clients, initialSelectedProjectId, missions, completed, team, canManageMissions, onCreateProject, onCreateMission, onUpdateProjectLifecycle }: { projects: Project[]; clients: ClientIdentity[]; initialSelectedProjectId: string | null; missions: Mission[]; completed: string[]; team: TeamMember[]; canManageMissions: boolean; onCreateProject: (input: { name: string; client: string; deadline: string; tone: Project['tone'] }) => Project; onCreateMission: (input: { title: string; projectId: string; assigneeId: string; deadline: string; priority: 'normal' | 'urgent'; description?: string; files?: File[] }) => void; onUpdateProjectLifecycle: (id: string, input: { status: string; deadline: string; nextStep: string }) => void }) {
  const [selectedProjectId, setSelectedProjectId] = useState(initialSelectedProjectId ?? projects[0]?.id ?? '')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isBriefingOpen, setIsBriefingOpen] = useState(false)
  const [isDashboardOpen, setIsDashboardOpen] = useState(false)
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

  async function handleBriefingLaunch(projectInput: { name: string; client: string; deadline: string; tone: Project['tone'] }, suggestedMissions: { title: string; xp: number; description: string }[]) {
    const createdProject = onCreateProject(projectInput)
    if (!createdProject) return

    for (const m of suggestedMissions) {
      onCreateMission({
        title: m.title,
        projectId: createdProject.id,
        assigneeId: '',
        deadline: 'Amanhã · 18:00',
        priority: 'normal',
        description: `${m.description}\n\nRecompensa sugerida: ${m.xp} XP`
      })
    }
    setSelectedProjectId(createdProject.id)
  }

  return (
    <section className="projects-page">
      <div className="projects-intro">
        <div><p className="eyebrow">CENTRAL DE PROJETOS <span>✦</span></p><h1>Ideias em<br /><em>órbita.</em></h1></div>
        <div className="projects-intro-actions">
          {canManageMissions && <button className="create-mission-button" style={{ background: '#8b73ff', marginRight: '8px' }} onClick={() => setIsBriefingOpen(true)}>BRIEFING INTELIGENTE <span>✦</span></button>}
          <button className="create-mission-button" onClick={() => setIsCreateOpen(true)}>NOVA FRENTE <span>+</span></button>
          <p>Cada frente reúne as missões atribuídas ao time, com progresso calculado pelas entregas concluídas.</p>
        </div>
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
          <div className="project-detail-section"><div className="project-missions-heading"><span>MISSÕES ATRIBUÍDAS</span>{canManageMissions && <button onClick={() => setIsMissionCreateOpen(true)}>NOVA MISSÃO <b>+</b></button>}</div><div className="project-mission-list">{projectMissions.length > 0 ? projectMissions.map((mission) => { const assignee = team.find((member) => member.id === mission.assigneeId); const isComplete = completed.includes(mission.id); return <article className={isComplete ? 'completed' : ''} key={mission.id}><div><b>{mission.title}</b><small>{assignee ? assignee.name : 'Responsável a definir'}</small></div><span>{isComplete ? 'FEITA' : 'EM ABERTO'}</span></article> }) : <p className="project-mission-empty">Esta frente ainda não tem missões.</p>}</div></div>
          <button className="project-library-button" style={{ background: '#171717', color: '#c6ff38', marginBottom: '8px' }} onClick={() => setIsDashboardOpen(true)}>DASHBOARD DO PROJETO 📊</button>
          <button className="project-library-button" onClick={() => setIsLibraryOpen(true)}>BIBLIOTECA DO PROJETO <span>↗</span></button>
          <button className="project-lifecycle-button" onClick={() => setIsLifecycleOpen(true)}>GERENCIAR CICLO DA FRENTE <span>↗</span></button>
          <div className="project-detail-footer"><div className="avatars">{projectCollaborators.slice(0, 3).map((member, index) => <Avatar initials={member.initials} tone={index === 1 ? 'lime' : member.tone} small key={member.id} />)}{projectCollaborators.length > 3 && <span>+{projectCollaborators.length - 3}</span>}</div><small>{projectCollaborators.length === 1 ? '1 pessoa na frente' : `${projectCollaborators.length} pessoas na frente`}</small></div>
        </aside>
      </div>
      {isCreateOpen && <ProjectCreateModal clients={clients} onClose={() => setIsCreateOpen(false)} onCreate={(input) => { onCreateProject(input); setIsCreateOpen(false) }} />}
      {isBriefingOpen && <ProjectBriefingModal clients={clients} onClose={() => setIsBriefingOpen(false)} onLaunch={handleBriefingLaunch} />}
      {isDashboardOpen && <ProjectDashboardModal project={selectedProject} missions={missions} completed={completed} team={team} onClose={() => setIsDashboardOpen(false)} />}
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

function ProjectDashboardModal({ project, missions, completed, team, onClose }: { project: Project; missions: Mission[]; completed: string[]; team: TeamMember[]; onClose: () => void }) {
  const projectMissions = missions.filter((mission) => mission.projectId === project.id)
  const completedMissions = projectMissions.filter((mission) => completed.includes(mission.id))
  const pendingMissions = projectMissions.filter((mission) => !completed.includes(mission.id))
  
  const hoursPlanned = 40 + (project.name.length % 5) * 20
  const hoursRealized = Math.min(hoursPlanned, Math.round(completedMissions.length * (hoursPlanned / Math.max(1, projectMissions.length))))

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const milestones = [
    { title: '1. Alinhamento & Briefing', desc: 'Definição estratégica inicial realizada.', reached: true },
    { title: '2. Desenvolvimento de KV', desc: 'Produção criativa principal da campanha.', reached: completedMissions.length > 0 },
    { title: '3. Redação e Fechamento', desc: 'Ajustes de copy e layouts finais.', reached: completedMissions.length > 1 },
    { title: '4. Veiculação & Análise', desc: 'Publicação e monitoramento de KPIs.', reached: pendingMissions.length === 0 && projectMissions.length > 0 }
  ]

  return (
    <div className="mission-create-overlay project-library-overlay" role="dialog" aria-modal="true" aria-label={`Dashboard do projeto ${project.name}`}>
      <style>{`
        .dashboard-grid-layout {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 20px;
          margin-top: 24px;
        }
        .metrics-grid-layout {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 24px;
        }
        @media (max-width: 780px) {
          .dashboard-grid-layout {
            grid-template-columns: 1fr;
          }
          .metrics-grid-layout {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
      <section className="project-library-dialog" style={{ width: 'min(920px, 100%)' }}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar dashboard do projeto">×</button>
        <div className="project-library-head">
          <div>
            <span>DASHBOARD DO PROJETO 📊</span>
            <h2>{project.name}</h2>
            <p>{project.client} · {project.code}</p>
          </div>
          <ClientMark project={project} className="project-library-client-mark" />
        </div>

        <div className="metrics-grid-layout">
          <article className="profile-stat-card highlight" style={{ background: '#171717', borderColor: '#171717', color: '#fff', textAlign: 'center', padding: '18px', borderRadius: '12px' }}>
            <span style={{ color: '#c6ff38', fontSize: '8px', fontWeight: '900', letterSpacing: '1.1px' }}>PROGRESSO</span>
            <b style={{ display: 'block', marginTop: '6px', fontSize: '26px', color: '#fff', letterSpacing: '-1.4px' }}>{project.progress}%</b>
            <small style={{ display: 'block', marginTop: '2px', color: '#a5a59e', fontSize: '10px' }}>Missões entregues</small>
          </article>
          <article className="profile-stat-card" style={{ background: '#fffefa', border: '1px solid #e1e1da', textAlign: 'center', padding: '18px', borderRadius: '12px' }}>
            <span style={{ color: '#85857e', fontSize: '8px', fontWeight: '900', letterSpacing: '1.1px' }}>STATUS DO CICLO</span>
            <b style={{ display: 'block', marginTop: '6px', fontSize: '16px', color: project.status === 'CONCLUÍDO' ? '#8b73ff' : '#171717', letterSpacing: '-0.5px' }}>{project.status}</b>
            <small style={{ display: 'block', marginTop: '2px', color: '#a5a59e', fontSize: '10px' }}>Saúde da frente</small>
          </article>
          <article className="profile-stat-card" style={{ background: '#fffefa', border: '1px solid #e1e1da', padding: '18px', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#85857e', fontSize: '8px', fontWeight: '900', letterSpacing: '1.1px' }}>HORAS</span>
              <b style={{ fontSize: '16px', color: '#171717', letterSpacing: '-0.5px' }}>{hoursRealized}h / {hoursPlanned}h</b>
            </div>
            <div style={{ height: '6px', background: '#e2e2db', borderRadius: '3px', overflow: 'hidden', margin: '8px 0' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (hoursRealized / hoursPlanned) * 100)}%`, background: '#8b73ff', borderRadius: 'inherit' }} />
            </div>
            <small style={{ color: '#a5a59e', fontSize: '9px' }}>{hoursPlanned - hoursRealized}h restantes estimadas</small>
          </article>
          <article className="profile-stat-card highlight" style={{ background: '#8b73ff', borderColor: '#8b73ff', color: '#fff', textAlign: 'center', padding: '18px', borderRadius: '12px' }}>
            <span style={{ color: '#fff', fontSize: '8px', fontWeight: '900', letterSpacing: '1.1px' }}>INTEGRAÇÃO SIX AI</span>
            <b style={{ display: 'block', marginTop: '6px', fontSize: '20px', color: '#fff', letterSpacing: '-1px' }}>ATIVA</b>
            <small style={{ display: 'block', marginTop: '2px', color: 'rgba(255,255,255,0.8)', fontSize: '10px' }}>Briefing e IA conectados</small>
          </article>
        </div>

        <div className="dashboard-grid-layout">
          <div style={{ background: '#252522', padding: '20px', borderRadius: '12px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '8px', color: '#a6a69f', letterSpacing: '1px', fontWeight: 'bold' }}>MISSÕES & ENTREGÁVEIS</span>
              <span style={{ fontSize: '10px' }}>{completedMissions.length}/{projectMissions.length} concluídas</span>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {projectMissions.map(m => {
                const isDone = completed.includes(m.id)
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <b style={{ fontSize: '11px', textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#85857e' : '#fff' }}>{m.title}</b>
                      <p style={{ margin: '3px 0 0', fontSize: '9px', color: '#85857e' }}>XP Recompensa: {m.xp} XP</p>
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: isDone ? '#c6ff38' : m.approvalStatus === 'pending' ? '#ffd76a' : '#85857e', background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '4px' }}>
                      {isDone ? 'CONCLUÍDA' : m.approvalStatus === 'pending' ? 'EM APROVAÇÃO' : 'EM ABERTO'}
                    </span>
                  </div>
                )
              })}
              {projectMissions.length === 0 && <p style={{ fontSize: '11px', color: '#85857e', textAlign: 'center', padding: '20px' }}>Nenhuma missão criada para esta frente.</p>}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '20px', alignContent: 'start' }}>
            <div style={{ background: '#252522', padding: '20px', borderRadius: '12px', color: '#fff' }}>
              <span style={{ fontSize: '8px', color: '#a6a69f', letterSpacing: '1px', fontWeight: 'bold', display: 'block', marginBottom: '16px' }}>LINHA DO TEMPO / CRONOGRAMA</span>
              <div style={{ display: 'grid', gap: '14px', position: 'relative' }}>
                {milestones.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
                    <div style={{ display: 'grid', placeItems: 'center', width: '20px', height: '20px', borderRadius: '50%', background: m.reached ? '#8b73ff' : '#3c3c38', fontSize: '9px', fontWeight: 'bold', color: '#fff' }}>
                      {m.reached ? '✓' : idx + 1}
                    </div>
                    <div style={{ fontSize: '11px' }}>
                      <b style={{ color: m.reached ? '#fff' : '#85857e' }}>{m.title}</b>
                      <p style={{ margin: '2px 0 0', color: '#85857e', fontSize: '10px' }}>{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function ProjectBriefingModal({ clients, onClose, onLaunch }: { clients: ClientIdentity[]; onClose: () => void; onLaunch: (projectInput: { name: string; client: string; deadline: string; tone: Project['tone'] }, missions: { title: string; xp: number; description: string }[]) => void }) {
  const [client, setClient] = useState('')
  const [projectName, setProjectName] = useState('')
  const [objective, setObjective] = useState('')
  const [audience, setAudience] = useState('')
  const [competitors, setCompetitors] = useState('')
  const [channels, setChannels] = useState('')
  const [deadline, setDeadline] = useState('Próximo marco · em definição')
  
  const [step, setStep] = useState<'form' | 'result'>('form')
  const [loading, setLoading] = useState(false)
  const [aiResult, setAiResult] = useState<{ strategicSuggestion: string; milestones: { name: string; detail: string }[]; missions: { title: string; xp: number; description: string; checked?: boolean }[] } | null>(null)

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function handleGenerate(e: FormEvent) {
    e.preventDefault()
    if (!client || !projectName.trim()) return
    setLoading(true)
    try {
      const response = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client, projectName, objective, audience, competitors, channels, deadline })
      })
      if (!response.ok) throw new Error('Falha ao gerar briefing estratégico.')
      const result = await response.json() as typeof aiResult
      if (result) {
        setAiResult({
          ...result,
          missions: result.missions.map(m => ({ ...m, checked: true }))
        })
        setStep('result')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao processar briefing inteligência.')
    } finally {
      setLoading(false)
    }
  }

  function handleToggleMission(index: number) {
    if (!aiResult) return
    const updated = [...aiResult.missions]
    updated[index] = { ...updated[index], checked: !updated[index].checked }
    setAiResult({ ...aiResult, missions: updated })
  }

  function handleLaunch() {
    if (!aiResult) return
    const selectedMissions = aiResult.missions.filter(m => m.checked)
    onLaunch({ name: projectName, client, deadline, tone: 'purple' }, selectedMissions)
    onClose()
  }

  return (
    <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Briefing Inteligente">
      <div className="mission-create-dialog mission-create-dialog-expanded" style={{ width: 'min(780px, 100%)' }}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar Briefing Inteligente">×</button>
        <span className="mission-create-icon" style={{ background: '#8b73ff', color: '#171717' }}><Icon name="sparkle" size={21} /></span>
        <p>SIX AI · INTELIGÊNCIA OPERACIONAL</p>
        <h2>Briefing <em>Inteligente</em></h2>

        {step === 'form' ? (
          <form className="mission-create-form" onSubmit={handleGenerate}>
            <div className="mission-create-row">
              <label>
                <span>CLIENTE</span>
                <select value={client} onChange={(e) => setClient(e.target.value)} required>
                  <option value="" disabled>Selecione o cliente</option>
                  {clients.map((item) => <option value={item.name} key={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>
                <span>NOME DO PROJETO / CAMPANHA</span>
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Ex.: Black Friday 2026" required />
              </label>
            </div>

            <label>
              <span>OBJETIVO PRINCIPAL</span>
              <textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="O que este projeto visa alcançar? Ex: Aumentar leads ou awareness..." required />
            </label>

            <div className="mission-create-row">
              <label>
                <span>PÚBLICO-ALVO</span>
                <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Ex.: Jovens de 18-24 anos" />
              </label>
              <label>
                <span>PRINCIPAIS CONCORRENTES</span>
                <input value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder="Ex.: Concorrente A, Concorrente B" />
              </label>
            </div>

            <div className="mission-create-row">
              <label>
                <span>CANAIS DE VEICULAÇÃO</span>
                <input value={channels} onChange={(e) => setChannels(e.target.value)} placeholder="Ex.: Instagram, Google Search" />
              </label>
              <label>
                <span>PRAZO ESTIMADO</span>
                <input value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="Ex.: Final de Novembro" required />
              </label>
            </div>

            <button className="mission-create-submit" style={{ background: '#8b73ff', color: '#fff', marginTop: '24px' }} type="submit" disabled={loading}>
              {loading ? 'ANALISANDO & GERANDO BRIEFING...' : <>GERAR PROPOSTA ESTRATÉGICA COM SIX AI ✦</>}
            </button>
          </form>
        ) : (
          <div style={{ display: 'grid', gap: '20px', marginTop: '16px' }}>
            <div style={{ background: 'rgba(139,115,255,0.08)', border: '1px solid rgba(139,115,255,0.25)', padding: '16px', borderRadius: '8px' }}>
              <b style={{ fontSize: '8px', color: '#8b73ff', letterSpacing: '1px', textTransform: 'uppercase' }}>DIRETRIZ ESTRATÉGICA (SIX AI)</b>
              <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#dfdfd5', lineHeight: 1.5 }}>{aiResult?.strategicSuggestion}</p>
            </div>

            <div>
              <b style={{ fontSize: '8px', color: '#a6a69f', letterSpacing: '1px', textTransform: 'uppercase' }}>CRONOGRAMA E MARCOS SUGERIDOS</b>
              <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
                {aiResult?.milestones.map((m, idx) => (
                  <div key={idx} style={{ background: '#252522', padding: '10px', borderRadius: '6px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                    <span><b>{m.name}</b>: {m.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <b style={{ fontSize: '8px', color: '#a6a69f', letterSpacing: '1px', textTransform: 'uppercase' }}>MISSÕES OPERACIONAIS RECOMENDADAS</b>
              <div style={{ display: 'grid', gap: '6px', marginTop: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {aiResult?.missions.map((m, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#252522', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!m.checked} onChange={() => handleToggleMission(idx)} style={{ accentColor: '#8b73ff' }} />
                    <div style={{ fontSize: '11px' }}>
                      <b>{m.title}</b> <span style={{ color: '#8b73ff', fontWeight: 'bold', fontSize: '9px' }}>+{m.xp} XP</span>
                      <p style={{ margin: '2px 0 0', color: '#85857e', fontSize: '10px' }}>{m.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button className="mission-create-submit" style={{ flex: 1, margin: 0, background: '#8b73ff', color: '#fff' }} onClick={handleLaunch}>
                LANÇAR PROJETO E MISSÕES RECOMENDADAS 🚀
              </button>
              <button className="mission-create-submit" style={{ width: '120px', margin: 0, background: '#353530', color: '#f3f3eb' }} onClick={() => setStep('form')}>
                VOLTAR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
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

function KudoModal({ team, onClose, onSent }: { team: TeamMember[]; onClose: () => void; onSent: () => void }) {
  const [targetName, setTargetName] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!targetName || !reason.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetName, reason })
      })
      if (!res.ok) throw new Error('Não foi possível enviar kudos.')
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar kudo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-edit-overlay" role="dialog" aria-modal="true" aria-label="Enviar Kudos">
      <form className="profile-edit-dialog" onSubmit={handleSubmit} style={{ width: 'min(480px, 100%)' }}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar modal de kudos">×</button>
        <h2>Mandar <em>Kudos ✦</em></h2>
        <div className="profile-edit-form">
          <label>
            <span>COLEGA DE EQUIPE</span>
            <select value={targetName} onChange={(e) => setTargetName(e.target.value)} required>
              <option value="" disabled>Selecione um colega</option>
              {team.map((m) => <option value={m.name} key={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label>
            <span>MOTIVO DO ELOGIO / RECONHECIMENTO</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva por que você está elogiando este colega..." maxLength={200} required />
          </label>
          {error && <p style={{ margin: 0, color: '#d63031', fontSize: '11px' }}>{error}</p>}
          <button className="profile-edit-submit" style={{ background: '#8b73ff', color: '#fff' }} type="submit" disabled={saving}>
            {saving ? 'ENVIANDO...' : 'ENVIAR KUDOS ✦'}
          </button>
        </div>
      </form>
    </div>
  )
}

function FeedPage({ team }: { team: TeamMember[] }) {
  const [feedItems, setFeedItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isKudoOpen, setIsKudoOpen] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)

  const loadFeed = useCallback(() => {
    setIsLoading(true)
    fetch('/api/feed')
      .then(res => res.json())
      .then((data: any) => {
        if (Array.isArray(data)) {
          setFeedItems(data)
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  return (
    <section className="profile-page">
      {showCelebration && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, display: 'grid', placeItems: 'center' }}>
          <style>{`
            @keyframes celebrate {
              0% { transform: scale(0.6) translateY(20px); opacity: 0; }
              20% { transform: scale(1.1) translateY(-10px); opacity: 1; }
              80% { transform: scale(1) translateY(0); opacity: 1; }
              100% { transform: scale(0.9) translateY(-20px); opacity: 0; }
            }
            .celebrate-card {
              background: #171717;
              color: #c6ff38;
              border: 2px solid #8b73ff;
              padding: 24px 36px;
              border-radius: 16px;
              text-align: center;
              box-shadow: 0 20px 60px rgba(0,0,0,0.5);
              animation: celebrate 2s ease-in-out forwards;
            }
          `}</style>
          <div className="celebrate-card">
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>🎉</span>
            <h2 style={{ margin: 0, fontSize: '20px', letterSpacing: '-1px' }}>KUDOS ENVIADOS!</h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#a5a59e' }}>+100 XP distribuídos para o time ✦</p>
          </div>
        </div>
      )}

      <div className="profile-banner" style={{ borderColor: '#8b73ff', minHeight: '140px' }}>
        <button className="profile-edit-trigger" style={{ background: '#8b73ff', borderColor: '#8b73ff' }} onClick={() => setIsKudoOpen(true)}>
          MANDAR KUDOS ✦
        </button>
        <div className="profile-banner-content" style={{ padding: '24px' }}>
          <div className="profile-identity">
            <span className="profile-role" style={{ color: '#8b73ff' }}>ACONTECENDO AGORA</span>
            <h1 style={{ fontSize: '24px' }}>Feed da <em>Agência</em></h1>
            <p className="profile-bio">Acompanhe as conquistas, kudos e atualizações operacionais do time em tempo real.</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '780px', margin: '24px auto', display: 'grid', gap: '14px' }}>
        {isLoading ? (
          <p style={{ color: '#85857e', fontSize: '12px', textAlign: 'center', padding: '40px' }}>Carregando atualizações da agência...</p>
        ) : feedItems.length > 0 ? (
          feedItems.map((item) => {
            const initials = item.user_name ? item.user_name.split(/\s+/).map((p: any) => p.charAt(0)).join('').slice(0, 2).toLocaleUpperCase('pt-BR') : 'SX'
            const isKudo = item.type === 'kudo_received'
            const isMission = item.type === 'mission_completed'
            const isProject = item.type === 'project_created'
            
            return (
              <div key={item.id} style={{ display: 'flex', gap: '14px', background: '#fffefa', border: '1px solid #e1e1da', padding: '16px', borderRadius: '12px', alignItems: 'center' }}>
                <span className="avatar avatar-purple" style={{ background: isKudo ? '#8b73ff' : isProject ? '#c6ff38' : '#222', color: isProject ? '#171717' : '#fff' }}>{initials}</span>
                <div style={{ flex: 1, fontSize: '12px', color: '#171717' }}>
                  <b style={{ textTransform: 'capitalize' }}>{item.user_name || 'Membro do Time'}</b> {item.title} <strong style={{ color: isKudo ? '#8b73ff' : isProject ? '#8b73ff' : '#171717' }}>{item.target_name}</strong>
                  {item.xp_amount && <span style={{ marginLeft: '8px', color: '#8b73ff', fontWeight: 'bold', fontSize: '10px', background: 'rgba(139,115,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>+{item.xp_amount} XP</span>}
                  <p style={{ margin: '4px 0 0', color: '#85857e', fontSize: '10px' }}>{new Date(item.created_at).toLocaleString('pt-BR')}</p>
                </div>
                {item.link && <a href={item.link} style={{ fontSize: '10px', color: '#8b73ff', fontWeight: 'bold', textDecoration: 'none' }}>VER ↗</a>}
              </div>
            )
          })
        ) : (
          <p style={{ color: '#85857e', fontSize: '12px', textAlign: 'center', padding: '40px' }}>Nenhum evento registrado no feed até o momento.</p>
        )}
      </div>

      {isKudoOpen && (
        <KudoModal team={team} onClose={() => setIsKudoOpen(false)} onSent={() => { setIsKudoOpen(false); loadFeed(); setShowCelebration(true); setTimeout(() => setShowCelebration(false), 2000) }} />
      )}
    </section>
  )
}

function DateTimePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)

  const parsedDate = value ? new Date(value) : new Date()
  const isValid = !isNaN(parsedDate.getTime())
  const activeDate = isValid ? parsedDate : new Date()

  const [currentYear, setCurrentYear] = useState(activeDate.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(activeDate.getMonth())
  const [selectedDay, setSelectedDay] = useState(activeDate.getDate())
  const [selectedHour, setSelectedHour] = useState(activeDate.getHours())
  const [selectedMinute, setSelectedMinute] = useState(activeDate.getMinutes())

  useEffect(() => {
    if (value) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear())
        setCurrentMonth(d.getMonth())
        setSelectedDay(d.getDate())
        setSelectedHour(d.getHours())
        setSelectedMinute(d.getMinutes())
      }
    }
  }, [value])

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()

  const prevDaysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const prevDaysList = Array.from({ length: firstDayIndex }, (_, i) => prevDaysInMonth - firstDayIndex + 1 + i)
  const currentDaysList = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  function updateDateTime(day: number, hour: number, minute: number) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const formatted = `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
    onChange(formatted)
  }

  function handleDaySelect(day: number) {
    setSelectedDay(day)
    updateDateTime(day, selectedHour, selectedMinute)
  }

  function handleHourChange(hour: number) {
    setSelectedHour(hour)
    updateDateTime(selectedDay, hour, selectedMinute)
  }

  function handleMinuteChange(minute: number) {
    setSelectedMinute(minute)
    updateDateTime(selectedDay, selectedHour, minute)
  }

  function handleQuickTime(h: number, m: number) {
    setSelectedHour(h)
    setSelectedMinute(m)
    updateDateTime(selectedDay, h, m)
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const displayDateStr = () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(selectedDay)}/${pad(currentMonth + 1)}/${currentYear}, ${pad(selectedHour)}:${pad(selectedMinute)}`
  }

  return (
    <div className="custom-datetime-picker" style={{ width: '100%' }}>
      <style>{`
        .datepicker-trigger-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          height: 41px;
          padding: 0 12px;
          background: #292926;
          border: 1px solid #474743;
          border-radius: 7px;
          color: #fff;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }
        .datepicker-trigger-btn:focus, .datepicker-trigger-btn:hover {
          border-color: #c6ff38;
          box-shadow: 0 0 0 3px rgba(198, 255, 56, 0.15);
        }
        .datepicker-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999999 !important;
          display: grid;
          place-items: center;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(10px);
          padding: 16px;
          animation: datepickerFadeIn 0.2s ease;
        }
        @keyframes datepickerFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .datepicker-modal-card {
          width: min(390px, 94vw);
          background: #171717;
          border: 1px solid #383834;
          border-radius: 20px;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.95);
          padding: 24px;
          color: #fff;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .datepicker-modal-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .datepicker-modal-eyebrow {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1.1px;
          color: #c6ff38;
          display: block;
          margin-bottom: 2px;
        }
        .datepicker-modal-head h3 {
          margin: 0;
          font-size: 20px;
          letter-spacing: -0.8px;
          font-weight: 800;
        }
        .datepicker-modal-close {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: #fff;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 20px;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.15s ease;
          line-height: 1;
        }
        .datepicker-modal-close:hover {
          background: rgba(255,255,255,0.2);
          color: #c6ff38;
        }
        .datepicker-month-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 14px;
          background: #22221f;
          border: 1px solid #33332e;
          border-radius: 10px;
        }
        .datepicker-month-nav b {
          font-size: 13px;
          letter-spacing: -0.3px;
        }
        .datepicker-month-nav button {
          background: transparent;
          border: none;
          color: #c6ff38;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          padding: 0 8px;
        }
        .datepicker-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
          text-align: center;
        }
        .datepicker-grid span.weekday {
          font-size: 9px;
          font-weight: 800;
          color: #85857e;
          padding-bottom: 2px;
        }
        .datepicker-grid button {
          height: 34px;
          border-radius: 8px;
          font-size: 12px;
          background: transparent;
          border: none;
          color: #fff;
          cursor: pointer;
          transition: all 0.15s ease;
          display: grid;
          place-items: center;
        }
        .datepicker-grid button.other-month {
          color: #4a4a45;
          cursor: default;
          pointer-events: none;
        }
        .datepicker-grid button:hover:not(.other-month) {
          background: rgba(198, 255, 56, 0.15);
          color: #c6ff38;
        }
        .datepicker-grid button.selected {
          background: #c6ff38 !important;
          color: #171717 !important;
          font-weight: 900;
        }
        .timepicker-popup-box {
          background: #22221f;
          border: 1px solid #383834;
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .timepicker-popup-label {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1.1px;
          color: #85857e;
          text-align: center;
        }
        .timepicker-popup-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        .timepicker-popup-controls label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: center;
        }
        .timepicker-popup-controls label span {
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #85857e;
        }
        .timepicker-popup-controls select {
          background: #171717;
          border: 1px solid #4a4a45;
          border-radius: 8px;
          color: #fff;
          padding: 8px 14px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          appearance: auto !important;
          outline: none;
        }
        .timepicker-popup-controls select:focus {
          border-color: #c6ff38;
        }
        .timepicker-colon {
          font-size: 24px;
          font-weight: 900;
          color: #c6ff38;
          margin-top: 12px;
        }
        .timepicker-popup-quick {
          display: flex;
          gap: 6px;
        }
        .timepicker-popup-quick button {
          flex: 1;
          padding: 7px 0;
          background: #2a2a26;
          border: 1px solid #3d3d38;
          border-radius: 6px;
          color: #aaa9a1;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .timepicker-popup-quick button:hover {
          background: #33332e;
          color: #c6ff38;
          border-color: #c6ff38;
        }
        .datepicker-confirm-action {
          width: 100%;
          padding: 13px;
          background: #c6ff38;
          color: #171717;
          border: none;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.6px;
          cursor: pointer;
          text-align: center;
          transition: background 0.15s ease;
        }
        .datepicker-confirm-action:hover {
          background: #d4ff5c;
        }
      `}</style>
      
      <button 
        type="button" 
        className="datepicker-trigger-btn"
        onClick={() => setIsOpen(true)}
      >
        <span>{displayDateStr()}</span>
        <span style={{ color: '#c6ff38', fontSize: '15px' }}>📅</span>
      </button>

      {isOpen && createPortal(
        <div 
          className="datepicker-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false)
          }}
        >
          <div className="datepicker-modal-card">
            <div className="datepicker-modal-head">
              <div>
                <span className="datepicker-modal-eyebrow">AGENDA & PRAZOS</span>
                <h3>Selecionar Data & Hora</h3>
              </div>
              <button 
                type="button" 
                className="datepicker-modal-close"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="datepicker-month-nav">
              <button type="button" onClick={prevMonth}>‹</button>
              <b>{months[currentMonth]} de {currentYear}</b>
              <button type="button" onClick={nextMonth}>›</button>
            </div>

            <div className="datepicker-grid">
              <span className="weekday">DOM</span>
              <span className="weekday">SEG</span>
              <span className="weekday">TER</span>
              <span className="weekday">QUA</span>
              <span className="weekday">QUI</span>
              <span className="weekday">SEX</span>
              <span className="weekday">SÁB</span>

              {prevDaysList.map((d, i) => (
                <button key={`prev-${i}`} type="button" className="other-month">{d}</button>
              ))}

              {currentDaysList.map((d) => (
                <button 
                  key={`day-${d}`} 
                  type="button" 
                  className={selectedDay === d ? 'selected' : ''}
                  onClick={() => handleDaySelect(d)}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="timepicker-popup-box">
              <span className="timepicker-popup-label">HORÁRIO DE ENTREGA / REUNIÃO</span>
              <div className="timepicker-popup-controls">
                <label>
                  <span>HORA</span>
                  <select 
                    value={selectedHour} 
                    onChange={(e) => handleHourChange(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}h</option>
                    ))}
                  </select>
                </label>
                <span className="timepicker-colon">:</span>
                <label>
                  <span>MINUTOS</span>
                  <select 
                    value={selectedMinute} 
                    onChange={(e) => handleMinuteChange(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}m</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="timepicker-popup-quick">
                <button type="button" onClick={() => handleQuickTime(9, 0)}>09:00</button>
                <button type="button" onClick={() => handleQuickTime(12, 0)}>12:00</button>
                <button type="button" onClick={() => handleQuickTime(14, 30)}>14:30</button>
                <button type="button" onClick={() => handleQuickTime(18, 0)}>18:00</button>
              </div>
            </div>

            <button 
              type="button" 
              className="datepicker-confirm-action"
              onClick={() => setIsOpen(false)}
            >
              CONFIRMAR E APLICAR <span>→</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function ComingSoon({ title, onBack }: { title: string; onBack: () => void }) {
  return <section className="coming-soon"><p>EM CONSTRUÇÃO</p><h1>{title}</h1><span>Este módulo já tem navegação preparada. A próxima etapa conecta sua base de dados e os fluxos reais.</span><button onClick={onBack}>VOLTAR PARA O INÍCIO <span>←</span></button></section>
}

function ProfilePage({ accessSession, onLogoutSuccess }: { accessSession: AccessSession | null; onLogoutSuccess?: () => void }) {
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    void getProfileData().then(setProfileData).catch((reason: Error) => setError(reason.message))
  }, [])

  if (error) return <section className="profile-page"><div className="profile-banner"><div className="profile-banner-content"><div className="profile-identity"><h1>Perfil indisponível</h1><p className="profile-bio">{error}. Os dados de demonstração serão usados no modo local.</p></div></div></div></section>

  const profile = profileData?.profile
  const ranking = profileData?.ranking ?? []
  const stickers = profileData?.stickers ?? []
  const stats = profileData?.stats ?? { projectsDelivered: 0, averageApproval: 100 }
  const levelConfig = profileData?.levelConfig ?? [{ name: 'Criador', target: 0, detail: 'Transforma intenção em entrega.' }, { name: 'Visionário', target: 8700, detail: 'Enxerga possibilidades antes do óbvio.' }, { name: 'Catalisador', target: 12000, detail: 'Move pessoas e ideias para a frente.' }]
  const currentLevel = profile ? ([...levelConfig].reverse().find((level) => (profile.xp ?? 0) >= level.target) ?? levelConfig[0]) : levelConfig[0]
  const nextLevel = profile ? levelConfig.find((level) => level.target > (profile.xp ?? 0)) : levelConfig[1]
  const displayName = profile?.socialName || profile?.name || accessSession?.name || 'Colaborador'
  const displayRole = profile?.customRole || (accessSession?.role === 'admin' ? 'Administrador' : 'Especialista')
  const highlightColor = profile?.highlightColor || '#c6ff38'
  const initials = displayName.split(/\s+/).map((p: string) => p.charAt(0)).join('').slice(0, 2).toLocaleUpperCase('pt-BR') || 'SX'

  function handleProfileSaved() {
    setIsEditing(false)
    void getProfileData().then(setProfileData).catch(() => undefined)
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    if (onLogoutSuccess) {
      onLogoutSuccess()
    } else {
      window.location.assign('/?preview=login')
    }
  }

  return <section className="profile-page"><div className="profile-banner" style={{ borderColor: highlightColor }}>{profile?.bannerUrl && <img className="profile-banner-image" src={profile.bannerUrl} alt="" />}<div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '8px', zIndex: 2 }}><button className="profile-edit-trigger" style={{ position: 'static' }} onClick={() => setIsEditing(true)}>EDITAR PERFIL</button><button className="profile-edit-trigger" style={{ position: 'static', background: 'rgba(214,48,49,0.2)', borderColor: 'rgba(214,48,49,0.3)' }} onClick={handleLogout}>SAIR</button></div><div className="profile-banner-content"><div className="profile-avatar-large" style={{ borderColor: highlightColor }}>{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials}</div><div className="profile-identity"><span className="profile-role">{displayRole.toUpperCase()}</span><h1>{displayName}</h1>{profile?.bio && <p className="profile-bio">{profile.bio}</p>}</div></div></div><div className="profile-stats-grid"><div className="profile-stat-card highlight" style={{ background: highlightColor, borderColor: highlightColor }}><span style={{ color: '#171717' }}>XP TOTAL</span><b style={{ color: '#171717' }}>{(profile?.xp ?? 0).toLocaleString('pt-BR')}</b><small style={{ color: 'rgba(0,0,0,.5)' }}>pontos acumulados</small></div><div className="profile-stat-card"><span>NÍVEL</span><b>{currentLevel.name}</b><small>{currentLevel.detail}</small></div><div className="profile-stat-card"><span>STREAK</span><b>{profile?.streakDays ?? 0}</b><small>dias seguidos</small></div><div className="profile-stat-card"><span>PROJETOS</span><b>{stats.projectsDelivered}</b><small>entregues</small></div><div className="profile-stat-card"><span>APROVAÇÃO</span><b>{stats.averageApproval}%</b><small>taxa média</small></div></div><div className="profile-content"><div><section className="profile-section"><div className="profile-section-head"><div><span>CLASSIFICAÇÃO</span><h2>Ranking <em>do time</em></h2></div><b>{ranking.length} pessoas</b></div><div className="ranking-list">{ranking.map((member, index) => <div className="ranking-item" key={member.id}><span className="ranking-position">{index + 1}º</span><span className="ranking-avatar">{member.avatarUrl ? <img src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (member.socialName || member.name).split(/\s+/).map((p: string) => p.charAt(0)).join('').slice(0, 2).toLocaleUpperCase('pt-BR')}</span><div className="ranking-name"><b>{member.socialName || member.name}</b><small>{member.level} · {member.xp.toLocaleString('pt-BR')} XP</small></div><span className="ranking-xp">{member.xp.toLocaleString('pt-BR')}</span></div>)}</div></section>{profile?.internalNetworks && Object.keys(profile.internalNetworks).length > 0 && <section className="profile-section" style={{ marginTop: 20 }}><div className="profile-section-head"><span>REDES INTERNAS</span></div>{Object.entries(profile.internalNetworks).map(([key, value]) => <div key={key} style={{ padding: '6px 0', fontSize: '11px' }}><b style={{ textTransform: 'uppercase', fontSize: '8px', letterSpacing: '1px', color: '#85857e' }}>{key}</b><br /><span style={{ color: '#171717' }}>{value as string}</span></div>)}</section>}{profile?.signature && <section className="profile-section" style={{ marginTop: 20 }}><div className="profile-section-head"><span>ASSINATURA</span></div><p style={{ margin: 0, fontSize: '12px', color: '#4e4e48', lineHeight: 1.5, fontStyle: 'italic' }}>{profile.signature}</p></section>}</div><div><section className="profile-section"><div className="profile-section-head"><div><span>CONQUISTAS</span><h2>Stickers <em>coletados</em></h2></div><b>{stickers.filter((s) => s.unlocked).length}/{stickers.length}</b></div><div className="sticker-grid">{stickers.map((sticker) => <div className={`sticker-card ${sticker.unlocked ? 'unlocked' : ''}`} key={sticker.code}><span className="sticker-emoji">{sticker.imageUrl}</span><b>{sticker.name}</b><small>{sticker.description}</small></div>)}</div></section>{nextLevel && <section className="profile-section" style={{ marginTop: 20 }}><div className="profile-section-head"><span>PRÓXIMO NÍVEL</span></div><div style={{ marginTop: 8 }}><b style={{ fontSize: '18px', letterSpacing: '-1px' }}>{nextLevel.name}</b><p style={{ margin: '4px 0 10px', fontSize: '10px', color: '#85857e' }}>{nextLevel.detail}</p><div style={{ height: 6, background: '#e2e2db', borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, (((profile?.xp ?? 0) - currentLevel.target) / (nextLevel.target - currentLevel.target)) * 100)}%`, background: highlightColor, borderRadius: 'inherit', transition: 'width .35s ease' }} /></div><small style={{ display: 'block', marginTop: 6, fontSize: '9px', color: '#85857e' }}>Faltam {(nextLevel.target - (profile?.xp ?? 0)).toLocaleString('pt-BR')} XP</small></div></section>}</div></div>{isEditing && <ProfileEditModal profile={profile} onClose={() => setIsEditing(false)} onSaved={handleProfileSaved} />}</section>
}

function ProfileEditModal({ profile, onClose, onSaved }: { profile: UserProfile | undefined; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(profile?.name ?? '')
  const [socialName, setSocialName] = useState(profile?.socialName ?? '')
  const [customRole, setCustomRole] = useState(profile?.customRole ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [highlightColor, setHighlightColor] = useState(profile?.highlightColor ?? '#c6ff38')
  const [signature, setSignature] = useState(profile?.signature ?? '')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setErrorMessage('')
    try {
      await updateProfile({ name: name.trim() || undefined, socialName: socialName.trim() || null, customRole: customRole.trim() || null, bio: bio.trim() || null, highlightColor: highlightColor || '#c6ff38', signature: signature.trim() || null } as Partial<UserProfile>)
      onSaved()
    } catch (reason: unknown) {
      setErrorMessage(reason instanceof Error ? reason.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return <div className="profile-edit-overlay" role="dialog" aria-modal="true" aria-label="Editar perfil"><form className="profile-edit-dialog" onSubmit={handleSubmit}><button className="close-button" type="button" onClick={onClose} aria-label="Fechar edição de perfil">×</button><h2>Editar <em>perfil</em></h2><div className="profile-edit-form"><div className="profile-edit-row"><label><span>NOME</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" /></label><label><span>NOME SOCIAL</span><input value={socialName} onChange={(e) => setSocialName(e.target.value)} placeholder="Como gostaria de ser chamado" /></label></div><div className="profile-edit-row"><label><span>CARGO DE EXIBIÇÃO</span><input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="Ex.: Redator Principal" /></label><label><span>COR DE DESTAQUE <span className="profile-color-preview" style={{ background: highlightColor }} /></span><input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} /></label></div><label><span>BIO</span><textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte um pouco sobre você..." maxLength={1000} /></label><label><span>ASSINATURA</span><textarea value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Sua assinatura profissional" maxLength={2000} /></label>{errorMessage && <p style={{ margin: 0, color: '#d63031', fontSize: '11px' }}>{errorMessage}</p>}<button className="profile-edit-submit" type="submit" disabled={saving}>{saving ? 'SALVANDO…' : 'SALVAR ALTERAÇÕES'} <span>→</span></button></div></form></div>
}

function JourneyPanel({ profile, completedCount, missionCount, totalXp, onClose }: { profile: DashboardData['profile'] & { levelConfig?: LevelConfigItem[] | null }; completedCount: number; missionCount: number; totalXp: number; onClose: () => void }) {
  const milestones = profile.levelConfig ?? [{ name: 'Criador', target: 0, detail: 'Transforma intenção em entrega.' }, { name: 'Visionário', target: 8700, detail: 'Enxerga possibilidades antes do óbvio.' }, { name: 'Catalisador', target: 12000, detail: 'Move pessoas e ideias para a frente.' }]
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
