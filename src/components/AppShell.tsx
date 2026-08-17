import { useEffect, useMemo, useRef, useState } from 'react'
import type { AccessSession } from '../data/accessRepository'
import { getClientIdentities, type ClientIdentity } from '../data/clientRepository'
import {
  emptyDashboard,
  type AppNotification,
  type DashboardData,
  type Mission,
  type Project,
} from '../data/dashboard'
import { getDashboard } from '../data/dashboardRepository'
import {
  attachProjectLibraryFile,
  createMission as persistMissionCreate,
  deleteMission as persistMissionDelete,
  getMissionDetails,
  requestMissionCompletion,
  returnMissionWorkflow,
  startMissionTimer,
  stopMissionTimer,
  TimerConflictError,
  updateMission as persistMissionUpdate,
} from '../data/missionRepository'
import {
  getProjectLibrary,
  uploadProjectLibraryFile,
} from '../data/projectLibraryRepository'
import {
  createProject as persistProjectCreate,
  updateProject as persistProjectUpdate,
} from '../data/projectRepository'
import { usePermission } from '../hooks/usePermission'
import { LogoWhite } from '../Logo'
import { APP_VERSION_LABEL } from '../version'
import {
  deadlineToMissionDate,
  enrichProjectClientIdentity,
  formatElapsedTimer,
  formatMissionDeadline,
  getInitials,
  getProjectHealth,
  getStoredReadNotifications,
  isMissionCompleted,
  saveReadNotifications,
} from '../utils/formatters'
import { AdminPage } from './admin/AdminPage'
import { AgendaPage } from './agenda/AgendaPage'
import { AnalyticsPage } from './analytics/AnalyticsPage'
import { ChangePasswordModal } from './auth/ChangePasswordModal'
import { Dashboard } from './dashboard/DashboardPage'
import { EvolutionPage } from './evolution/EvolutionPage'
import { FeedPage } from './feed/FeedPage'
import { LibraryPage } from './library/LibraryPage'
import { MissionCreateModal, type MissionCreationInput } from './missions/MissionCreateModal'
import { MissionsPage } from './missions/MissionsPage'
import { CommandPalette } from './modals/CommandPalette'
import { HelpModal } from './modals/HelpModal'
import { NotificationsPanel } from './modals/NotificationsPanel'
import { OperationalAssistantPanel } from './modals/OperationalAssistantPanel'
import { JourneyPanel } from './profile/JourneyPanel'
import { ProfilePage } from './profile/ProfilePage'
import { ProjectsPage } from './projects/ProjectsPage'
import { TeamPage } from './team/TeamPage'
import { Avatar } from './shared/Avatar'
import { ConfirmActionModal } from './modals/ConfirmActionModal'
import { ComingSoon } from './shared/ComingSoon'
import { Icon } from './shared/Icon'
import { MissionTimerValue } from './shared/MissionTimerValue'
import { navigation, sectionLabels } from './shared/navigation'

