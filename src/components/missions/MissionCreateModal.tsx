import { useEffect, useState } from 'react'
import type { Project, TeamMember } from '../../data/dashboard'
import { missionDateTimeInputValue } from '../../utils/formatters'
import { DateTimePicker } from '../shared/DateTimePicker'
import { Icon } from '../shared/Icon'

export type MissionWorkflowStepInput = {
  departmentName: string
  responsibleUserId: string
  stepType?: string
  expectedMinutes?: number | null
}

export type MissionCreationInput = {
  title: string
  projectId: string
  assigneeId: string
  deadline: string
  expectedMinutes?: number | null
  priority: 'normal' | 'urgent'
  description?: string
  files?: File[]
  xpRuleId?: string
  workflowDepartments?: string[]
  workflowSteps?: MissionWorkflowStepInput[]
}

const AVAILABLE_DEPARTMENTS = [
  'Planejamento',
  'Redação',
  'Criação',
  'Audiovisual',
  'Social Mídia',
  'Atendimento',
]

const WORKFLOW_PRESETS: Record<string, string[]> = {
  Campanha: ['Planejamento', 'Redação', 'Criação', 'Revisão', 'Atendimento'],
  Design: ['Planejamento', 'Criação', 'Revisão', 'Atendimento'],
  Vídeo: ['Planejamento', 'Redação', 'Audiovisual', 'Revisão', 'Atendimento'],
  Social: ['Planejamento', 'Redação', 'Criação', 'Atendimento'],
}

