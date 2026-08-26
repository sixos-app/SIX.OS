import React, { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'

function joinDescribedBy(...ids: Array<string | undefined>) {
  return ids.filter(Boolean).join(' ') || undefined
}

export function FormField({
  children,
  controlId,
  disabled = false,
  error,
  hint,
  label,
  required = false,
}: {
  children: ReactElement<Record<string, unknown>>
  controlId: string
  disabled?: boolean
  error?: ReactNode
  hint?: ReactNode
  label: ReactNode
  required?: boolean
}) {
  const fieldId = useId()
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined

  if (!isValidElement(children)) throw new Error('FormField requires exactly one form control.')

  const existingDescribedBy = typeof children.props['aria-describedby'] === 'string' ? children.props['aria-describedby'] : undefined
  const control = cloneElement(children, {
    'aria-describedby': joinDescribedBy(existingDescribedBy, hintId, errorId),
    'aria-invalid': error ? true : children.props['aria-invalid'],
    disabled: disabled || children.props.disabled,
    id: controlId,
  })

  return (
    <div className={`shared-form-field${disabled ? ' shared-form-field--disabled' : ''}${error ? ' shared-form-field--error' : ''}`}>
      <label className="shared-form-field__label" htmlFor={controlId}>
        <span>{label}</span>
        {required && <b aria-hidden="true">*</b>}
      </label>
      {control}
      {hint && <small id={hintId} className="shared-form-field__hint">{hint}</small>}
      {error && <p id={errorId} className="shared-form-field__error" role="alert">{error}</p>}
    </div>
  )
}
