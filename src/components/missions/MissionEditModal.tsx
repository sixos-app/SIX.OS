import { useEffect, useState } from 'react'
import type { Mission, Project, TeamMember } from '../../data/dashboard'
import { missionDateTimeInputValue } from '../../utils/formatters'
import { DateTimePicker } from '../shared/DateTimePicker'
import { Icon } from '../shared/Icon'

export function MissionEditModal({ mission, projects, team, onClose, onUpdate }: { mission: Mission; projects: Project[]; team: TeamMember[]; onClose: () => void; onUpdate: (input: { title: string; projectId: string; assigneeId: string; deadline: string; priority: 'normal' | 'urgent' }) => void }) {
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

  return (
    <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Editar missão">
      <form
        className="mission-create-dialog mission-edit-dialog"
        onSubmit={(event) => {
          event.preventDefault()
          if (title.trim() && projectId && assigneeId && deadline.trim()) {
            onUpdate({ title: title.trim(), projectId, assigneeId, deadline, priority })
          }
        }}
      >
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar edição de missão">×</button>
        <span className="mission-create-icon"><Icon name="target" size={21} /></span>
        <p>EDITAR MISSÃO</p>
        <h2>Ajuste o próximo<br /><em>movimento.</em></h2>
        <label>
          <span>TÍTULO</span>
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <div className="mission-create-row">
          <label>
            <span>PROJETO</span>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
              {projects.map((project) => (
                <option value={project.id} key={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>RESPONSÁVEL</span>
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} required>
              {team.map((member) => (
                <option value={member.id} key={member.id}>{member.name} · {member.role}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mission-create-row">
          <label>
            <span>PRAZO</span>
            <DateTimePicker value={deadline} onChange={setDeadline} />
          </label>
          <label>
            <span>PRIORIDADE</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as 'normal' | 'urgent')}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
        </div>
        <button className="mission-create-submit" type="submit">SALVAR ALTERAÇÕES <span>→</span></button>
      </form>
    </div>
  )
}
