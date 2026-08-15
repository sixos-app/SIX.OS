import { useState, type FormEvent } from 'react'

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!newPassword || newPassword.length < 12) {
      setMessage('A nova senha deve ter no mínimo 12 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('A confirmação de senha não confere.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() as { error?: string } : null
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível alterar a senha.')
      setSuccess(true)
      setMessage('Senha alterada. Entre novamente com a nova credencial.')
      setTimeout(() => window.location.assign('/'), 1500)
    } catch (reason) {
      setSuccess(false)
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível alterar a senha.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="generic-modal-overlay" role="dialog" aria-modal="true">
      <div className="generic-modal-dialog">
        <button className="close-button" type="button" onClick={onClose}>×</button>
        <div className="generic-modal-head">
          <h2>Alterar <em>Senha</em></h2>
        </div>
        <form className="generic-modal-form" onSubmit={handleSubmit}>
          <label>
            <span>SENHA ATUAL</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </label>
          <label>
            <span>NOVA SENHA</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={12} required />
          </label>
          <label>
            <span>CONFIRMAR NOVA SENHA</span>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </label>
          {message && <p style={{ color: success ? '#c6ff38' : '#ff5936', fontSize: '11px', margin: 0 }}>{message}</p>}
          <button className="generic-modal-submit" type="submit" disabled={saving || success}>{saving ? 'ATUALIZANDO…' : 'ATUALIZAR SENHA →'}</button>
        </form>
      </div>
    </div>
  )
}
