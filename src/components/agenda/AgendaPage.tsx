import { useEffect, useState } from 'react'
import type { AccessSession } from '../../data/accessRepository'
import {
  deleteCalendarEvent,
  getAgenda,
  type AgendaPermissions,
  type AgendaScope,
  type CalendarEventRecord,
  type CalendarEventType,
} from '../../data/agendaRepository'
import type { AgendaEvent, Mission, Project, TeamMember } from '../../data/dashboard'
import { getInitials } from '../../utils/formatters'
import { AgendaCalendar } from '../AgendaCalendar'
import { Avatar } from '../shared/Avatar'
import { CalendarEventModal } from './CalendarEventModal'

export type AgendaDisplayEvent = {
  id: string
  time: string
  title: string
  subtitle: string
  day: string
  category: string
  tone: Mission['tone']
  duration: string
  attendees: string[]
  description: string
  missionId: string | null
  attachmentName: string | null
}

export const agendaCategoryLabels: Record<CalendarEventType, string> = {
  meeting: 'Reunião',
  deadline: 'Prazo',
  appointment: 'Compromisso',
  capture: 'Captação',
  vacation: 'Férias',
  birthday: 'Aniversário',
}

export function agendaDateLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const eventDay = new Date(date)
  eventDay.setHours(0, 0, 0, 0)
  const difference = Math.round((eventDay.getTime() - today.getTime()) / 86_400_000)
  if (difference === 0) return 'Hoje'
  if (difference === 1) return 'Amanhã'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date).replace('.', '')
}

export function agendaDayOrder(day: string) {
  if (day === 'Hoje') return 0
  if (day === 'Amanhã') return 1
  return 2
}

export function agendaTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

