import { useState, type FormEvent } from 'react'
import { Icon } from '../shared/Icon'

export function AdminClientDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (input: { name: string; shortCode: string; imageDataUrl: string | null }) => Promise<void> }) {
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
      await onCreate({ name: name.trim(), shortCode: shortCode.trim().toLocaleUpperCase('en-US'), imageDataUrl })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  function readImage(file: File | undefined) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 250000) {
      setError('Use PNG, JPEG ou WebP de até 250 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImageDataUrl(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
  }

  return (
    <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Novo cliente">
      <form className="mission-create-dialog admin-create-dialog" onSubmit={submit}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar cadastro de cliente">×</button>
        <span className="mission-create-icon"><Icon name="folder" size={21} /></span>
        <p>NOVO CLIENTE</p>
        <h2>Uma nova parceria<br /><em>começa aqui.</em></h2>
        <label>
          <span>NOME DO CLIENTE</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          <span>SIGLA DO CLIENTE</span>
          <input value={shortCode} onChange={(event) => setShortCode(event.target.value.toLocaleUpperCase('en-US').slice(0, 6))} placeholder="Ex.: SHO" maxLength={6} required />
        </label>
        <label className="client-image-input">
          <span>IMAGEM DO PERFIL (OPCIONAL)</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImage(event.target.files?.[0])} />
          <small>PNG, JPEG ou WebP · até 250 KB</small>
          {imageDataUrl && <img src={imageDataUrl} alt="Prévia do perfil do cliente" />}
        </label>
        {error && <p className="admin-dialog-error">{error}</p>}
        <button className="mission-create-submit" type="submit" disabled={isSaving}>
          {isSaving ? 'SALVANDO…' : <>CRIAR CLIENTE <span>→</span></>}
        </button>
      </form>
    </div>
  )
}
