import { useEffect } from 'react'

export function ConfirmActionModal({
  title,
  message,
  confirmLabel = 'EXCLUIR',
  cancelLabel = 'CANCELAR',
  badgeLabel,
  isDestructive = true,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  badgeLabel?: string
  isDestructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onCancel])

  return (
    <div
      className="confirm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="confirm-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close-button" type="button" onClick={onCancel} aria-label="Fechar confirmação">×</button>
        <p className="confirm-modal-badge" style={{ color: isDestructive ? '#f87171' : '#c6ff38' }}>
          {badgeLabel || (isDestructive ? 'AÇÃO DESTRUTIVA' : 'CONFIRMAÇÃO')}
        </p>
        <h2 className="confirm-modal-title">{title}</h2>
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button className="dialog-cancel-button" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={isDestructive ? 'mission-delete-button' : 'mission-create-submit'}
            type="button"
            onClick={onConfirm}
            style={isDestructive ? { marginTop: 0 } : { width: 'auto', marginTop: 0, padding: '11px 22px' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