export function agendaDuration(startsAt: string, endsAt: string | null) {
  if (!endsAt) return 'Sem duração'
  const minutes = Math.max(0, Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`
}

export function agendaTone(type: CalendarEventType): Mission['tone'] {
  if (type === 'deadline' || type === 'capture') return 'orange'
  if (type === 'vacation') return 'lime'
  if (type === 'birthday') return 'purple'
  return type === 'meeting' ? 'purple' : 'lime'
}

export function calendarEventToDisplay(event: CalendarEventRecord): AgendaDisplayEvent {
  const context = [event.clientName ?? event.projectName, event.location].filter(Boolean).join(' · ')
  const attendeeNames = Array.from(new Set([event.ownerName, ...event.participantNames].filter((name): name is string => Boolean(name))))
  return {
    id: event.id,
    time: agendaTime(event.startsAt),
    title: event.title,
    subtitle: context || (event.visibility === 'team' ? 'Agenda da equipe' : 'Agenda individual'),
    day: agendaDateLabel(event.startsAt),
    category: agendaCategoryLabels[event.eventType] ?? 'Compromisso',
    tone: agendaTone(event.eventType),
    duration: agendaDuration(event.startsAt, event.endsAt),
    attendees: attendeeNames.map(getInitials),
    description: event.description || 'Sem contexto adicional registrado.',
    missionId: event.missionId,
    attachmentName: event.attachmentName,
  }
}

export function AgendaPage({
  events,
  missions,
  projects,
  team,
  completed,
  accessSession,
  onOpenMission,
}: {
  events: AgendaEvent[]
  missions: Mission[]
  projects: Project[]
  team: TeamMember[]
  completed: string[]
  accessSession: AccessSession | null
  onOpenMission: (missionId: string) => void
}) {
  const [scope, setScope] = useState<AgendaScope>('mine')
  const [remoteEvents, setRemoteEvents] = useState<CalendarEventRecord[]>([])
  const [permissions, setPermissions] = useState<AgendaPermissions>({ canViewTeam: false, canCreateTeam: false })
  const [, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedCreateDate, setSelectedCreateDate] = useState<string | undefined>(undefined)
  const [editingEvent, setEditingEvent] = useState<CalendarEventRecord | null>(null)
  const [selectedOwnerId, setSelectedOwnerId] = useState('')

  useEffect(() => {
    let active = true
    if (!accessSession) {
      setRemoteEvents([])
      setPermissions({ canViewTeam: false, canCreateTeam: false })
      setError('')
      return () => { active = false }
    }

    setIsLoading(true)
    setError('')
    void getAgenda(scope, scope === 'team' ? selectedOwnerId : undefined).then((data) => {
      if (!active) return
      setRemoteEvents(data.events)
      setPermissions(data.permissions)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a agenda.')
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => { active = false }
  }, [accessSession, scope, selectedOwnerId])

  const missionEvents: AgendaDisplayEvent[] = missions.filter((mission) => {
    if (completed.includes(mission.id)) return false
    return !accessSession || (scope === 'team' ? permissions.canViewTeam && (!selectedOwnerId || mission.assigneeId === selectedOwnerId) : mission.assigneeId === accessSession.id)
  }).map((mission) => {
    const project = projects.find((item) => item.id === mission.projectId)
    const assignee = team.find((member) => member.id === mission.assigneeId)
    const timeParts = mission.deadline.match(/(\d{1,2})(?::(\d{2}))?h?/)
    const hour = timeParts?.[1]?.padStart(2, '0') ?? '18'
    const minute = timeParts?.[2] ?? '00'

    return {
      id: `agenda-mission-${mission.id}`,
      time: mission.dueAt ? agendaTime(mission.dueAt) : `${hour}:${minute}`,
      title: mission.title,
      subtitle: `${project?.name ?? mission.client} · Missão atribuída`,
      day: mission.dueAt ? agendaDateLabel(mission.dueAt) : mission.deadline.startsWith('Hoje') ? 'Hoje' : 'Amanhã',
      category: 'Entrega',
      tone: mission.tone,
      duration: 'Entrega',
      attendees: assignee ? [assignee.initials] : [],
      description: `Entrega da missão “${mission.title}” para ${project?.name ?? mission.client}.${assignee ? ` Responsável: ${assignee.name}.` : ''}`,
      missionId: mission.id,
      attachmentName: null,
    }
  })

  const calendarEvents: AgendaDisplayEvent[] = accessSession ? remoteEvents.map(calendarEventToDisplay) : events.map((event) => ({ ...event, category: event.category === 'Criação' ? 'Compromisso' : event.category, missionId: null, attachmentName: null }))
  const agendaEvents = [...calendarEvents, ...missionEvents].sort((first, second) => agendaDayOrder(first.day) - agendaDayOrder(second.day) || first.time.localeCompare(second.time))
  const [agendaFilter] = useState<'all' | 'Reunião' | 'Prazo' | 'Compromisso' | 'Captação' | 'Férias' | 'Aniversário' | 'Entrega'>('all')
  const [selectedEventId, setSelectedEventId] = useState(agendaEvents[0]?.id ?? '')
  const visibleEvents = agendaEvents.filter((event) => agendaFilter === 'all' || event.category === agendaFilter)
  const selectedEvent = visibleEvents.find((event) => event.id === selectedEventId) ?? visibleEvents[0] ?? agendaEvents[0]
  const selectedRemoteEvent = selectedEvent ? remoteEvents.find((event) => event.id === selectedEvent.id) ?? null : null
  const canManageSelectedEvent = Boolean(accessSession && selectedRemoteEvent && (selectedRemoteEvent.ownerUserId === accessSession.id || (selectedRemoteEvent.visibility === 'team' && permissions.canViewTeam)))

  function refreshAgenda() {
    if (!accessSession) return
    setIsLoading(true)
    void getAgenda(scope, scope === 'team' ? selectedOwnerId : undefined).then((data) => {
      setRemoteEvents(data.events)
      setPermissions(data.permissions)
      setError('')
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a agenda.')).finally(() => setIsLoading(false))
  }

  async function removeSelectedEvent() {
    if (!selectedRemoteEvent || !window.confirm(`Excluir “${selectedRemoteEvent.title}” da agenda?`)) return
    try {
      await deleteCalendarEvent(selectedRemoteEvent.id)
      setSelectedEventId('')
      refreshAgenda()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível excluir o evento.')
    }
  }

  function handleOpenCreate(dateIso?: string) {
    setSelectedCreateDate(dateIso)
    setIsCreateOpen(true)
  }

  return (
    <section className="agenda-page">
      <div className="agenda-intro">
        <div>
          <p className="eyebrow">{scope === 'team' ? 'AGENDA DA EQUIPE' : 'MINHA AGENDA'} <span>✦</span></p>
          <h1>Ritmo de<br /><em>possibilidades.</em></h1>
        </div>
        <div className="agenda-date-summary">
          <span>HOJE</span>
          <b>{String(new Date().getDate()).padStart(2, '0')}</b>
          <small>{missionEvents.length} {missionEvents.length === 1 ? 'missão pendente' : 'missões pendentes'}</small>
        </div>
      </div>

      <div className="agenda-scope-bar">
        <div className="segmented-control" aria-label="Escopo da agenda">
          <button className={scope === 'mine' ? 'selected' : ''} onClick={() => setScope('mine')}>Minha agenda</button>
          {permissions.canViewTeam && <button className={scope === 'team' ? 'selected' : ''} onClick={() => setScope('team')}>Agenda da equipe</button>}
        </div>
        {accessSession ? (
          <button className="agenda-create-button" onClick={() => handleOpenCreate()}>NOVO EVENTO <span>+</span></button>
        ) : (
          <span className="agenda-local-note">Entre para registrar eventos.</span>
        )}
      </div>

      {error && agendaEvents.length === 0 && <p className="agenda-status error">{error}</p>}

      <AgendaCalendar
        events={remoteEvents}
        missions={missions.filter((mission) => !completed.includes(mission.id) && (!accessSession || (scope === 'team' ? permissions.canViewTeam && (!selectedOwnerId || mission.assigneeId === selectedOwnerId) : mission.assigneeId === accessSession.id)))}
        team={team}
        teamScope={scope === 'team'}
        selectedOwnerId={selectedOwnerId}
        onOwnerChange={setSelectedOwnerId}
        onSelect={setSelectedEventId}
        onAddOnDate={(dateIso) => handleOpenCreate(dateIso)}
      />

      <div className="agenda-workspace" style={{ marginTop: '24px' }}>
        <div className="agenda-timeline">
          {visibleEvents.map((event) => {
            const isSelected = event.id === selectedEvent?.id
            return (
              <button className={`agenda-timeline-item tone-${event.tone} ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedEventId(event.id)} aria-pressed={isSelected} key={event.id}>
                <time>{event.time}</time>
                <span className="agenda-timeline-dot" />
                <span className="agenda-timeline-copy">
                  <small>{event.day} · {event.category}</small>
                  <b>{event.title}</b>
                  <em>{event.subtitle}</em>
                </span>
                <span className="agenda-timeline-duration">{event.duration}</span>
              </button>
            )
          })}
          {visibleEvents.length === 0 && <p className="empty-state">Nenhum evento nesse filtro.</p>}
        </div>
        {selectedEvent ? (
          <aside className={`agenda-detail tone-${selectedEvent.tone}`}>
            <div className="agenda-detail-head">
              <span>{selectedEvent.day} · {selectedEvent.time}</span>
              <b>{selectedEvent.category}</b>
            </div>
            <h2>{selectedEvent.title}</h2>
            <p>{selectedEvent.subtitle}</p>
            <div className="agenda-detail-section">
              <span>DURAÇÃO</span>
              <b>{selectedEvent.duration}</b>
            </div>
            <div className="agenda-detail-section">
              <span>CONTEXTO</span>
              <p>{selectedEvent.description}</p>
            </div>
            <div className="agenda-detail-footer">
              <div className="avatars">
                {selectedEvent.attendees.map((member, index) => (
                  <Avatar initials={member} tone={index === 1 ? 'lime' : 'dark'} small key={member} />
                ))}
                <span>+{Math.max(0, selectedEvent.attendees.length - 2)}</span>
              </div>
              <small>{selectedEvent.attendees.length > 0 ? `${selectedEvent.attendees.length} pessoa${selectedEvent.attendees.length === 1 ? '' : 's'} envolvida${selectedEvent.attendees.length === 1 ? '' : 's'}` : 'Evento individual'}</small>
            </div>
            {(selectedEvent.missionId || selectedEvent.attachmentName) && (
              <div className="agenda-detail-resource-actions">
                {selectedEvent.missionId && <button onClick={() => onOpenMission(selectedEvent.missionId!)}>ABRIR MISSÃO / ROTEIRO ↗</button>}
                {selectedEvent.attachmentName && <a href={`/api/agenda/${encodeURIComponent(selectedEvent.id)}/attachment`}>BAIXAR {selectedEvent.attachmentName} ↓</a>}
              </div>
            )}
            {canManageSelectedEvent && (
              <div className="agenda-detail-actions">
                <button onClick={() => setEditingEvent(selectedRemoteEvent)}>EDITAR</button>
                <button onClick={() => void removeSelectedEvent()}>EXCLUIR</button>
              </div>
            )}
          </aside>
        ) : (
          <aside className="agenda-detail">
            <div className="agenda-detail-head">
              <span>AGENDA</span>
            </div>
            <h2>Nenhum evento<br />nesse filtro.</h2>
            <p>Altere o filtro ou registre um novo compromisso.</p>
          </aside>
        )}
      </div>

      {isCreateOpen && (
        <CalendarEventModal
          initialDate={selectedCreateDate}
          projects={projects}
          missions={missions}
          team={team}
          canCreateTeam={permissions.canCreateTeam}
          defaultOwnerUserId={scope === 'team' ? selectedOwnerId : accessSession?.id ?? ''}
          defaultVisibility={scope === 'team' ? 'team' : 'personal'}
          onClose={() => {
            setIsCreateOpen(false)
            setSelectedCreateDate(undefined)
          }}
          onCreated={() => {
            setIsCreateOpen(false)
            setSelectedCreateDate(undefined)
            refreshAgenda()
          }}
          onOpenMission={onOpenMission}
        />
      )}
      {editingEvent && (
        <CalendarEventModal
          event={editingEvent}
          projects={projects}
          missions={missions}
          team={team}
          canCreateTeam={permissions.canCreateTeam}
          defaultOwnerUserId={editingEvent.ownerUserId ?? accessSession?.id ?? ''}
          defaultVisibility={editingEvent.visibility}
          onClose={() => setEditingEvent(null)}
          onCreated={() => { setEditingEvent(null); refreshAgenda() }}
          onOpenMission={onOpenMission}
        />
      )}
    </section>
  )
}
