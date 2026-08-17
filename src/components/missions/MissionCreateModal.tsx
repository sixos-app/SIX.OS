import { useEffect, useRef, useState } from 'react'
import type { Project, TeamMember } from '../../data/dashboard'
import { fetchWorkTypes, type WorkType } from '../../data/workTypeRepository'
import { missionDateTimeInputValue } from '../../utils/formatters'
import { DateTimePicker } from '../shared/DateTimePicker'
import { Icon } from '../shared/Icon'
import { WorkTypeSelector } from '../shared/WorkTypeSelector'

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
  workTypeId?: string | null
  workflowDepartments?: string[]
  workflowSteps?: MissionWorkflowStepInput[]
}

const WORKFLOW_PRESETS: Record<string, string[]> = {
  Campanha: ['Planejamento', 'Redação', 'Criação', 'Revisão', 'Atendimento'],
  Design: ['Planejamento', 'Criação', 'Revisão', 'Atendimento'],
  Vídeo: ['Planejamento', 'Redação', 'Audiovisual', 'Revisão', 'Atendimento'],
  Social: ['Planejamento', 'Redação', 'Criação', 'Atendimento'],
}

export function MissionCreateModal({
  projects,
  team,
  workTypes: initialWorkTypes,
  departments,
  initialProjectId,
  onClose,
  onCreate,
}: {
  projects: Project[]
  team: TeamMember[]
  workTypes?: WorkType[]
  departments: Array<{ id: string; name: string }>
  initialProjectId?: string
  onClose: () => void
  onCreate: (input: MissionCreationInput) => Promise<void> | void
}) {
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? '')
  const [workTypesList, setWorkTypesList] = useState<WorkType[]>(initialWorkTypes ?? [])
  const [workTypeId, setWorkTypeId] = useState<string | null>(null)
  const [deadline, setDeadline] = useState(() => missionDateTimeInputValue('Hoje · 17h'))
  const [estimatedHours, setEstimatedHours] = useState<string>('4')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [xpRules, setXpRules] = useState<Array<{ id: string; name: string; baseXp: number; onTimeBonusPercent: number }>>([])
  const [xpRuleId, setXpRuleId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const departmentNames = departments.length
    ? departments.map((department) => department.name)
    : Array.from(new Set(team.map((member) => member.department).filter((department): department is string => Boolean(department))))

  const peopleForDepartment = (department: string) => {
    const norm = department.toLocaleLowerCase('pt-BR')
    const matching = team.filter((member) => member.department?.toLocaleLowerCase('pt-BR') === norm)
    return matching.length ? matching : team
  }

  const createInitialSteps = () => {
    const preferred = ['Planejamento', 'Redação', 'Criação', 'Atendimento']
    const selected = preferred.filter((name) => departmentNames.includes(name))
    const initialDepartments = (selected.length ? selected : departmentNames).slice(0, 4)
    return initialDepartments.map((departmentName, index) => ({
      id: `initial-${index}`,
      departmentName,
      responsibleUserId: peopleForDepartment(departmentName)[0]?.id ?? team[0]?.id ?? '',
    }))
  }

  useEffect(() => {
    if (!initialWorkTypes || initialWorkTypes.length === 0) {
      fetchWorkTypes().then(setWorkTypesList).catch(() => {})
    }
  }, [initialWorkTypes])

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function handleFilesAdded(incoming: FileList | File[]) {
    const arr = Array.from(incoming)
    setFiles((current) => {
      const existingKeys = new Set(current.map((f) => `${f.name}-${f.size}`))
      const next = [...current]
      for (const file of arr) {
        if (!existingKeys.has(`${file.name}-${file.size}`)) {
          next.push(file)
          existingKeys.add(`${file.name}-${file.size}`)
        }
      }
      return next
    })
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index))
  }

  const [steps, setSteps] = useState<Array<{ id: string; departmentName: string; responsibleUserId: string }>>(createInitialSteps)

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
    const validPresetDepartments = presetDepts.filter((department) => departmentNames.includes(department))
    const nextDepartments = validPresetDepartments.length ? validPresetDepartments : departmentNames.slice(0, 4)
    setSteps(nextDepartments.map((dept, index) => {
      const candidates = peopleForDepartment(dept)
      return {
        id: String(Date.now() + index),
        departmentName: dept,
        responsibleUserId: candidates[0]?.id ?? team[0]?.id ?? '',
      }
    }))
  }

  function addStep() {
    if (steps.length >= 8 || departmentNames.length === 0) return
    const nextDept = departmentNames[steps.length % departmentNames.length]
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

  const currentProject = projects.find((p) => p.id === projectId)
  const isRestricted = Boolean(currentProject?.workTypeIds && currentProject.workTypeIds.length > 0)
  const availableWorkTypes = isRestricted
    ? workTypesList.filter((wt) => currentProject?.workTypeIds?.includes(wt.id))
    : workTypesList

  function handleWorkTypeSelect(selected: WorkType | null) {
    setWorkTypeId(selected ? selected.id : null)
    if (selected && selected.defaultMinutes > 0) {
      const hours = (selected.defaultMinutes / 60).toFixed(1).replace(/\.0$/, '')
      setEstimatedHours(hours)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!title.trim() || !projectId || !deadline.trim() || !steps.length) {
      setFormError(steps.length ? 'Preencha os campos obrigatórios.' : 'Nenhum departamento ativo está disponível para montar o fluxo.')
      return
    }
    const initialAssignee = steps[0]?.responsibleUserId || team[0]?.id || ''
    const expectedMinutesVal = estimatedHours ? Math.round(Number(estimatedHours) * 60) : null

    setIsSaving(true)
    try {
      await onCreate({
        title: title.trim(),
        projectId,
        assigneeId: initialAssignee,
        deadline,
        expectedMinutes: expectedMinutesVal,
        priority,
        description: description.trim(),
        files,
        xpRuleId: xpRuleId || undefined,
        workTypeId: workTypeId || null,
        workflowSteps: steps.map((s) => ({
          departmentName: s.departmentName,
          responsibleUserId: s.responsibleUserId,
        })),
      })
      onClose()
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Não foi possível criar a missão.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Criar missão">
      <form className="mission-create-dialog mission-create-dialog-expanded" onSubmit={handleSubmit} autoComplete="off">
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar criação de missão">×</button>
        <div className="mission-create-scroll">
          <span className="mission-create-icon"><Icon name="target" size={21} /></span>
          <p>NOVA MISSÃO</p>
          <h2>Qual ideia vamos<br /><em>tornar possível?</em></h2>

        <div className="mission-create-grid-2col">
          <label>
            <span>TÍTULO DA MISSÃO</span>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Desdobramentos de campanha" required />
          </label>
          <label>
            <span>PROJETO</span>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
              {projects.map((project) => (
                <option value={project.id} key={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mission-create-grid-2col">
          <div className="mission-create-field">
            <span>TIPO DE TRABALHO</span>
            <WorkTypeSelector
              mode="single"
              workTypes={availableWorkTypes}
              selectedId={workTypeId}
              onChangeSingle={handleWorkTypeSelect}
              onWorkTypeCreated={(newType) => setWorkTypesList((prev) => [...prev, newType])}
              placeholder="Selecione o tipo de trabalho..."
            />
          </div>
          <label>
            <span>PRAZO DE ENTREGA</span>
            <DateTimePicker value={deadline} onChange={setDeadline} />
          </label>
        </div>

        <div className="mission-create-grid-2col">
          <label>
            <span>PRIORIDADE</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as 'normal' | 'urgent')}>
              <option value="normal">Normal (80 XP base)</option>
              <option value="urgent">Urgente (120 XP base)</option>
            </select>
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

        <label className="mission-create-briefing">
          <span>BRIEFING, LINKS E CONTEXTO</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Escreva o briefing da missão, orientações e cole links de referências." maxLength={4000} rows={3} />
        </label>

        <div className="mission-create-field mission-create-attachments">
          <span>ANEXOS E ARQUIVOS (OPCIONAL)</span>
          <div
            className={`mission-dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              if (e.dataTransfer.files?.length) {
                handleFilesAdded(e.dataTransfer.files)
              }
            }}
          >
            <label
              className="mission-dropzone-trigger"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleFilesAdded(e.target.files)
                    e.target.value = ''
                  }
                }}
              />
              <span className="mission-dropzone-icon">↑</span>
              <span>{isDragging ? 'SOLTE OS ARQUIVOS AQUI' : 'CLIQUE OU ARRASTE ARQUIVOS PARA ANEXAR'}</span>
            </label>
            <p>Suporte para imagens, vídeos, PDFs e documentos de briefing</p>
          </div>

          {files.length > 0 && (
            <div className="mission-selected-files">
              {files.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="mission-selected-file-item">
                  <div>
                    <b title={file.name}>📎 {file.name}</b>
                    <small>{formatBytes(file.size)}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    title={`Remover ${file.name}`}
                    aria-label={`Remover ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
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
                  {departmentNames.map((dept) => (
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

        </div>
        {formError && <p className="mission-create-error" role="alert">{formError}</p>}
        <footer className="mission-create-footer">
          <button className="mission-create-submit" type="submit" disabled={isSaving || steps.length === 0}>
            {isSaving ? 'CRIANDO…' : <>CRIAR MISSÃO <span>→</span></>}
          </button>
        </footer>
      </form>
    </div>
  )
}
