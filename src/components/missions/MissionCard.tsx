import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Mission, TeamMember } from '../../data/dashboard'
import { MissionTimerValue } from '../shared/MissionTimerValue'

export function MissionCard({ mission, index, isComplete, isSelected = false, canTrackTime, isTimerPending, assignee, onManage, onOpenDetails, onToggleTimer }: { mission: Mission; index: number; isComplete: boolean; isSelected?: boolean; canTrackTime: boolean; isTimerPending: boolean; assignee?: TeamMember; onManage?: (id: string) => void; onOpenDetails?: (id: string) => void; onToggleTimer: (id: string) => Promise<void> }) {
  const activeTimer = mission.activeTimerStartedAt
  const stageType = isComplete ? 'done' : mission.stageType ?? (mission.status === 'in_progress' ? 'doing' : 'ready')
  const isExecutionStage = stageType === 'backlog' || stageType === 'ready' || stageType === 'doing'
  const actionLabel = isTimerPending ? 'AGUARDE…' : activeTimer ? 'PAUSAR' : stageType === 'doing' ? 'CONTINUAR' : stageType === 'review' ? 'VER REVISÃO' : stageType === 'approval' ? 'ABRIR' : stageType === 'done' ? 'VER DETALHES' : 'INICIAR'
  const handleAction = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (isExecutionStage && canTrackTime) void onToggleTimer(mission.id)
    else onOpenDetails?.(mission.id)
  }
  return (
    <article className={`mission-card tone-${mission.tone} ${isComplete ? 'completed' : ''} ${isSelected ? 'selected' : ''} ${onOpenDetails ? 'interactive' : ''}`} role={onOpenDetails ? 'button' : undefined} tabIndex={onOpenDetails ? 0 : undefined} onClick={() => onOpenDetails?.(mission.id)} onKeyDown={(event) => { if (onOpenDetails && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpenDetails(mission.id) } }}>
      <span className="mission-number">{String(index + 1).padStart(2, '0')}</span>
      <div className="mission-info">
        <p>{mission.client}</p>
        <h3>{mission.title}</h3>
        <span className="deadline">{mission.deadline}</span>
        {mission.stageName && <span className={`mission-stage-badge stage-${mission.stageType ?? 'ready'}`}>{mission.stageName}</span>}
        {mission.approvalStatus === 'pending' && <span className="mission-approval-status">EM APROVAÇÃO</span>}
        {mission.currentDepartment && <div className="mission-workflow-status"><span>AGORA <b>{mission.currentDepartment}</b><small>{mission.currentResponsibleName ?? 'Responsável a definir'}</small></span><i>→</i><span>PRÓXIMO <b>{mission.nextDepartment ?? 'Decisão final'}</b><small>{mission.nextResponsibleName ?? (mission.nextDepartment ? 'Responsável a definir' : 'Conclusão do fluxo')}</small></span></div>}
        <span className="mission-assignee">XP: cada colaborador que concluir sua etapa</span>
        {onManage && <button className="mission-manage-button" onClick={(event) => { event.stopPropagation(); onManage(mission.id) }}>GERENCIAR <span>→</span></button>}
      </div>
      <div className="mission-reward"><span>POR PARTICIPANTE</span><b>+{mission.xp} XP</b><small>liberado na conclusão final</small></div>
      <button className={`complete-button mission-context-action ${activeTimer ? 'timer-active' : ''}`} disabled={isTimerPending} onClick={handleAction}>{activeTimer ? <><MissionTimerValue startedAt={activeTimer} /> <span>Ⅱ</span></> : <>{actionLabel} <span>{stageType === 'done' ? '↗' : '→'}</span></>}</button>
    </article>
  )
}