export function MissionCreateModal({
  projects,
  team,
  initialProjectId,
  onClose,
  onCreate,
}: {
  projects: Project[]
  team: TeamMember[]
  initialProjectId?: string
  onClose: () => void
  onCreate: (input: MissionCreationInput) => void
}) {
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? '')
  const [deadline, setDeadline] = useState(() => missionDateTimeInputValue('Hoje · 17h'))
  const [estimatedHours, setEstimatedHours] = useState<string>('4')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [xpRules, setXpRules] = useState<Array<{ id: string; name: string; baseXp: number; onTimeBonusPercent: number }>>([])
  const [xpRuleId, setXpRuleId] = useState('')

  const peopleForDepartment = (department: string) => {
    const norm = department.toLowerCase()
    const matching = team.filter((member) => member.department?.toLowerCase() === norm)
    return matching.length ? matching : team
  }

  const [steps, setSteps] = useState<Array<{ id: string; departmentName: string; responsibleUserId: string }>>(() => [
    { id: '1', departmentName: 'Planejamento', responsibleUserId: team[0]?.id ?? '' },
    { id: '2', departmentName: 'Redação', responsibleUserId: team[0]?.id ?? '' },
    { id: '3', departmentName: 'Criação', responsibleUserId: team[0]?.id ?? '' },
    { id: '4', departmentName: 'Atendimento', responsibleUserId: team[0]?.id ?? '' },
  ])

  useEffect(() => {
    void fetch('/api/gamification/rules')
      .then((response) => (response.ok ? response.json() : { rules: [] }))
      .then((data: { rules?: Array<{ id: string; name: string; baseXp: number; onTimeBonusPercent: number }> }) => setXpRules(data.rules ?? []))
      .catch(() => undefined)
    function handleEscape(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  function applyPreset(presetName: string) {
    const presetDepts = WORKFLOW_PRESETS[presetName]
    if (!presetDepts) return
    setSteps(presetDepts.map((dept, index) => {
      const candidates = peopleForDepartment(dept)
      return {
        id: String(Date.now() + index),
        departmentName: dept === 'Revisão' ? 'Criação' : dept,
        responsibleUserId: candidates[0]?.id ?? team[0]?.id ?? '',
      }
    }))
  }

  function addStep() {
    if (steps.length >= 8) return
    const nextDept = steps.length % 2 === 0 ? 'Criação' : 'Revisão'
    const candidates = peopleForDepartment(nextDept)
    setSteps([...steps, {
      id: String(Date.now()),
      departmentName: nextDept,
      responsibleUserId: candidates[0]?.id ?? team[0]?.id ?? '',
    }])
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return
    setSteps(steps.filter((_, i) => i !== index))
  }

  function updateStepDepartment(index: number, departmentName: string) {
    const candidates = peopleForDepartment(departmentName)
    setSteps(steps.map((step, i) => i === index ? {
      ...step,
      departmentName,
      responsibleUserId: candidates[0]?.id ?? team[0]?.id ?? '',
    } : step))
  }

  function updateStepResponsible(index: number, responsibleUserId: string) {
    setSteps(steps.map((step, i) => i === index ? { ...step, responsibleUserId } : step))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !projectId || !deadline.trim() || !steps.length) return
    const initialAssignee = steps[0]?.responsibleUserId || team[0]?.id || ''
    const expectedMinutesVal = estimatedHours ? Math.round(Number(estimatedHours) * 60) : null

    onCreate({
      title: title.trim(),
      projectId,
      assigneeId: initialAssignee,
      deadline,
      expectedMinutes: expectedMinutesVal,
      priority,
      description: description.trim(),
      files,
      xpRuleId: xpRuleId || undefined,
      workflowSteps: steps.map((s) => ({
        departmentName: s.departmentName,
        responsibleUserId: s.responsibleUserId,
      })),
    })
  }

  return (
    <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Criar missão">
      <form className="mission-create-dialog mission-create-dialog-expanded" onSubmit={handleSubmit}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar criação de missão">×</button>
        <span className="mission-create-icon"><Icon name="target" size={21} /></span>
        <p>NOVA MISSÃO</p>
        <h2>Qual ideia vamos<br /><em>tornar possível?</em></h2>

        <label>
          <span>TÍTULO</span>
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Desdobramentos de campanha" required />
        </label>

        <label>
          <span>BRIEFING, LINKS E CONTEXTO</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Escreva o briefing da missão, orientações e cole links de referências." maxLength={4000} />
        </label>

        <label className="mission-create-files">
          <span>ANEXOS E ARQUIVOS (OPCIONAL)</span>
          <input type="file" accept="image/*,video/*,.pdf" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
          <small>{files.length ? `${files.length} arquivo${files.length === 1 ? '' : 's'} selecionado${files.length === 1 ? '' : 's'}.` : 'Envie referências, imagens ou briefings anexados.'}</small>
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
            <span>PRIORIDADE</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as 'normal' | 'urgent')}>
              <option value="normal">Normal (80 XP base)</option>
              <option value="urgent">Urgente (120 XP base)</option>
            </select>
          </label>
        </div>

        <div className="mission-create-row">
          <label>
            <span>PRAZO DE ENTREGA</span>
            <DateTimePicker value={deadline} onChange={setDeadline} />
          </label>
          <label>
            <span>ESTIMATIVA DE TEMPO (HORAS)</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              max="200"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="Ex.: 4"
            />
          </label>
        </div>

        {/* FLUXO DINÂMICO DA MISSÃO */}
        <div className="mission-workflow-builder">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span>FLUXO DA MISSÃO</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {Object.keys(WORKFLOW_PRESETS).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  style={{
                    background: '#242424',
                    color: '#a7a7a4',
                    border: '1px solid #3d3d38',
                    borderRadius: '5px',
                    padding: '2px 7px',
                    fontSize: '9px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', background: '#171717', padding: '10px', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
            {steps.map((step, idx) => (
              <div key={step.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#c6ff38' }}>{idx + 1}·</span>
                <select
                  value={step.departmentName}
                  onChange={(e) => updateStepDepartment(idx, e.target.value)}
                  style={{
                    background: '#242424',
                    color: '#f8f8f2',
                    border: '1px solid #3d3d38',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {AVAILABLE_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    title="Remover etapa"
                    style={{ background: 'transparent', color: '#ff6b6b', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                  >
                    ×
                  </button>
                )}
                {idx < steps.length - 1 && <i style={{ color: '#c6ff38', fontStyle: 'normal', fontWeight: 900 }}>→</i>}
              </div>
            ))}
            {steps.length < 8 && (
              <button
                type="button"
                onClick={addStep}
                style={{
                  background: '#242424',
                  color: '#c6ff38',
                  border: '1px dashed rgba(198, 255, 56, 0.4)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginLeft: '4px',
                }}
              >
                + Adicionar etapa
              </button>
            )}
          </div>

          <div className="mission-workflow-responsibles" style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`, gap: '8px' }}>
            {steps.map((step, idx) => {
              const candidates = peopleForDepartment(step.departmentName)
              return (
                <label key={step.id} style={{ display: 'grid', gap: '3px' }}>
                  <small style={{ fontSize: '9px', fontWeight: 800, color: '#888' }}>
                    {idx + 1}. {step.departmentName.toUpperCase()}
                  </small>
                  <select
                    value={step.responsibleUserId}
                    onChange={(e) => updateStepResponsible(idx, e.target.value)}
                    style={{
                      background: '#1c1c1c',
                      color: '#f8f8f2',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      padding: '5px 8px',
                      fontSize: '11px',
                    }}
                    required
                  >
                    {candidates.map((member) => (
                      <option value={member.id} key={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>
          <small style={{ display: 'block', marginTop: '8px', color: '#888', fontSize: '10px' }}>
            A missão avançará sequencialmente pelos responsáveis. Cada colaborador que concluir sua etapa recebe o XP proporcional após a conclusão final.
          </small>
        </div>

        <label>
          <span>REGRA DE RECOMPENSA XP</span>
          <select value={xpRuleId} onChange={(event) => setXpRuleId(event.target.value)}>
            <option value="">Sem regra automática · usar XP padrão da prioridade</option>
            {xpRules.map((rule) => (
              <option value={rule.id} key={rule.id}>
                {rule.name} · {rule.baseXp} XP{rule.onTimeBonusPercent ? ` + ${rule.onTimeBonusPercent}% pontualidade` : ''}
              </option>
            ))}
          </select>
          <small className="mission-xp-rule-note">O XP será distribuído na aprovação final para todos os participantes do fluxo.</small>
        </label>

        <button className="mission-create-submit" type="submit">
          CRIAR MISSÃO <span>→</span>
        </button>
      </form>
    </div>
  )
}