export function AppShell({
  accessSession,
  setAccessSession,
}: {
  accessSession: AccessSession
  setAccessSession: (session: AccessSession | null) => void
  reloadSession: () => void
}) {
  const { can } = usePermission()
  const [activeSection, setActiveSection] = useState('home')
  const [libraryProjectId, setLibraryProjectId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'today' | 'urgent'>('all')
  const [completed] = useState<string[]>([])
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isJourneyOpen, setIsJourneyOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(getStoredReadNotifications)
  const [notificationMissionId, setNotificationMissionId] = useState<string | null>(null)
  const [completionMessage, setCompletionMessage] = useState('')
  const [timerPendingMissionId, setTimerPendingMissionId] = useState<string | null>(null)
  const [pendingTimerSwitch, setPendingTimerSwitch] = useState<{ targetMissionId: string; targetMissionTitle: string; activeTimer: { missionTitle: string; missionId: string; id: string; startedAt: string } } | null>(null)
  const [pendingDeleteMission, setPendingDeleteMission] = useState<Mission | null>(null)
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null)

  useEffect(() => {
    const handleAccessDenied = () => setCompletionMessage('Acesso negado. Você não tem permissão para realizar esta ação.')
    window.addEventListener('sixos:access-denied', handleAccessDenied)
    return () => window.removeEventListener('sixos:access-denied', handleAccessDenied)
  }, [])

  const [clientIdentities, setClientIdentities] = useState<ClientIdentity[]>([])

  useEffect(() => {
    const handleClientDescriptionUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ clientId: string; description: string | null }>).detail
      if (!detail?.clientId) return
      setClientIdentities((current) => current.map((client) => client.id === detail.clientId ? { ...client, description: detail.description } : client))
    }
    window.addEventListener('sixos:client-description-updated', handleClientDescriptionUpdated)
    return () => window.removeEventListener('sixos:client-description-updated', handleClientDescriptionUpdated)
  }, [])

  const [dashboardData, setDashboardData] = useState<DashboardData>(emptyDashboard)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<'change-password' | 'help' | null>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const operationalRefreshRef = useRef<Promise<void> | null>(null)
  const lastOperationalResumeRef = useRef(0)

  useEffect(() => {
    if (!isAccountMenuOpen) return

    function closeAccountMenu(event: PointerEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') setIsAccountMenuOpen(false)
        return
      }
      if (!accountMenuRef.current?.contains(event.target as Node)) setIsAccountMenuOpen(false)
    }

    window.addEventListener('pointerdown', closeAccountMenu)
    window.addEventListener('keydown', closeAccountMenu)
    return () => {
      window.removeEventListener('pointerdown', closeAccountMenu)
      window.removeEventListener('keydown', closeAccountMenu)
    }
  }, [isAccountMenuOpen])

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    setAccessSession(null)
    window.location.assign('/')
  }

  const [feedItemsCount, setFeedItemsCount] = useState(0)
  const [seenFeedCount, setSeenFeedCount] = useState(() => {
    return parseInt(localStorage.getItem('sixos_seen_feed') || '0', 10) || 0
  })

  useEffect(() => {
    const refreshOperationalData = () => {
      if (operationalRefreshRef.current) return operationalRefreshRef.current

      const request = Promise.allSettled([getDashboard(), getClientIdentities()]).then(([dashboard, clients]) => {
        if (dashboard.status === 'fulfilled') setDashboardData(dashboard.value)
        else setCompletionMessage(dashboard.reason instanceof Error ? dashboard.reason.message : 'Não foi possível carregar o dashboard.')

        if (clients.status === 'fulfilled') setClientIdentities(clients.value)
        else setCompletionMessage(clients.reason instanceof Error ? clients.reason.message : 'Não foi possível carregar os clientes.')
      }).finally(() => {
        if (operationalRefreshRef.current === request) operationalRefreshRef.current = null
      })
      operationalRefreshRef.current = request
      return request
    }
    const handleResume = () => {
      if (document.hidden || Date.now() - lastOperationalResumeRef.current < 1000) return
      lastOperationalResumeRef.current = Date.now()
      void refreshOperationalData()
    }
    void refreshOperationalData()

    let feedController: AbortController | null = null
    function checkFeed() {
      feedController?.abort()
      const controller = new AbortController()
      feedController = controller
      const timeout = window.setTimeout(() => controller.abort(), 10000)
      fetch('/api/feed', { signal: controller.signal, cache: 'no-store' })
        .then((res) => res.json())
        .then((data: any) => {
          if (Array.isArray(data)) {
            setFeedItemsCount(data.length)
          }
        })
        .catch(() => undefined)
        .finally(() => {
          window.clearTimeout(timeout)
          if (feedController === controller) feedController = null
        })
    }
    checkFeed()
    const interval = setInterval(checkFeed, 30000)
    window.addEventListener('pageshow', handleResume)
    document.addEventListener('visibilitychange', handleResume)
    return () => {
      clearInterval(interval)
      feedController?.abort()
      window.removeEventListener('pageshow', handleResume)
      document.removeEventListener('visibilitychange', handleResume)
    }
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
      return { id: `alert-mission-${mission.id}`, title: `Missão urgente: ${mission.title}`, description: `${mission.client} · prazo ${mission.deadline}${assignee ? ` · ${assignee.name}` : ''}.`, time: 'agora', category: 'Projeto' as const, tone: 'orange' as const, destination: { section: 'missions' as const, missionId: mission.id } }
    })
    const projectNotifications = projectsWithMissionProgress.filter((project) => getProjectHealth(project, dashboardData.missions, completed).tone === 'attention').map((project) => ({ id: `alert-project-${project.id}`, title: `${project.name} precisa de atenção`, description: 'Há uma missão urgente em andamento nesta frente.', time: 'agora', category: 'Projeto' as const, tone: 'orange' as const, destination: { section: 'projects' as const, projectId: project.id } }))
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
    void requestMissionCompletion(id).then(async (result) => {
      const refreshed = await getDashboard()
      setDashboardData(refreshed)
      if (result.status === 'pending_approval') {
        setCompletionMessage(`${missionTitle} foi enviada para aprovação.`)
        return
      }
      if (result.status === 'workflow_advanced') {
        setCompletionMessage(`${missionTitle} avançou para ${result.currentDepartment}.`)
        return
      }
      const awards = result.awards ?? []
      setCompletionMessage(awards.length ? `${missionTitle} foi concluída. XP liberado para ${awards.map((award) => award.userName).join(', ')}.` : `${missionTitle} foi concluída sem crédito de XP.`)
    }).catch((reason: unknown) => setCompletionMessage(reason instanceof Error ? reason.message : 'Não foi possível concluir a missão. Tente novamente.'))
  }

  function requestDeleteMission(id: string) {
    const mission = dashboardData.missions.find((item) => item.id === id)
    if (mission) setPendingDeleteMission(mission)
  }

  function confirmDeleteMission() {
    if (!pendingDeleteMission) return
    const id = pendingDeleteMission.id
    void persistMissionDelete(id).then(() => {
      setDashboardData((current) => ({ ...current, missions: current.missions.filter((item) => item.id !== id) }))
      setCompletionMessage(`${pendingDeleteMission.title} foi cancelada e removida das visões operacionais.`)
    }).catch((reason: unknown) => setCompletionMessage(reason instanceof Error ? reason.message : 'Não foi possível excluir a missão.'))
      .finally(() => setPendingDeleteMission(null))
  }

  function requestDeleteProject(id: string) {
    const project = dashboardData.projects.find((item) => item.id === id)
    if (project) setPendingDeleteProject(project)
  }

  async function confirmDeleteProject() {
    if (!pendingDeleteProject) return
    const id = pendingDeleteProject.id
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(payload.error || 'Falha ao excluir o projeto.')
      }
      setDashboardData((current) => ({ ...current, projects: current.projects.filter((p) => p.id !== id) }))
      setCompletionMessage(`${pendingDeleteProject.name} foi movido para o arquivo morto.`)
    } catch (reason) {
      setCompletionMessage(reason instanceof Error ? reason.message : 'Não foi possível excluir o projeto.')
    } finally {
      setPendingDeleteProject(null)
    }
  }

  function returnMission(id: string, targetPosition: number) {
    const mission = dashboardData.missions.find((item) => item.id === id)
    if (!mission) return
    void returnMissionWorkflow(id, targetPosition).then(async (result) => {
      setDashboardData(await getDashboard())
      setCompletionMessage(`${mission.title} voltou para ${result.currentDepartment}.`)
    }).catch((reason: unknown) => setCompletionMessage(reason instanceof Error ? reason.message : 'Não foi possível devolver a missão.'))
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

  function openNotification(notification: AppNotification) {
    markNotificationRead(notification.id)
    setIsNotificationsOpen(false)

    const destination = notification.destination
      ?? (notification.category === 'Agenda'
        ? { section: 'agenda' as const }
        : notification.category === 'Equipe'
          ? { section: 'team' as const }
          : { section: 'projects' as const })

    if (destination.section === 'missions') {
      setNotificationMissionId(destination.missionId)
      setActiveSection('missions')
      return
    }

    if (destination.section === 'projects') {
      if (destination.projectId) setLibraryProjectId(destination.projectId)
      setActiveSection('projects')
      return
    }

    setActiveSection(destination.section)
  }

  async function createMission(input: MissionCreationInput) {
    const project = dashboardData.projects.find((item) => item.id === input.projectId)
    if (!project) throw new Error('Projeto não encontrado para criar a missão.')
    const projectClient = project.client
    const projectId = project.id

    function addMission(saved: Awaited<ReturnType<typeof persistMissionCreate>>) {
      const workflowDepartments = input.workflowSteps?.map((step) => step.departmentName) ?? input.workflowDepartments ?? []
      const workflowResponsibleNames = input.workflowSteps?.map((step) => dashboardData.team.find((member) => member.id === step.responsibleUserId)?.name ?? 'A definir') ?? []
      const mission: Mission = {
        id: saved.id,
        title: input.title,
        client: projectClient,
        projectId,
        assigneeId: input.assigneeId,
        boardId: saved.boardId,
        stageId: saved.stageId,
        stageName: saved.stageName,
        stageType: saved.stageType,
        currentDepartment: workflowDepartments[0] ?? null,
        nextDepartment: workflowDepartments[1] ?? null,
        currentResponsibleUserId: input.workflowSteps?.[0]?.responsibleUserId ?? input.assigneeId,
        currentResponsibleName: workflowResponsibleNames[0] ?? dashboardData.team.find((member) => member.id === input.assigneeId)?.name ?? null,
        nextResponsibleUserId: input.workflowSteps?.[1]?.responsibleUserId ?? null,
        nextResponsibleName: workflowResponsibleNames[1] ?? null,
        currentWorkflowPosition: 0,
        workflowDepartments,
        workflowResponsibleNames,
        deadline: formatMissionDeadline(input.deadline),
        dueAt: deadlineToMissionDate(input.deadline),
        xp: input.priority === 'urgent' ? 120 : 80,
        ideas: input.priority === 'urgent' ? 30 : 20,
        tone: input.priority === 'urgent' ? 'orange' : 'purple',
        urgent: input.priority === 'urgent',
        status: 'open',
        approvalStatus: 'not_requested',
        realizedCost: 0,
      }
      setDashboardData((current) => ({ ...current, missions: [...current.missions, mission] }))
    }

    async function attachCreationFiles(missionId: string) {
      if (!input.files?.length) return
      const projectLibrary = await getProjectLibrary(projectId)
      const folderId = projectLibrary.folders.find((folder) => folder.slug === 'outros')?.id ?? projectLibrary.folders[0]?.id
      if (!folderId) throw new Error('Nenhuma pasta está disponível neste projeto.')
      await Promise.all(input.files.map(async (file) => {
        const uploaded = await uploadProjectLibraryFile({ projectId, folderId, file })
        await attachProjectLibraryFile(missionId, uploaded.id)
      }))
    }

    try {
      const saved = await persistMissionCreate({
      title: input.title,
      projectId: input.projectId,
      assigneeId: input.assigneeId,
      dueAt: deadlineToMissionDate(input.deadline),
      expectedMinutes: input.expectedMinutes,
      priority: input.priority,
      description: input.description,
      xpReward: input.priority === 'urgent' ? 120 : 80,
      xpRuleId: input.xpRuleId,
      workTypeId: input.workTypeId,
      workflowDepartments: input.workflowDepartments,
      workflowSteps: input.workflowSteps,
      })
      addMission(saved)
      try {
        await attachCreationFiles(saved.id)
        setCompletionMessage(`${input.title} foi criada, atribuída e os anexos foram enviados.`)
      } catch (error) {
        setCompletionMessage(error instanceof Error ? `${input.title} foi criada, mas os anexos falharam: ${error.message}` : `${input.title} foi criada e atribuída.`)
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível criar a missão.'
      setCompletionMessage(message)
      throw reason instanceof Error ? reason : new Error(message)
    }
  }

  async function toggleMissionTimer(missionId: string) {
    const mission = dashboardData.missions.find((item) => item.id === missionId)
    if (!mission || timerPendingMissionId) return
    setTimerPendingMissionId(missionId)
    try {
      const isActive = dashboardData.activeTimer?.missionId === missionId
      if (isActive) await stopMissionTimer(missionId)
      else await startMissionTimer(missionId)
      const refreshed = await getDashboard()
      setDashboardData(refreshed)
      setCompletionMessage(isActive ? `${mission.title}: cronômetro pausado.` : `${mission.title}: missão iniciada.`)
    } catch (reason) {
      if (reason instanceof TimerConflictError) {
        setPendingTimerSwitch({
          targetMissionId: missionId,
          targetMissionTitle: mission.title,
          activeTimer: reason.activeTimer
        })
      } else {
        setCompletionMessage(reason instanceof Error ? reason.message : 'Não foi possível atualizar o cronômetro.')
      }
    } finally {
      setTimerPendingMissionId(null)
    }
  }

  async function confirmTimerSwitch() {
    if (!pendingTimerSwitch) return
    setTimerPendingMissionId(pendingTimerSwitch.targetMissionId)
    try {
      await stopMissionTimer(pendingTimerSwitch.activeTimer.missionId)
      await startMissionTimer(pendingTimerSwitch.targetMissionId)
      const refreshed = await getDashboard()
      setDashboardData(refreshed)
      setCompletionMessage(`${pendingTimerSwitch.targetMissionTitle}: missão iniciada.`)
    } catch (reason) {
      setCompletionMessage(reason instanceof Error ? reason.message : 'Falha ao trocar o cronômetro.')
    } finally {
      setTimerPendingMissionId(null)
      setPendingTimerSwitch(null)
    }
  }

  function reassignMission(id: string, assigneeId: string) {
    const mission = dashboardData.missions.find((item) => item.id === id)
    const assignee = dashboardData.team.find((member) => member.id === assigneeId)
    if (!mission || !assignee) return
    const missionTitle = mission.title
    const assigneeName = assignee.name

    function applyReassignment() {
      setDashboardData((current) => ({ ...current, missions: current.missions.map((item) => item.id === id ? { ...item, assigneeId } : item) }))
      setCompletionMessage(`${missionTitle} foi atribuída para ${assigneeName}.`)
    }
    void persistMissionUpdate(id, { assigneeId }).then(applyReassignment).catch((reason: unknown) => setCompletionMessage(reason instanceof Error ? reason.message : 'Não foi possível alterar o responsável.'))
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
    function applyUpdate() {
      setDashboardData((current) => ({ ...current, missions: current.missions.map((item) => item.id === id ? { ...item, ...missionUpdate } : item) }))
      setCompletionMessage(`${missionTitle} foi atualizada.`)
    }
    void persistMissionUpdate(id, {
      title: input.title,
      projectId: input.projectId,
      assigneeId: input.assigneeId,
      dueAt: deadlineToMissionDate(input.deadline),
      priority: input.priority,
      description: input.description,
      xpReward: missionUpdate.xp,
    }).then(applyUpdate).catch((reason: unknown) => setCompletionMessage(reason instanceof Error ? reason.message : 'Não foi possível atualizar a missão.'))
  }

  async function createProject(input: {
    name: string
    client: string
    deadline: string
    tone: Project['tone']
    workTypeIds?: string[]
  }) {
    const clientIdentity = clientIdentities.find((item) => item.name === input.client)
    if (!clientIdentity) throw new Error('Cliente não encontrado.')
    const project = await persistProjectCreate({
      name: input.name,
      clientId: clientIdentity.id,
      dueAt: input.deadline,
      tone: input.tone,
      workTypeIds: input.workTypeIds,
    })
    project.deadline = project.dueAt ? formatMissionDeadline(project.dueAt) : 'Próximo marco · em definição'
    setDashboardData((current) => ({ ...current, projects: [...current.projects, project] }))
    setCompletionMessage(`${project.name} foi criado e persistido.`)
    return project
  }

  async function updateProjectLifecycle(id: string, input: { status: string; deadline: string; nextStep: string }) {
    const project = dashboardData.projects.find((item) => item.id === id)
    if (!project) throw new Error('Projeto não encontrado.')

    const saved = await persistProjectUpdate(id, { status: input.status, dueAt: input.deadline, nextStep: input.nextStep })
    const projectUpdate: Partial<Project> = { status: saved.status, deadline: saved.dueAt ? formatMissionDeadline(saved.dueAt) : 'Próximo marco · em definição', dueAt: saved.dueAt, nextStep: saved.nextStep, activity: saved.activity }
    setDashboardData((current) => ({ ...current, projects: current.projects.map((item) => item.id === id ? { ...item, ...projectUpdate } : item) }))
    setCompletionMessage(`${project.name} teve seu ciclo atualizado.`)
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-version-badge">
          <span className="version-pill">{APP_VERSION_LABEL}</span>
        </div>
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
          {(can('users.manage') || can('roles.manage')) && (
            <>
              <p className="nav-caption nav-caption-lower">GESTÃO</p>
              <button className={`nav-item ${activeSection === 'admin' ? 'active' : ''}`} onClick={() => setActiveSection('admin')}>
                <Icon name="people" />
                <span>Administração</span>
              </button>
            </>
          )}
          {(can('evaluations.view') || can('evaluations.respond') || can('evaluations.cycles.manage')) && (
            <>
              <p className="nav-caption nav-caption-lower">PERFORMANCE</p>
              <button className={`nav-item ${activeSection === 'evolution' ? 'active' : ''}`} onClick={() => setActiveSection('evolution')}>
                <Icon name="sparkle" />
                <span>Evolução</span>
              </button>
            </>
          )}
        </nav>

        <button className="ai-prompt" onClick={() => setIsAssistantOpen(true)}>
          <span className="ai-spark"><Icon name="sparkle" size={16} /></span>
          <span><b>SIXIA</b><small>Consulte a operação</small></span>
          <span className="arrow">↗</span>
        </button>

        <div className="account-container" ref={accountMenuRef}>
          {isAccountMenuOpen && (
            <div className="account-popover-menu" role="menu" aria-label="Menu do usuário">
              <div className="account-popover-identity">
                <span className="account-popover-avatar">
                  <Avatar initials={getInitials(accessSession.name)} tone="dark" />
                  <i aria-label="Online" />
                </span>
                <span><b>{accessSession.name}</b><small>{(can('users.manage') || can('roles.manage')) ? 'Administrador' : 'Equipe SIX'}</small></span>
              </div>
              <div className="menu-divider" />
              <button type="button" role="menuitem" onClick={() => { setIsAccountMenuOpen(false); setActiveSection('profile') }}>
                <span className="account-popover-icon"><Icon name="profile" /></span>
                <span className="account-popover-copy"><b>Meu perfil</b><small>Dados e preferências</small></span>
              </button>
              <button type="button" role="menuitem" onClick={() => { setIsAccountMenuOpen(false); setActiveModal('change-password') }}>
                <span className="account-popover-icon"><Icon name="key" /></span>
                <span className="account-popover-copy"><b>Alterar senha</b><small>Segurança da conta</small></span>
              </button>
              <button type="button" role="menuitem" onClick={() => { setIsAccountMenuOpen(false); setActiveModal('help') }}>
                <span className="account-popover-icon"><Icon name="help" /></span>
                <span className="account-popover-copy"><b>Ajuda e suporte</b><small>Central de atendimento</small></span>
              </button>
              <div className="menu-divider" />
              <button className="danger" type="button" role="menuitem" onClick={() => { setIsAccountMenuOpen(false); void handleLogout() }}>
                <span className="account-popover-icon"><Icon name="logout" /></span>
                <span className="account-popover-copy"><b>Sair</b><small>Encerrar esta sessão</small></span>
              </button>
            </div>
          )}
          <button className={`account ${isAccountMenuOpen ? 'open' : ''}`} type="button" aria-haspopup="menu" aria-expanded={isAccountMenuOpen} onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}>
            <Avatar initials={accessSession ? getInitials(accessSession.name) : 'GS'} tone="photo" small />
            <span><b>{accessSession?.name ?? ''}</b><small>{(can('users.manage') || can('roles.manage')) ? 'Administrador' : 'Equipe SIX'}</small></span>
            <span>•••</span>
          </button>
        </div>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <div className="crumb">
            <span>{new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date())}</span>
            <i />
            <strong>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(new Date())}</strong>
          </div>
          <div className="topbar-actions">
            {dashboardData.activeTimer && (
              <button className="active-mission-timer" type="button" onClick={() => setActiveSection('missions')}>
                <span>● MISSÃO ATIVA</span>
                <b>{dashboardData.activeTimer.missionTitle}</b>
                <strong><MissionTimerValue startedAt={dashboardData.activeTimer.startedAt} /></strong>
              </button>
            )}
            <button className="icon-button" onClick={() => setIsCommandOpen(true)} aria-label="Pesquisar">⌘ K</button>
            <button className="round-button" onClick={() => setIsNotificationsOpen(true)} aria-label="Notificações">⌁{unreadNotificationCount > 0 && <span />}</button>
            <button className="date-chip" onClick={() => setActiveSection('agenda')} aria-label="Abrir agenda completa">Hoje <span>⌄</span></button>
          </div>
        </header>

        {activeSection === 'home' ? (
          <Dashboard
            userName={accessSession.name}
            profileLevel={dashboardData.profile.level}
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
            workTypes={dashboardData.workTypes}
            departments={dashboardData.departments}
            accessSession={accessSession}
            onReassignMission={reassignMission}
            onUpdateMission={updateMission}
            onDeleteMission={requestDeleteMission}
            onReturnMission={returnMission}
            onToggleTimer={toggleMissionTimer}
            timerPendingMissionId={timerPendingMissionId}
            initialSelectedMissionId={notificationMissionId}
          />
        ) : activeSection === 'projects' ? (
          <ProjectsPage
            projects={projectsWithMissionProgress}
            clients={clientIdentities}
            workTypes={dashboardData.workTypes}
            departments={dashboardData.departments}
            initialSelectedProjectId={libraryProjectId}
            missions={dashboardData.missions}
            completed={completedMissionIds}
            team={dashboardData.team}
            onCreateProject={createProject}
            onCreateMission={createMission}
            onUpdateProjectLifecycle={updateProjectLifecycle}
            onDeleteProject={requestDeleteProject}
          />
        ) : activeSection === 'agenda' ? (
          <AgendaPage
            events={dashboardData.agenda}
            missions={dashboardData.missions}
            projects={projectsWithMissionProgress}
            team={dashboardData.team}
            completed={completedMissionIds}
            accessSession={accessSession}
            onOpenMission={(missionId) => {
              setNotificationMissionId(missionId)
              setActiveSection('missions')
            }}
          />
        ) : activeSection === 'team' ? (
          <TeamPage
            members={dashboardData.team}
            missions={dashboardData.missions}
            projects={projectsWithMissionProgress}
            completed={completedMissionIds}
          />
        ) : activeSection === 'analytics' ? (
          <AnalyticsPage
            analytics={dashboardData.analytics}
            projects={projectsWithMissionProgress}
            missions={dashboardData.missions}
            team={dashboardData.team}
            completed={completedMissionIds}
            totalXp={totalXp}
            baseXp={dashboardData.profile.xp}
          />
        ) : activeSection === 'profile' ? (
          <ProfilePage accessSession={accessSession} onLogoutSuccess={() => setAccessSession(null)} />
        ) : activeSection === 'feed' ? (
          <FeedPage team={dashboardData.team} />
        ) : activeSection === 'library' ? (
          <LibraryPage
            resources={dashboardData.library}
            clients={clientIdentities}
            projects={projectsWithMissionProgress}
            onOpenProject={(projectId) => {
              setLibraryProjectId(projectId)
              setActiveSection('projects')
            }}
          />
        ) : activeSection === 'admin' && (can('users.manage') || can('roles.manage')) ? (
          <AdminPage onClientCreated={(client) => setClientIdentities((current) => [...current.filter((item) => item.id !== client.id), client])} />
        ) : activeSection === 'evolution' && (can('evaluations.view') || can('evaluations.respond') || can('evaluations.cycles.manage')) ? (
          <EvolutionPage user={accessSession} />
        ) : (
          <ComingSoon title={sectionLabels[activeSection] || 'Evolução'} onBack={() => setActiveSection('home')} />
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

      {isAssistantOpen && (
        <OperationalAssistantPanel
          dashboardData={dashboardData}
          completed={completedMissionIds}
          onClose={() => setIsAssistantOpen(false)}
          onNavigate={(section) => {
            setActiveSection(section)
            setIsAssistantOpen(false)
          }}
        />
      )}
      {isCommandOpen && (
        <CommandPalette
          projects={dashboardData.projects}
          missions={dashboardData.missions}
          team={dashboardData.team}
          clients={clientIdentities}
          onClose={() => setIsCommandOpen(false)}
          onNavigate={(section) => {
            setActiveSection(section)
            setIsCommandOpen(false)
          }}
          onOpenAssistant={() => {
            setIsAssistantOpen(true)
            setIsCommandOpen(false)
          }}
        />
      )}
      {isNotificationsOpen && (
        <NotificationsPanel
          notifications={operationalNotifications}
          activities={recentActivities}
          readNotificationIds={readNotificationIds}
          onClose={() => setIsNotificationsOpen(false)}
          onMarkAllRead={markAllNotificationsRead}
          onOpenNotification={openNotification}
        />
      )}
      {isJourneyOpen && (
        <JourneyPanel
          profile={dashboardData.profile}
          completedCount={completedMissionIds.length}
          missionCount={dashboardData.missions.length}
          totalXp={totalXp}
          onClose={() => setIsJourneyOpen(false)}
        />
      )}
      {completionMessage && (
        <div className="completion-toast" role="status">
          <span>✦</span>
          {completionMessage}
          <button onClick={() => setCompletionMessage('')} aria-label="Fechar aviso">×</button>
        </div>
      )}
      {activeModal === 'change-password' && <ChangePasswordModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'help' && <HelpModal onClose={() => setActiveModal(null)} />}
      {pendingTimerSwitch && (
        <ConfirmActionModal
          badgeLabel="TROCAR CRONÔMETRO"
          title="Trocar Missão Ativa?"
          message={`Você já está trabalhando na missão “${pendingTimerSwitch.activeTimer.missionTitle}”. Deseja pausar essa missão e iniciar “${pendingTimerSwitch.targetMissionTitle}”?`}
          confirmLabel={timerPendingMissionId === pendingTimerSwitch.targetMissionId ? 'TROCANDO…' : 'PAUSAR E INICIAR NOVA'}
          cancelLabel="CANCELAR"
          isDestructive={false}
          onConfirm={() => void confirmTimerSwitch()}
          onCancel={() => setPendingTimerSwitch(null)}
        />
      )}
      {pendingDeleteMission && (
        <ConfirmActionModal
          badgeLabel="AÇÃO DESTRUTIVA"
          title="Excluir Missão?"
          message={`Você está prestes a excluir “${pendingDeleteMission.title}”. A missão será cancelada e permanecerá no histórico de auditoria. Essa ação não poderá ser desfeita.`}
          confirmLabel="EXCLUIR MISSÃO"
          cancelLabel="CANCELAR"
          isDestructive={true}
          onConfirm={confirmDeleteMission}
          onCancel={() => setPendingDeleteMission(null)}
        />
      )}
      {pendingDeleteProject && (
        <ConfirmActionModal
          badgeLabel="AÇÃO DESTRUTIVA"
          title="Excluir Projeto?"
          message={`Você está prestes a excluir “${pendingDeleteProject.name}”. Essa ação não poderá ser desfeita.`}
          confirmLabel="EXCLUIR PROJETO"
          cancelLabel="CANCELAR"
          isDestructive={true}
          onConfirm={() => void confirmDeleteProject()}
          onCancel={() => setPendingDeleteProject(null)}
        />
      )}
    </main>
  )
}
