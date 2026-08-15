import { useEffect, useState, type FormEvent } from 'react'
import { updateProfile, type UserProfile } from '../../data/profileRepository'

export function ProfileEditModal({ profile, onClose, onSaved }: { profile: UserProfile | undefined; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(profile?.name ?? '')
  const [socialName, setSocialName] = useState(profile?.socialName ?? '')
  const [customRole, setCustomRole] = useState(profile?.customRole ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [highlightColor, setHighlightColor] = useState(profile?.highlightColor ?? '#c6ff38')
  const [signature, setSignature] = useState(profile?.signature ?? '')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setErrorMessage('')
    try {
      await updateProfile({
        name: name.trim() || undefined,
        socialName: socialName.trim() || null,
        customRole: customRole.trim() || null,
        bio: bio.trim() || null,
        highlightColor: highlightColor || '#c6ff38',
        signature: signature.trim() || null,
      } as Partial<UserProfile>)
      onSaved()
    } catch (reason: unknown) {
      setErrorMessage(reason instanceof Error ? reason.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-edit-overlay" role="dialog" aria-modal="true" aria-label="Editar perfil">
      <form className="profile-edit-dialog" onSubmit={handleSubmit}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar edição de perfil">×</button>
        <h2>Editar <em>perfil</em></h2>
        <div className="profile-edit-form">
          <div className="profile-edit-row">
            <label>
              <span>NOME</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </label>
            <label>
              <span>NOME SOCIAL</span>
              <input value={socialName} onChange={(e) => setSocialName(e.target.value)} placeholder="Como gostaria de ser chamado" />
            </label>
          </div>
          <div className="profile-edit-row">
            <label>
              <span>CARGO DE EXIBIÇÃO</span>
              <input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="Ex.: Redator Principal" />
            </label>
            <label>
              <span>COR DE DESTAQUE <span className="profile-color-preview" style={{ background: highlightColor }} /></span>
              <input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} />
            </label>
          </div>
          <label>
            <span>BIO</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte um pouco sobre você..." maxLength={1000} />
          </label>
          <label>
            <span>ASSINATURA</span>
            <textarea value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Sua assinatura profissional" maxLength={2000} />
          </label>
          {errorMessage && <p style={{ margin: 0, color: '#d63031', fontSize: '11px' }}>{errorMessage}</p>}
          <button className="profile-edit-submit" type="submit" disabled={saving}>
            {saving ? 'SALVANDO…' : 'SALVAR ALTERAÇÕES'} <span>→</span>
          </button>
        </div>
      </form>
    </div>
  )
}
