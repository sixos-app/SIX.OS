import { useEffect, useState, type FormEvent } from 'react'
import type { Project, TeamMember } from '../../data/dashboard'
import { missionDateTimeInputValue } from '../../utils/formatters'
import { DateTimePicker } from '../shared/DateTimePicker'
import { Icon } from '../shared/Icon'
import { MentionTextarea } from '../shared/MentionTextarea'

export function ProjectLifecycleModal({
  project,
  team = [],
  onClose,
  onUpdate,
  canDelete,
  onDelete,
}: {
  project: Project
  team?: TeamMember[]
  onClose: () => void
  onUpdate: (input: { status: string; deadline: string; nextStep: string }) => Promise<void>
  canDelete?: boolean
  onDelete?: () => void
}) {
  const [status, setStatus] = useState(project.status)
  const [deadline, setDeadline] = useState(() => project.dueAt ? missionDateTimeInputValue(project.dueAt) : missionDateTimeInputValue('Amanhã · 18h'))
  const [nextStep, setNextStep] = useState(project.nextStep)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!status || !deadline || !nextStep.trim()) return
    setIsSaving(true)
    setError('')
    try {
      await onUpdate({ status, deadline, nextStep: nextStep.trim() })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o projeto.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Gerenciar ciclo do projeto">
      <form className="mission-create-dialog project-lifecycle-dialog" onSubmit={submit}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar ciclo do projeto">×</button>
        <span className="mission-create-icon"><Icon name="folder" size={21} /></span>
        <p>CICLO DO PROJETO</p>
        <h2>O que move<br /><em>{project.name}?</em></h2>
        <label>
          <span>STATUS DA FRENTE</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>EM CONCEPÇÃO</option>
            <option>EM PRODUÇÃO</option>
            <option>EM APROVAÇÃO</option>
            <option>PAUSADO</option>
            <option>CONCLUÍDO</option>
          </select>
        </label>
        <label>
          <span>PRÓXIMO MARCO</span>
          <DateTimePicker value={deadline} onChange={setDeadline} />
        </label>
        <label>
          <span>PRÓXIMO MOVIMENTO</span>
          <MentionTextarea
            value={nextStep}
            onChange={setNextStep}
            teamMembers={team}
            placeholder="Descreva o próximo passo do projeto e mencione colegas com @"
            required
            rows={3}
          />
        </label>
        {error && <p className="admin-dialog-error">{error}</p>}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          {canDelete && onDelete && (
            <button
              className="mission-delete-button"
              type="button"
              disabled={isSaving}
              onClick={onDelete}
              style={{ flex: '0 0 auto', padding: '12px 20px', minHeight: '44px' }}
            >
              EXCLUIR
            </button>
          )}
          <button
            className="mission-create-submit"
            type="submit"
            disabled={isSaving}
            style={{ flex: 1, margin: 0, minHeight: '44px' }}
          >
            {isSaving ? 'SALVANDO…' : <>ATUALIZAR CICLO <span>→</span></>}
          </button>
        </div>
      </form>
    </div>
  )
}
