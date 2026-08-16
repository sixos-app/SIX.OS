import { useState } from 'react'
import type { AccessSession } from '../../data/accessRepository'
import type { Mission, Project, TeamMember } from '../../data/dashboard'
import type { WorkType } from '../../data/workTypeRepository'
import { usePermission } from '../../hooks/usePermission'
import { MissionAssignmentPanel } from './MissionAssignmentPanel'
import { MissionCard } from './MissionCard'
import { MissionCreateModal, type MissionCreationInput } from './MissionCreateModal'
import { MissionDetailsModal } from './MissionDetailsModal'
import { MissionEditModal } from './MissionEditModal'

export function MissionsPage({
  missions,
  completed,
  totalXp,
  baseXp,
  onCreateMission,
  projects,
  team,
  workTypes,
  accessSession,
  onReassignMission,
  onUpdateMission,
  onDeleteMission,
  onReturnMission,
  onToggleTimer,
  timerPendingMissionId,
}: {
  missions: Mission[]
  completed: string[]
  onComplete: (id: string) => void
  totalXp: number
  baseXp: number
  onCreateMission: (input: MissionCreationInput) => void
  projects: Project[]
  team: TeamMember[]
  workTypes?: WorkType[]
  accessSession: AccessSession | null
  onReassignMission: (id: string, assigneeId: string) => void
  onUpdateMission: (id: string, input: { title: string; projectId: string; assigneeId: string; deadline: string; priority: 'normal' | 'urgent' }) => void
  onDeleteMission: (id: string) => void
  onReturnMission: (id: string, targetPosition: number) => void
  onToggleTimer: (id: string) => Promise<void>
  timerPendingMissionId: string
}) {
  const { can, hasScope } = usePermission()
  const canManage = can('missions.assign')
  const canDelete = can('missions.delete')
  const canManageWorkflow = can('missions.workflow.manage')
  const canTrackTime = can('time_entries.create')
  const [missionFilter, setMissionFilter] = useState<'today' | 'priority' | 'next' | 'review' | 'completed'>('next')
  const [projectFilter, setProjectFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedMissionId, setSelectedMissionId] = useState(missions[0]?.id ?? '')

  const visibleMissions = missions.filter((mission) => {
    const isComplete = completed.includes(mission.id) || mission.stageType === 'done'
    const dueDate = mission.dueAt ? new Date(mission.dueAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : ''
    const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const matchesStatus = missionFilter === 'completed'
      ? isComplete
      : !isComplete && (
        missionFilter === 'next'
        || (missionFilter === 'today' && dueDate === today)
        || (missionFilter === 'priority' && mission.urgent)
        || (missionFilter === 'review' && (mission.stageType === 'review' || mission.stageType === 'approval' || mission.approvalStatus === 'pending'))
      )
    const matchesProject = projectFilter === 'all' || mission.projectId === projectFilter
    const matchesAssignee = assigneeFilter === 'all' || mission.assigneeId === assigneeFilter
    return matchesStatus && matchesProject && matchesAssignee
  })

  const xpEarned = Math.max(0, totalXp - baseXp)
  const completionRate = missions.length > 0 ? Math.round((completed.length / missions.length) * 100) : 0
  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) ?? missions[0]

  const canCompleteThisMission = (mission: Mission) => {
    return hasScope('missions.complete', 'all') || hasScope('missions.approve', 'all') ||
           ((hasScope('missions.complete', 'own') || can('missions.update_own')) && mission.assigneeId === accessSession?.id)
  }

  return (
    <section className="missions-page">
      <div className="missions-intro">
        <div>
          <p className="eyebrow">CENTRAL DE EXECUÇÃO <span>✦</span></p>
          <h1>Suas missões,<br /><em>em movimento.</em></h1>
        </div>
        <div className="missions-intro-actions">
          {canManage && (
            <button className="create-mission-button" onClick={() => setIsCreateOpen(true)}>
              NOVA MISSÃO <span>+</span>
            </button>
          )}
          <div className="mission-score">
            <span>XP CONQUISTADOS</span>
            <b>+{xpEarned.toLocaleString('pt-BR')}</b>
            <small>{completed.length} de {missions.length} missões concluídas</small>
          </div>
        </div>
      </div>

      <div className="missions-toolbar">
        <div className="missions-filter-controls">
          <div className="segmented-control" aria-label="Filtrar missões">
            <button className={missionFilter === 'today' ? 'selected' : ''} onClick={() => setMissionFilter('today')}>Hoje</button>
            <button className={missionFilter === 'priority' ? 'selected' : ''} onClick={() => setMissionFilter('priority')}>Prioridade</button>
            <button className={missionFilter === 'next' ? 'selected' : ''} onClick={() => setMissionFilter('next')}>Próximas</button>
            <button className={missionFilter === 'review' ? 'selected' : ''} onClick={() => setMissionFilter('review')}>Em revisão</button>
            <button className={missionFilter === 'completed' ? 'selected' : ''} onClick={() => setMissionFilter('completed')}>Concluídas</button>
          </div>
          <label>
            <span>PROJETO</span>
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} aria-label="Filtrar por projeto">
              <option value="all">Todos os projetos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>RESPONSÁVEL</span>
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} aria-label="Filtrar por responsável">
              <option value="all">Todo o time</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>
        </div>
        <span>{visibleMissions.length} miss{visibleMissions.length === 1 ? 'ão' : 'ões'}</span>
      </div>

      <div className="missions-grid">
        <div className="missions-list">
          {visibleMissions.map((mission, index) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              index={index}
              isComplete={completed.includes(mission.id)}
              isSelected={mission.id === selectedMission?.id}
              canTrackTime={canTrackTime && (mission.canAdvanceWorkflow || canCompleteThisMission(mission) || canManageWorkflow)}
              isTimerPending={timerPendingMissionId === mission.id}
              assignee={team.find((member) => member.id === mission.assigneeId)}
              onManage={(missionId) => setSelectedMissionId(missionId)}
              onOpenDetails={(missionId) => { setSelectedMissionId(missionId); setIsDetailsOpen(true) }}
              onToggleTimer={onToggleTimer}
            />
          ))}
          {visibleMissions.length === 0 && <p className="empty-state">Nenhuma missão nessa visão. Continue criando possibilidades.</p>}
        </div>
        <div className="mission-side-panel">
          <aside className="mission-insight">
            <span>RITMO DA SEMANA</span>
            <b>{completionRate}%</b>
            <p>Você já acumulou <strong>{xpEarned} XP</strong> nesta jornada. O próximo passo começa agora.</p>
            <div><i style={{ width: `${completionRate}%` }} /></div>
          </aside>
          {selectedMission && (
            <MissionAssignmentPanel
              mission={selectedMission}
              project={projects.find((project) => project.id === selectedMission.projectId)}
              assignee={team.find((member) => member.id === selectedMission.assigneeId)}
              team={team}
              canManage={canManage}
              canDelete={canDelete}
              canManageWorkflow={Boolean(selectedMission.canReturnWorkflow)}
              isComplete={completed.includes(selectedMission.id)}
              onDetails={() => setIsDetailsOpen(true)}
              onEdit={() => setIsEditOpen(true)}
              onReassign={onReassignMission}
              onDelete={onDeleteMission}
              onReturn={onReturnMission}
            />
          )}
        </div>
      </div>
      {isCreateOpen && (
        <MissionCreateModal
          projects={projects}
          team={team}
          workTypes={workTypes}
          onClose={() => setIsCreateOpen(false)}
          onCreate={(input) => { onCreateMission(input); setIsCreateOpen(false) }}
        />
      )}
      {isEditOpen && selectedMission && (
        <MissionEditModal
          mission={selectedMission}
          projects={projects}
          team={team}
          onClose={() => setIsEditOpen(false)}
          onUpdate={(input) => { onUpdateMission(selectedMission.id, input); setIsEditOpen(false) }}
        />
      )}
      {isDetailsOpen && selectedMission && (
        <MissionDetailsModal
          mission={selectedMission}
          onClose={() => setIsDetailsOpen(false)}
          onTimerToggle={onToggleTimer}
          isTimerPending={timerPendingMissionId === selectedMission.id}
        />
      )}
    </section>
  )
}
