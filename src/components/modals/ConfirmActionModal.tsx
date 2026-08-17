export function ConfirmActionModal({
  title,
  message,
  confirmLabel,
  isDestructive = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  isDestructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-button" onClick={onCancel} aria-label="Fechar modal">×</button>
        </div>
        <div className="modal-body" style={{ color: '#a3a3a3' }}>
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="button-secondary" onClick={onCancel}>Cancelar</button>
          <button
            className="button-primary"
            style={isDestructive ? { background: '#f87171', color: '#450a0a', border: '1px solid #f87171' } : {}}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
