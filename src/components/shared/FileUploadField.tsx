import React, { useId, useRef, useState, type ReactNode } from 'react'

function formatMaximumSize(maxBytes: number) {
  if (maxBytes < 1024 * 1024) return `${Math.ceil(maxBytes / 1024)} KB`
  return `${(maxBytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

export function FileUploadField({
  accept,
  buttonLabel = 'SELECIONAR ARQUIVO',
  disabled = false,
  error,
  hint,
  label,
  maxBytes,
  onChange,
  preview,
  validateFile,
}: {
  accept?: string
  buttonLabel?: string
  disabled?: boolean
  error?: ReactNode
  hint?: ReactNode
  label: ReactNode
  maxBytes?: number
  onChange?: (file: File | null) => void
  preview?: (file: File) => ReactNode
  validateFile?: (file: File) => string | undefined
}) {
  const inputId = useId()
  const hintId = hint || maxBytes ? `${inputId}-hint` : undefined
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [selectionError, setSelectionError] = useState('')
  const effectiveError = error || selectionError
  const errorId = effectiveError ? `${inputId}-error` : undefined

  function selectFile(nextFile: File | null) {
    const validationError = nextFile ? validateFile?.(nextFile) ?? (maxBytes && nextFile.size > maxBytes ? `O arquivo deve ter no máximo ${formatMaximumSize(maxBytes)}.` : undefined) : undefined
    if (validationError) {
      setSelectionError(validationError)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setSelectionError('')
    setFile(nextFile)
    onChange?.(nextFile)
  }

  function clearFile() {
    if (inputRef.current) inputRef.current.value = ''
    selectFile(null)
  }

  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`shared-file-upload${file ? ' shared-file-upload--filled' : ''}${effectiveError ? ' shared-file-upload--error' : ''}${disabled ? ' shared-file-upload--disabled' : ''}`}>
      <label className="shared-file-upload__label" htmlFor={inputId}>{label}</label>
      <input
        accept={accept}
        aria-describedby={describedBy}
        aria-invalid={effectiveError ? true : undefined}
        className="shared-file-upload__native-input"
        disabled={disabled}
        id={inputId}
        onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        ref={inputRef}
        type="file"
      />
      <div className="shared-file-upload__control">
        <button className="shared-file-upload__select" type="button" disabled={disabled} onClick={() => inputRef.current?.click()} aria-controls={inputId}>
          {buttonLabel}
        </button>
        <span className="shared-file-upload__filename" aria-live="polite">{file ? file.name : 'Nenhum arquivo selecionado'}</span>
        {file && <button className="shared-file-upload__clear" type="button" onClick={clearFile} aria-label={`Remover ${file.name}`}>REMOVER</button>}
      </div>
      {(hint || maxBytes) && <small id={hintId} className="shared-file-upload__hint">{hint}{hint && maxBytes ? ' · ' : ''}{maxBytes ? `Máximo ${formatMaximumSize(maxBytes)}` : ''}</small>}
      {effectiveError && <p id={errorId} className="shared-file-upload__error" role="alert">{effectiveError}</p>}
      {file && preview && <div className="shared-file-upload__preview">{preview(file)}</div>}
    </div>
  )
}
