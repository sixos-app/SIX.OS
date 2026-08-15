import { useEffect, useState } from 'react'
import type { AppNotification } from '../../data/dashboard'

export function NotificationsPanel({ notifications, activities, readNotificationIds, onClose, onMarkAllRead, onMarkRead }: { notifications: AppNotification[]; activities: AppNotification[]; readNotificationIds: string[]; onClose: () => void; onMarkAllRead: () => void; onMarkRead: (id: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const visibleNotifications = notifications.filter((notification) => filter === 'all' || !readNotificationIds.includes(notification.id))
  const unreadCount = notifications.filter((notification) => !readNotificationIds.includes(notification.id)).length

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="notifications-overlay" role="dialog" aria-modal="true" aria-label="Notificações">
      <aside className="notifications-panel">
        <div className="notifications-head">
          <div>
            <span>ATUALIZAÇÕES</span>
            <h2>Notificações</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar notificações">×</button>
        </div>
        <div className="notifications-controls">
          <div className="segmented-control">
            <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Todas</button>
            <button className={filter === 'unread' ? 'selected' : ''} onClick={() => setFilter('unread')}>Não lidas {unreadCount > 0 && <b>{unreadCount}</b>}</button>
          </div>
          <button onClick={onMarkAllRead}>MARCAR TODAS COMO LIDAS</button>
        </div>
        <div className="notifications-list">
          {visibleNotifications.map((notification) => {
            const isRead = readNotificationIds.includes(notification.id)
            return (
              <button className={`notification-item tone-${notification.tone} ${isRead ? 'read' : ''}`} onClick={() => onMarkRead(notification.id)} key={notification.id}>
                <span className="notification-dot" />
                <span>
                  <small>{notification.category} · {notification.time}</small>
                  <b>{notification.title}</b>
                  <p>{notification.description}</p>
                </span>
                {!isRead && <i>novo</i>}
              </button>
            )
          })}
          {visibleNotifications.length === 0 && <p className="empty-state">Nenhum aviso nesta visão.</p>}
        </div>
        <div className="notifications-activity">
          <span>ATIVIDADE RECENTE</span>
          <div>
            {activities.map((activity) => (
              <article className={`tone-${activity.tone}`} key={activity.id}>
                <i />
                <p>
                  <b>{activity.title}</b>
                  <small>{activity.description}</small>
                </p>
                <time>{activity.time}</time>
              </article>
            ))}
            {activities.length === 0 && <p className="notifications-empty">Nenhuma atividade recente.</p>}
          </div>
        </div>
      </aside>
    </div>
  )
}
