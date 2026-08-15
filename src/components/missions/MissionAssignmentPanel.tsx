import { useEffect, useState } from 'react'
import type { Mission, Project, TeamMember } from '../../data/dashboard'
import { Avatar } from '../shared/Avatar'

export function MissionAssignmentPanel({ mission, project, assignee, team, canManage, canDelete, canManageWorkflow, isComplete, onDetails, onEdit, onReassign, onDelete, onReturn }: { mission: Mission; project?: Project; assignee?: TeamMember; team: TeamMember[]; canManage: boolean; canDelete: boolean; canManageWorkflow: boolean; isComplete: boolean; onDetails: () => void; onEdit: () => void; onReassign: (id: string, assigneeId: string) => void; onDelete: (id: string) => void; onReturn: (id: string, targetPosition: number) => void }) {
  const [assigneeId, setAssigneeId] = useState(mission.assigneeId ?? team[0]?.id ?? '')

  useEffect(() => {
    setAssigneeId(mission.assigneeId ?? team[0]?.id ?? '')
  }, [mission.assigneeId, mission.id, team])

  const priorSteps = (mission.workflowDepartments ?? []).slice(0, mission.currentWorkflowPosition ?? 0)
  return (
    <aside className="mission-assignment-panel">
      <div className="mission-assignment-head">
        <span>GESTÃO DA MISSÃO</span>
        <b>{isComplete ? 'FEITA' : mission.approvalStatus === 'pending' ? 'EM APROVAÇÃO' : 'EM ABERTO'}</b>
      </div>
      <h2>{mission.title}</h2>
      <p>{project?.name ?? mission.client} · {mission.deadline}</p>
      {mission.workflowDepartments?.length ? (
        <div className="mission-sector-route">
          {mission.workflowDepartments.map((department, index) => (
            <span className={index < (mission.currentWorkflowPosition ?? 0) ? 'done' : index === (mission.currentWorkflowPosition ?? 0) ? 'active' : ''} key={`${department}-${index}`}>
              <i>{index + 1}</i>
              <b>{department}</b>
              <small>{mission.workflowResponsibleNames?.[index] ?? 'Responsável a definir'}</small>
            </span>
          ))}
        </div>
      ) : null}
      <div className="mission-assignment-owner">
        <Avatar initials={assignee?.initials ?? '?'} tone={assignee?.tone ?? 'dark'} small />
        <span>
          <small>XP PARA O FLUXO</small>
          <b>Cada participante recebe +{mission.xp} XP</b>
        </span>
      </div>
      {canManage && (
        <>
          <form onSubmit={(event) => { event.preventDefault(); if (assigneeId) onReassign(mission.id, assigneeId) }}>
            <label>
              <span>RESPONSÁVEL OPERACIONAL</span>
              <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>{member.name} · {member.role}</option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={!assigneeId || assigneeId === mission.assigneeId}>
              SALVAR RESPONSÁVEL <span>→</span>
            </button>
          </form>
          <button className="mission-edit-button" type="button" onClick={onEdit}>
            EDITAR MISSÃO <span>↗</span>
          </button>
        </>
      )}
      {canManageWorkflow && priorSteps.length > 0 && (
        <div className="mission-return-actions">
          <span>DEVOLVER PARA</span>
          {priorSteps.map((department, index) => (
            <button type="button" onClick={() => onReturn(mission.id, index)} key={`${department}-${index}`}>
              {department} ↩
            </button>
          ))}
        </div>
      )}
      <button className="mission-details-button" type="button" onClick={onDetails}>
        DETALHES COMPLETOS <span>→</span>
      </button>
      {canDelete && !isComplete && (
        <button className="mission-delete-button" type="button" onClick={() => onDelete(mission.id)}>
          EXCLUIR MISSÃO
        </button>
      )}
    </aside>
  )
}
