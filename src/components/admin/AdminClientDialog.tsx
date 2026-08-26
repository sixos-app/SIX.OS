import React, { useState, type FormEvent } from 'react'
import { Icon } from '../shared/Icon'
import { FileUploadField } from '../shared/FileUploadField'
import { FormField } from '../shared/FormField'
import { ModalHeader } from '../shared/ModalHeader'
import { ModalShell } from '../shared/ModalShell'

type AdminClientInput = { name: string; shortCode: string; imageDataUrl: string | null }

export function buildAdminClientInput(input: AdminClientInput): AdminClientInput {
  return {
    name: input.name.trim(),
    shortCode: input.shortCode.trim().toLocaleUpperCase('en-US'),
    imageDataUrl: input.imageDataUrl,
  }
}

export function validateAdminClientImage(file: Pick<File, 'size' | 'type'>) {
  return !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 250000
    ? 'Use PNG, JPEG ou WebP de até 250 KB.'
    : undefined
}

export function AdminClientDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (input: AdminClientInput) => Promise<void> }) {
  const [name, setName] = useState('')
  const [shortCode, setShortCode] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      await onCreate(buildAdminClientInput({ name, shortCode, imageDataUrl }))
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleImageSelection(file: File | null) {
    setError('')
    if (!file) {
      setImageDataUrl(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImageDataUrl(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  return (
    <ModalShell accessibleTitle="Novo cliente" onClose={onClose}>
      <form className="admin-client-dialog" onSubmit={submit}>
        <ModalHeader
          closeLabel="Fechar cadastro de cliente"
          eyebrow="NOVO CLIENTE"
          icon={<Icon name="folder" size={21} />}
          onClose={onClose}
          title={<>Uma nova parceria<br /><em>começa aqui.</em></>}
        />
        <div className="admin-client-dialog__form">
          <FormField controlId="admin-client-name" label="NOME DO CLIENTE" required>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} required />
          </FormField>
          <FormField controlId="admin-client-short-code" label="SIGLA DO CLIENTE" required hint="Use de 2 a 6 caracteres.">
            <input value={shortCode} onChange={(event) => setShortCode(event.target.value.toLocaleUpperCase('en-US').slice(0, 6))} placeholder="Ex.: SHO" maxLength={6} required />
          </FormField>
          <FileUploadField
            accept="image/png,image/jpeg,image/webp"
            hint="PNG, JPEG ou WebP · até 250 KB"
            label="IMAGEM DO PERFIL (OPCIONAL)"
            onChange={handleImageSelection}
            preview={() => imageDataUrl ? <img src={imageDataUrl} alt="Prévia do perfil do cliente" /> : null}
            validateFile={validateAdminClientImage}
          />
          {error && <p className="admin-client-dialog__error" role="alert">{error}</p>}
          <button className="admin-client-dialog__submit" type="submit" disabled={isSaving}>
            {isSaving ? 'SALVANDO…' : <>CRIAR CLIENTE <span>→</span></>}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
