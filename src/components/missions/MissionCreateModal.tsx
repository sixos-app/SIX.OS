import { useEffect, useState } from 'react'
import type { Project, TeamMember } from '../../data/dashboard'
import { missionDateTimeInputValue } from '../../utils/formatters'
import { DateTimePicker } from '../shared/DateTimePicker'
import { Icon } from '../shared/Icon'

export type MissionCreationInput = {
  title: string
  projectId: string
  assigneeId: string
  deadline: string
  priority: 'normal' | 'urgent'
  description?: string
  files?: File[]
  xpRuleId?: string
  workflowDepartments?: string[]
  workflowSteps?: Array<{ departmentName: string; responsibleUserId: string }>
}

export function MissionCreateModal({ projects, team, initialProjectId, onClose, onCreate }: { projects: Project[]; team: TeamMember[]; initialProjectId?: string; onClose: () => void; onCreate: (input: MissionCreationInput) => void }) {
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? '')
  const [assigneeId, setAssigneeId] = useState(team[0]?.id ?? '')
  const [deadline, setDeadline] = useState(() => missionDateTimeInputValue('Hoje · 17h'))
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [xpRules, setXpRules] = useState<Array<{ id: string; name: string; baseXp: number; onTimeBonusPercent: number }>>([])
  const [xpRuleId, setXpRuleId] = useState('')
  const [productionDepartment, setProductionDepartment] = useState<'Criação' | 'Audiovisual'>('Criação')
  const [finalDepartment, setFinalDepartment] = useState<'Atendimento' | 'Planejamento'>('Planejamento')
  const [productionResponsibleId, setProductionResponsibleId] = useState(team[0]?.id ?? '')
  const [finalResponsibleId, setFinalResponsibleId] = useState(team[0]?.id ?? '')

  const peopleForDepartment = (department: string) => {
    const matching = team.filter((member) => member.department === department)
    return matching.length ? matching : team
  }
  const productionPeople = peopleForDepartment(productionDepartment)
  const finalPeople = peopleForDepartment(finalDepartment)

  useEffect(() => {
    void fetch('/api/gamification/rules')
      .then((response) => response.ok ? response.json() : { rules: [] })
      .then((data: { rules?: Array<{ id: string; name: string; baseXp: number; onTimeBonusPercent: number }> }) => setXpRules(data.rules ?? []))
      .catch(() => undefined)
    function handleEscape(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  useEffect(() => {
    if (!productionPeople.some((member) => member.id === productionResponsibleId)) setProductionResponsibleId(productionPeople[0]?.id ?? '')
  }, [productionDepartment, productionPeople, productionResponsibleId])

  useEffect(() => {
    if (!finalPeople.some((member) => member.id === finalResponsibleId)) setFinalResponsibleId(finalPeople[0]?.id ?? '')
  }, [finalDepartment, finalPeople, finalResponsibleId])

  return (
    <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Criar missão">
      <form
        className="mission-create-dialog mission-create-dialog-expanded"
        onSubmit={(event) => {
          event.preventDefault()
          if (title.trim() && projectId && assigneeId && productionResponsibleId && finalResponsibleId && deadline.trim()) {
            onCreate({
              title: title.trim(),
              projectId,
              assigneeId,
              deadline,
              priority,
              description: description.trim(),
              files,
              xpRuleId: xpRuleId || undefined,
              workflowSteps: [
                { departmentName: 'Redação', responsibleUserId: assigneeId },
                { departmentName: productionDepartment, responsibleUserId: productionResponsibleId },
                { departmentName: finalDepartment, responsibleUserId: finalResponsibleId },
              ],
            })
          }
        }}
      >
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar criação de missão">×</button>
        <span className="mission-create-icon"><Icon name="target" size={21} /></span>
        <p>NOVA MISSÃO</p>
        <h2>Qual ideia vamos<br /><em>tornar possível?</em></h2>
        <label>
          <span>TÍTULO</span>
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Desdobramentos de campanha" required />
        </label>
        <label>
          <span>DESCRIÇÃO, LINKS E CONTEXTO</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Escreva o briefing da missão e cole links de referências." maxLength={4000} />
        </label>
        <label className="mission-create-files">
          <span>IMAGENS E VÍDEOS (OPCIONAL)</span>
          <input type="file" accept="image/*,video/*" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
          <small>{files.length ? `${files.length} arquivo${files.length === 1 ? '' : 's'} selecionado${files.length === 1 ? '' : 's'}.` : 'Envie imagens ou vídeos junto da missão.'}</small>
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
            <span>RESPONSÁVEL · REDAÇÃO</span>
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} required>
              {peopleForDepartment('Redação').map((member) => (
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
        <div className="mission-workflow-builder">
          <span>FLUXO ENTRE SETORES</span>
          <div>
            <b>1 · Redação</b>
            <i>→</i>
            <label>
              <select aria-label="Setor de produção" value={productionDepartment} onChange={(event) => setProductionDepartment(event.target.value as 'Criação' | 'Audiovisual')}>
                <option>Criação</option>
                <option>Audiovisual</option>
              </select>
            </label>
            <i>→</i>
            <label>
              <select aria-label="Setor de decisão final" value={finalDepartment} onChange={(event) => setFinalDepartment(event.target.value as 'Atendimento' | 'Planejamento')}>
                <option>Planejamento</option>
                <option>Atendimento</option>
              </select>
            </label>
          </div>
          <div className="mission-workflow-responsibles">
            <span>
              <small>REDAÇÃO</small>
              <b>{team.find((member) => member.id === assigneeId)?.name ?? 'A definir'}</b>
            </span>
            <label>
              <small>{productionDepartment.toLocaleUpperCase('pt-BR')}</small>
              <select aria-label={`Responsável de ${productionDepartment}`} value={productionResponsibleId} onChange={(event) => setProductionResponsibleId(event.target.value)} required>
                {productionPeople.map((member) => (
                  <option value={member.id} key={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
            <label>
              <small>{finalDepartment.toLocaleUpperCase('pt-BR')}</small>
              <select aria-label={`Responsável de ${finalDepartment}`} value={finalResponsibleId} onChange={(event) => setFinalResponsibleId(event.target.value)} required>
                {finalPeople.map((member) => (
                  <option value={member.id} key={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
          </div>
          <small>O último setor decide concluir ou devolver. Cada responsável que concluir sua etapa recebe o XP após a conclusão final.</small>
        </div>
        <label>
          <span>REGRA DE XP</span>
          <select value={xpRuleId} onChange={(event) => setXpRuleId(event.target.value)}>
            <option value="">Sem regra automática · usar XP manual da prioridade</option>
            {xpRules.map((rule) => (
              <option value={rule.id} key={rule.id}>{rule.name} · {rule.baseXp} XP{rule.onTimeBonusPercent ? ` + ${rule.onTimeBonusPercent}% no prazo` : ''}</option>
            ))}
          </select>
          <small className="mission-xp-rule-note">O XP só será liberado após aprovação e para participantes elegíveis.</small>
        </label>
        <button className="mission-create-submit" type="submit">CRIAR MISSÃO <span>→</span></button>
      </form>
    </div>
  )
}
