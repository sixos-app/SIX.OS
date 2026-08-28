import { useEffect, useState } from 'react'
import type { AgendaEvent, Mission, Project, TeamMember } from '../../data/dashboard'
import { AgendaItem } from '../agenda/AgendaItem'
import { ProjectCard } from '../projects/ProjectCard'
import { Avatar } from '../shared/Avatar'
import { MissionDetailsModal } from '../missions/MissionDetailsModal'
import { getLevelProgress } from '../../../shared/gamificationLevels'
import { LevelBadge } from '../gamification/LevelBadge'

export function Dashboard({
  userName,
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
  onMissionUpdated,
  onToggleTimer,
  timerPendingMissionId,
  canDeleteMission,
  onDeleteMission,
}: {
  userName: string
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
  onMissionUpdated?: () => void
  onToggleTimer: (id: string) => Promise<void>
  timerPendingMissionId: string | null
  canDeleteMission?: boolean
  onDeleteMission?: (id: string) => void
}) {
  const [feedItems, setFeedItems] = useState<any[]>([])
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedMissionId, setSelectedMissionId] = useState<string>('')
  const openMissionCount = projectMissions.filter((mission) => mission.status !== 'completed').length
  const completionRate = projectMissions.length ? Math.round(((projectMissions.length - openMissionCount) / projectMissions.length) * 100) : 0
  const levelProgress = getLevelProgress(totalXp)
  const { currentLevel, nextLevel, progressPercent, xpRemaining } = levelProgress

  const selectedMission = visibleMissions.find((mission) => mission.id === selectedMissionId) || projectMissions.find((mission) => mission.id === selectedMissionId)

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
          <p className="eyebrow">BOM DIA, {userName.split(/\s+/)[0].toLocaleUpperCase('pt-BR')} <span>✦</span></p>
          <h1>Hoje é um bom dia<br />para <em>tornar possível.</em></h1>
        </div>
        <div className="energy-widget">
          <span className="energy-label">MISSÕES EM ABERTO</span>
          <span className="energy-value">{openMissionCount}</span>
          <div className="energy-track"><i style={{ width: `${completionRate}%` }} /></div>
          <small>{completionRate}% das missões concluídas.</small>
        </div>
      </section>

      <section className="momentum-card">
        <div className="momentum-copy">
          <p>SEU PROGRESSO</p>
          <h2>Você acumulou <span>{totalXp.toLocaleString('pt-BR')} XP</span><br />no nível <em>{currentLevel.name}.</em></h2>
          <button onClick={onOpenJourney}>VER MINHA JORNADA <span>→</span></button>
        </div>
        <div className="momentum-art" aria-hidden="true">
          <span className="orbit orbit-one" /><span className="orbit orbit-two" />
          <div className="momentum-badge"><LevelBadge level={currentLevel} size="xl" decorative loading="eager" /></div>
          <p>GO MAKE<br />IT POSSIBLE</p>
        </div>
        <div className="xp-meter">
          <span>
            <b>{totalXp.toLocaleString('pt-BR')}</b> XP REGISTRADOS
            <small>{nextLevel ? `${xpRemaining.toLocaleString('pt-BR')} XP para ${nextLevel.name}` : 'NÍVEL MÁXIMO ALCANÇADO'}</small>
          </span>
          <div role="progressbar" aria-label={`Progresso no nível ${currentLevel.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)}>
            <i style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
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
                <article 
                  className={`mission-card tone-${mission.tone} ${isComplete ? 'completed' : ''}`} 
                  key={mission.id}
                  onClick={() => { setSelectedMissionId(mission.id); setIsDetailsOpen(true) }}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="mission-number">0{index + 1}</span>
                  <div className="mission-info">
                    <p>{mission.client}</p>
                    <h3>{mission.title}</h3>
                    <span className="deadline">{mission.deadline}</span>
                    {isAwaitingApproval && <span className="mission-approval-status">EM APROVAÇÃO</span>}
                  </div>
                  <div className="mission-reward">
                    <span>RECOMPENSA</span>
                    <b>+{mission.xp} XP</b>
                    <small>+{mission.ideas} ideias</small>
                  </div>
                  <button 
                    className="complete-button" 
                    disabled={isComplete || isAwaitingApproval} 
                    onClick={(e) => { e.stopPropagation(); onComplete(mission.id); }}
                  >
                    {isComplete ? 'Feita!' : isAwaitingApproval ? 'Em aprovação' : 'Concluir'} <span>{isComplete ? '✓' : '→'}</span>
                  </button>
                </article>
              )
            })}
            {visibleMissions.length === 0 && <p className="empty-state">Nenhuma missão nessa visão. Seu fluxo está em dia.</p>}
          </div>
          <button className="view-all" onClick={onViewMissions}>VER TODAS AS MISSÕES <span>→</span></button>

          <div className="section-heading projects-heading">
            <div><p className="section-index">02</p><h2>Projetos em órbita</h2></div>
            <button className="text-action" onClick={onViewProjects}>EXPLORAR PROJETOS <span>↗</span></button>
          </div>
          <div className="project-grid">
            {projects.slice(0, 2).map((project) => (
              <ProjectCard project={project} missions={projectMissions} team={team} onOpen={onViewProjects} key={project.id} />
            ))}
          </div>
        </div>

        <aside className="right-column">
          <div className="section-heading compact">
            <div><p className="section-index">03</p><h2>Sua agenda</h2></div>
            <button className="text-action" onClick={onViewAgenda}>VER TUDO</button>
          </div>
          <div className="agenda-card">
            <div className="calendar-head">
              <b>{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())}</b>
            </div>
            <div className="week-days"><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span><span>D</span></div>
            <div className="calendar-days"><span className="today">{new Date().getDate()}</span></div>
            <div className="agenda-line" />
            {agenda.filter((event) => event.day === 'Hoje').slice(0, 3).map((event) => (
              <AgendaItem event={event} key={event.id} />
            ))}
          </div>

          <div className="section-heading compact feed-heading">
            <div><p className="section-index">04</p><h2>Acontecendo agora</h2></div>
          </div>
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

      {isDetailsOpen && selectedMission && (
        <MissionDetailsModal
          mission={selectedMission}
          team={team}
          onClose={() => setIsDetailsOpen(false)}
          onMissionUpdated={onMissionUpdated}
          onTimerToggle={onToggleTimer}
          isTimerPending={timerPendingMissionId === selectedMission.id}
          canDelete={canDeleteMission}
          onDelete={() => { setIsDetailsOpen(false); if (onDeleteMission) onDeleteMission(selectedMission.id) }}
        />
      )}
    </div>
  )
}
