import React, { createContext, useContext, useEffect, useId, useRef, type ReactNode } from 'react'

type ModalShellContextValue = {
  titleId: string
}

const ModalShellContext = createContext<ModalShellContextValue | null>(null)

let pageScrollLockCount = 0
let previousBodyOverflow: string | null = null

function lockPageScroll() {
  if (pageScrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  pageScrollLockCount += 1

  return () => {
    pageScrollLockCount = Math.max(0, pageScrollLockCount - 1)
    if (pageScrollLockCount === 0 && previousBodyOverflow !== null) {
      document.body.style.overflow = previousBodyOverflow
      previousBodyOverflow = null
    }
  }
}

export function isModalCloseKey(key: string) {
  return key === 'Escape'
}

export type ModalSize = 'sm' | 'md' | 'lg'

export function ModalShell({
  accessibleTitle,
  children,
  className = '',
  closeOnEscape = true,
  closeOnOverlayClick = false,
  onClose,
  size = 'md',
}: {
  accessibleTitle: string
  children: ReactNode
  className?: string
  closeOnEscape?: boolean
  closeOnOverlayClick?: boolean
  onClose: () => void
  size?: ModalSize
}) {
  const dialogRef = useRef<HTMLElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const unlockPageScroll = lockPageScroll()
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus({ preventScroll: true }), 0)

    function handleKeyDown(event: KeyboardEvent) {
      if (closeOnEscape && isModalCloseKey(event.key)) {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleKeyDown)
      unlockPageScroll()
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true })
    }
  }, [closeOnEscape, onClose])

  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (closeOnOverlayClick && event.target === event.currentTarget) onClose()
  }

  return (
    <div className="shared-modal-overlay" onClick={handleOverlayClick}>
      <section
        aria-labelledby={titleId}
        aria-label={accessibleTitle}
        aria-modal="true"
        className={`shared-modal-surface shared-modal-surface--${size} ${className}`.trim()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <ModalShellContext.Provider value={{ titleId }}>
          {children}
        </ModalShellContext.Provider>
      </section>
    </div>
  )
}

export function useModalShellTitleId() {
  const context = useContext(ModalShellContext)
  if (!context) throw new Error('ModalHeader must be used inside ModalShell.')
  return context.titleId
}
