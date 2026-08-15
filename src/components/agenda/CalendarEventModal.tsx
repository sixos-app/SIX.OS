import { useEffect, useState, type FormEvent } from 'react'
import {
  createCalendarEvent,
  updateCalendarEvent,
  type CalendarEventRecord,
  type CalendarEventType,
  type CalendarVisibility,
} from '../../data/agendaRepository'
import type { Project, TeamMember } from '../../data/dashboard'
import { DateTimePicker } from '../shared/DateTimePicker'
import { Icon } from '../shared/Icon'

export function agendaDateTimeInputValue(offsetMinutes = 60, baseDate?: Date) {
  const date = baseDate ? new Date(baseDate.getTime() + offsetMinutes * 60_000) : new Date(Date.now() + offsetMinutes * 60_000)
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export function agendaDateTimeInputFromIso(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export function CalendarEventModal({
  event: calendarEvent,
  initialDate,
  projects,
  canCreateTeam,
  defaultOwnerUserId,
  defaultVisibility,
  onClose,
  onCreated,
}: {
  event?: CalendarEventRecord
  initialDate?: string
  projects: Project[]
  team?: TeamMember[]
  canCreateTeam: boolean
  defaultOwnerUserId: string
  defaultVisibility: CalendarVisibility
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState(calendarEvent?.title ?? '')
  const [eventType, setEventType] = useState<CalendarEventType>(calendarEvent?.eventType ?? 'meeting')
  const [startsAt, setStartsAt] = useState(() => {
    if (calendarEvent) return agendaDateTimeInputFromIso(calendarEvent.startsAt)
    if (initialDate) return agendaDateTimeInputFromIso(initialDate)
    return agendaDateTimeInputValue()
  })
  const [endsAt, setEndsAt] = useState(() => {
    if (calendarEvent) return agendaDateTimeInputFromIso(calendarEvent.endsAt)
    if (initialDate) {
      const d = new Date(initialDate)
      d.setHours(d.getHours() + 1)
      return agendaDateTimeInputFromIso(d.toISOString())
    }
    return agendaDateTimeInputValue(120)
  })
  const [visibility, setVisibility] = useState<CalendarVisibility>(calendarEvent?.visibility ?? defaultVisibility)
  const [projectId, setProjectId] = useState(calendarEvent?.projectId ?? '')
  const [location, setLocation] = useState(calendarEvent?.location ?? '')
  const [description, setDescription] = useState(calendarEvent?.description ?? '')
  const [ownerUserId] = useState(calendarEvent?.ownerUserId ?? defaultOwnerUserId)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      const input = { title, startsAt, endsAt, eventType, visibility, projectId: projectId || undefined, location, description, ownerUserId: ownerUserId || undefined }
      if (calendarEvent) await updateCalendarEvent(calendarEvent.id, input)
      else await createCalendarEvent(input)
      onCreated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar o evento.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label={calendarEvent ? 'Editar evento da agenda' : 'Novo evento da agenda'}>
      <form className="mission-create-dialog agenda-create-dialog" onSubmit={submit}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar criação de evento">×</button>
        <span className="mission-create-icon"><Icon name="calendar" size={21} /></span>
        <p>{calendarEvent ? 'EDITAR EVENTO' : 'NOVO EVENTO'}</p>
        <h2>{calendarEvent ? <>Ajuste o próximo<br /><em>movimento.</em></> : <>Organize o próximo<br /><em>movimento.</em></>}</h2>
        <label>
          <span>TÍTULO</span>
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Reunião de alinhamento" required />
        </label>
        <div className="mission-create-row">
          <label>
            <span>TIPO</span>
            <select value={eventType} onChange={(event) => setEventType(event.target.value as CalendarEventType)}>
              <option value="meeting">Reunião</option>
              <option value="deadline">Prazo</option>
              <option value="appointment">Compromisso</option>
              <option value="vacation">Férias / Ausência</option>
              <option value="birthday">Aniversário</option>
            </select>
          </label>
          <label>
            <span>VISIBILIDADE</span>
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as CalendarVisibility)}>
              <option value="personal">Somente eu</option>
              {canCreateTeam && <option value="team">Equipe autorizada</option>}
            </select>
          </label>
        </div>
        <div className="mission-create-row">
          <label>
            <span>INÍCIO</span>
            <DateTimePicker value={startsAt} onChange={setStartsAt} />
          </label>
          <label>
            <span>FIM</span>
            <DateTimePicker value={endsAt} onChange={setEndsAt} />
          </label>
        </div>
        <div className="mission-create-row">
          <label>
            <span>PROJETO (OPCIONAL)</span>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Sem projeto vinculado</option>
              {projects.map((project) => (
                <option value={project.id} key={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>LOCAL (OPCIONAL)</span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ex.: Sala Norte" />
          </label>
        </div>
        <label>
          <span>CONTEXTO</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que precisa acontecer neste compromisso?" maxLength={2000} />
        </label>
        {error && <p className="agenda-status error">{error}</p>}
        <button className="mission-create-submit" type="submit" disabled={isSaving}>
          {isSaving ? 'SALVANDO…' : <>{calendarEvent ? 'SALVAR ALTERAÇÕES' : 'CRIAR EVENTO'} <span>→</span></>}
        </button>
      </form>
    </div>
  )
}
