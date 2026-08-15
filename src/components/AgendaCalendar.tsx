import { useMemo, useState } from 'react'
import type { CalendarEventRecord } from '../data/agendaRepository'
import type { Mission, TeamMember } from '../data/dashboard'

export type CalendarItemKind = 'meeting' | 'mission' | 'deadline' | 'vacation' | 'birthday' | 'appointment'

export type CalendarItem = {
  id: string
  date: Date
  endDate?: Date
  title: string
  kind: CalendarItemKind
  context?: string
}

const weekdayLabels = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const fullWeekdayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function startDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()) }
function addDays(date: Date, amount: number) { const next = new Date(date); next.setDate(next.getDate() + amount); return next }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }

export function AgendaCalendar({
  events,
  missions,
  team,
  teamScope,
  selectedOwnerId,
  onOwnerChange,
  onSelect,
  onAddOnDate,
}: {
  events: CalendarEventRecord[]
  missions: Mission[]
  team: TeamMember[]
  teamScope: boolean
  selectedOwnerId: string
  onOwnerChange: (id: string) => void
  onSelect: (id: string) => void
  onAddOnDate?: (dateIso: string) => void
}) {
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [cursor, setCursor] = useState(startDay(new Date()))
  const [filter, setFilter] = useState<'all' | CalendarItemKind>('all')
  const today = startDay(new Date())

  const items = useMemo<CalendarItem[]>(() => [
    ...events.map((event) => ({
      id: event.id,
      date: new Date(event.startsAt),
      endDate: event.endsAt ? new Date(event.endsAt) : undefined,
      title: event.title,
      kind: (event.eventType === 'deadline' ? 'deadline' : event.eventType) as CalendarItemKind,
      context: [event.clientName ?? event.projectName, event.location].filter(Boolean).join(' · '),
    })),
    ...missions
      .filter((mission) => mission.dueAt && !Number.isNaN(Date.parse(mission.dueAt)))
      .map((mission) => ({
        id: `agenda-mission-${mission.id}`,
        date: new Date(mission.dueAt!),
        title: `[Missão] ${mission.title}`,
        kind: mission.urgent ? 'deadline' as const : 'mission' as const,
        context: mission.client,
      })),
  ].filter((item) => filter === 'all' || item.kind === filter), [events, missions, filter])

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const monthGridStart = addDays(monthStart, -monthStart.getDay())
  const weekStart = addDays(cursor, -cursor.getDay())
  const days = view === 'month'
    ? Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index))
    : view === 'week'
      ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
      : [cursor]
  const headerDays = view === 'month' ? days.slice(0, 7) : days
  const busiestDay = Math.max(0, ...days.map((day) => items.filter((item) => sameDay(item.date, day)).length))
  const density = busiestDay > 8 ? 'very-dense' : busiestDay > 4 ? 'dense' : 'comfortable'
  const title = view === 'month'
    ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(cursor)
    : view === 'week'
      ? `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${addDays(weekStart, 6).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
      : cursor.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  function move(direction: number) {
    setCursor((current) => view === 'month'
      ? new Date(current.getFullYear(), current.getMonth() + direction, 1)
      : addDays(current, direction * (view === 'week' ? 7 : 1)))
  }

  const hours = Array.from({ length: 14 }, (_, i) => i + 8) // 08:00 to 21:00

  return (
    <section className={`apple-calendar view-${view} density-${density}`}>
      <header className="apple-calendar-header">
        <div>
          <span>AGENDA SINCRONIZADA</span>
          <div className="calendar-title-row">
            <button onClick={() => move(-1)} aria-label="Período anterior">←</button>
            <h2>{title}</h2>
            <button onClick={() => move(1)} aria-label="Próximo período">→</button>
            <button className="calendar-today" onClick={() => setCursor(today)}>HOJE</button>
          </div>
        </div>
        <div className="calendar-header-tools">
          {teamScope && (
            <label>
              COLABORADOR
              <select value={selectedOwnerId} onChange={(event) => onOwnerChange(event.target.value)}>
                <option value="">Toda a equipe</option>
                {team.map((member) => (
                  <option value={member.id} key={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
          )}
          <div className="apple-calendar-views">
            {([['month', 'MENSAL'], ['week', 'SEMANAL'], ['day', 'DIÁRIO']] as const).map(([id, label]) => (
              <button className={view === id ? 'active' : ''} onClick={() => setView(id)} key={id}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <nav className="calendar-filters">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>TODOS</button>
        <button className={filter === 'meeting' ? 'active meeting' : 'meeting'} onClick={() => setFilter('meeting')}>REUNIÕES</button>
        <button className={filter === 'mission' ? 'active mission' : 'mission'} onClick={() => setFilter('mission')}>MISSÕES</button>
        <button className={filter === 'deadline' ? 'active deadline' : 'deadline'} onClick={() => setFilter('deadline')}>PRAZOS</button>
        <button className={filter === 'vacation' ? 'active vacation' : 'vacation'} onClick={() => setFilter('vacation')}>FÉRIAS</button>
        <button className={filter === 'birthday' ? 'active birthday' : 'birthday'} style={{ background: filter === 'birthday' ? '#ffd2e0' : 'transparent', color: filter === 'birthday' ? '#a1144f' : '#666' }} onClick={() => setFilter('birthday')}>ANIVERSÁRIOS</button>
      </nav>

      {view === 'day' ? (
        <div className="calendar-day-timeline-view" style={{ marginTop: '16px', background: '#f7f6f2', borderRadius: '12px', padding: '16px', border: '1px solid #e8e7e1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <b style={{ fontSize: '13px', textTransform: 'capitalize' }}>{cursor.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</b>
            {onAddOnDate && (
              <button
                type="button"
                onClick={() => onAddOnDate(cursor.toISOString())}
                style={{ background: '#171717', color: '#c6ff38', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                NOVO EVENTO NESTE DIA +
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {hours.map((hour) => {
              const hourItems = items.filter((item) => sameDay(item.date, cursor) && item.date.getHours() === hour)
              return (
                <div key={hour} style={{ display: 'grid', gridTemplateColumns: '50px 1fr', gap: '12px', alignItems: 'start', minHeight: '36px', borderBottom: '1px solid #eee' }}>
                  <span style={{ fontSize: '10px', color: '#888', fontWeight: 'bold' }}>{String(hour).padStart(2, '0')}:00</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {hourItems.map((item) => (
                      <button
                        key={item.id}
                        className={`apple-calendar-event ${item.kind}`}
                        onClick={() => onSelect(item.id)}
                        style={{ padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', border: 'none' }}
                      >
                        <b>{item.title}</b>
                        {item.context && <small style={{ opacity: 0.8, marginLeft: '6px' }}>· {item.context}</small>}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {items.filter((item) => sameDay(item.date, cursor)).length === 0 && (
              <p style={{ textAlign: 'center', color: '#888', fontSize: '11px', padding: '20px' }}>Nenhum compromisso agendado para este dia.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="calendar-grid-shell">
          <div className="apple-calendar-weekdays">
            {headerDays.map((day) => (
              <span key={day.toISOString()}>{weekdayLabels[day.getDay()]}</span>
            ))}
          </div>
          <div className="apple-calendar-grid">
            {days.map((day) => {
              const dayItems = items.filter((item) => sameDay(item.date, day))
              return (
                <article
                  className={`apple-calendar-day ${dayItems.length ? 'has-events' : 'is-empty'} ${sameDay(day, today) ? 'today' : ''} ${view === 'month' && day.getMonth() !== cursor.getMonth() ? 'outside' : ''}`}
                  onClick={() => {
                    setCursor(day)
                    if (view === 'month' && sameDay(day, cursor) && onAddOnDate) {
                      onAddOnDate(day.toISOString())
                    }
                  }}
                  key={day.toISOString()}
                >
                  <time>
                    <span>{fullWeekdayLabels[day.getDay()]}</span>
                    {day.getDate()}
                  </time>
                  <div>
                    {dayItems.map((item) => (
                      <button
                        className={`apple-calendar-event ${item.kind}`}
                        title={item.title}
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelect(item.id)
                        }}
                        key={item.id}
                      >
                        <span>{item.kind !== 'vacation' && item.kind !== 'birthday' && item.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <b>{item.title}</b>
                      </button>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
