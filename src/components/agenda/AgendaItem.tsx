import type { AgendaEvent } from '../../data/dashboard'

export function AgendaItem({ event }: { event: AgendaEvent }) {
  return (
    <div className="agenda-item">
      <span className={`agenda-dot ${event.tone}`} />
      <time>{event.time}</time>
      <p>
        <b>{event.title}</b>
        <small>{event.subtitle}</small>
      </p>
    </div>
  )
}
