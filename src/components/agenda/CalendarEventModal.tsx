import { useEffect, useState, type FormEvent } from 'react'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  uploadCalendarEventDocument,
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
  missions,
  team = [],
  canCreateTeam,
  defaultOwnerUserId,
  defaultVisibility,
  onClose,
  onCreated,
  onOpenMission,
}: {
  event?: CalendarEventRecord
  initialDate?: string
  projects: Project[]
  missions: Array<{ id: string; title: string; projectId?: string; status?: string }>
  team?: TeamMember[]
  canCreateTeam: boolean
  defaultOwnerUserId: string
  defaultVisibility: CalendarVisibility
  onClose: () => void
  onCreated: () => void
  onOpenMission: (missionId: string) => void
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
  const [missionId, setMissionId] = useState(calendarEvent?.missionId ?? '')
  const [location, setLocation] = useState(calendarEvent?.location ?? '')
  const [description, setDescription] = useState(calendarEvent?.description ?? '')
  const [ownerUserId, setOwnerUserId] = useState(calendarEvent?.ownerUserId ?? defaultOwnerUserId)
  const [participantUserIds, setParticipantUserIds] = useState<string[]>(calendarEvent?.participantUserIds ?? [])
  const [participantToAdd, setParticipantToAdd] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
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
    let createdEventId = ''
    try {
      const input = { title, startsAt, endsAt, eventType, visibility, projectId: projectId || undefined, location, description, ownerUserId: ownerUserId || undefined, missionId: missionId || undefined, participantUserIds }
      const eventId = calendarEvent
        ? (await updateCalendarEvent(calendarEvent.id, input), calendarEvent.id)
        : (await createCalendarEvent(input)).event.id
      if (!calendarEvent) createdEventId = eventId
      if (documentFile) await uploadCalendarEventDocument(eventId, documentFile)
      onCreated()
    } catch (reason) {
      if (createdEventId) await deleteCalendarEvent(createdEventId).catch(() => undefined)
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar o evento.')
    } finally {
      setIsSaving(false)
    }
  }

  function selectMission(nextMissionId: string) {
    setMissionId(nextMissionId)
    const mission = missions.find((item) => item.id === nextMissionId)
    if (mission?.projectId) setProjectId(mission.projectId)
  }

  function addParticipant() {
    if (!participantToAdd || participantToAdd === ownerUserId || participantUserIds.includes(participantToAdd)) return
    setParticipantUserIds((current) => [...current, participantToAdd])
    setParticipantToAdd('')
    if (canCreateTeam) setVisibility('team')
  }

  return (
    <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label={calendarEvent ? 'Editar evento da agenda' : 'Novo evento da agenda'}>
      <form className="mission-create-dialog agenda-create-dialog" onSubmit={submit} autoComplete="off">
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar criação de evento">×</button>
        <div className="mission-create-scroll agenda-create-scroll">
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
              <option value="capture">Captação</option>
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
            <span>RESPONSÁVEL</span>
            <select value={ownerUserId} onChange={(event) => { setOwnerUserId(event.target.value); setParticipantUserIds((current) => current.filter((id) => id !== event.target.value)) }} disabled={!canCreateTeam}>
              {team.filter((member) => canCreateTeam || member.id === ownerUserId).map((member) => (
                <option value={member.id} key={member.id}>{member.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>PROJETO (OPCIONAL)</span>
            <select value={projectId} onChange={(event) => { setProjectId(event.target.value); if (missionId && missions.find((mission) => mission.id === missionId)?.projectId !== event.target.value) setMissionId('') }}>
              <option value="">Sem projeto vinculado</option>
              {projects.map((project) => (
                <option value={project.id} key={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
        </div>
        {canCreateTeam && (
          <div className="agenda-participants-field">
            <span>USUÁRIOS PARTICIPANTES</span>
            <div className="agenda-participant-add">
              <select value={participantToAdd} onChange={(event) => setParticipantToAdd(event.target.value)} aria-label="Selecionar usuário participante">
                <option value="">Selecione um usuário</option>
                {team.filter((member) => member.id !== ownerUserId && !participantUserIds.includes(member.id)).map((member) => (
                  <option value={member.id} key={member.id}>{member.name}</option>
                ))}
              </select>
              <button type="button" onClick={addParticipant} disabled={!participantToAdd}>ADICIONAR +</button>
            </div>
            {participantUserIds.length > 0 && (
              <div className="agenda-participant-chips">
                {participantUserIds.map((userId) => {
                  const member = team.find((item) => item.id === userId)
                  return <button type="button" onClick={() => setParticipantUserIds((current) => current.filter((id) => id !== userId))} key={userId}>{member?.name ?? 'Usuário'} <span>×</span></button>
                })}
              </div>
            )}
          </div>
        )}
        <label>
          <span>LOCAL (OPCIONAL)</span>
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ex.: Sala Norte" />
        </label>
        {eventType === 'capture' && (
          <div className="agenda-capture-source">
            <div className="agenda-capture-heading">
              <span>ROTEIRO DA CAPTAÇÃO</span>
              <small>Vincule uma missão para consultar o roteiro ou anexe um documento.</small>
            </div>
            <div className="agenda-capture-grid">
              <label>
                <span>MISSÃO / ROTEIRO (OPCIONAL)</span>
                <select value={missionId} onChange={(event) => selectMission(event.target.value)}>
                  <option value="">Sem missão vinculada</option>
                  {missions.filter((mission) => !projectId || mission.projectId === projectId).map((mission) => (
                    <option value={mission.id} key={mission.id}>{mission.title}</option>
                  ))}
                </select>
              </label>
              <button className="agenda-open-mission-button" type="button" onClick={() => onOpenMission(missionId)} disabled={!missionId}>ABRIR MISSÃO / ROTEIRO ↗</button>
            </div>
            <label className="agenda-document-input">
              <span>ANEXAR DOC, DOCX OU PDF (OPCIONAL)</span>
              <input type="file" accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} />
              <small>{documentFile?.name ?? calendarEvent?.attachmentName ?? 'Nenhum documento selecionado'}</small>
            </label>
          </div>
        )}
        <label>
          <span>CONTEXTO</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que precisa acontecer neste compromisso?" maxLength={2000} />
        </label>
        </div>
        <footer className="mission-create-footer agenda-create-footer">
          {error && <p className="agenda-status error" role="alert">{error}</p>}
          <button className="mission-create-submit" type="submit" disabled={isSaving}>
            {isSaving ? 'SALVANDO…' : <>{calendarEvent ? 'SALVAR ALTERAÇÕES' : 'CRIAR EVENTO'} <span>→</span></>}
          </button>
        </footer>
      </form>
    </div>
  )
}
