import React, { type ReactNode } from 'react'
import { useModalShellTitleId } from './ModalShell'

export function ModalHeader({
  closeLabel = 'Fechar modal',
  eyebrow,
  icon,
  onClose,
  subtitle,
  title,
}: {
  closeLabel?: string
  eyebrow?: ReactNode
  icon?: ReactNode
  onClose: () => void
  subtitle?: ReactNode
  title: ReactNode
}) {
  const titleId = useModalShellTitleId()

  return (
    <header className="shared-modal-header">
      <div className="shared-modal-header__copy">
        {icon && <span className="shared-modal-header__icon">{icon}</span>}
        {eyebrow && <p className="shared-modal-header__eyebrow">{eyebrow}</p>}
        <h2 id={titleId} className="shared-modal-header__title">{title}</h2>
        {subtitle && <p className="shared-modal-header__subtitle">{subtitle}</p>}
      </div>
      <button className="shared-modal-header__close" type="button" onClick={onClose} aria-label={closeLabel}>×</button>
    </header>
  )
}
