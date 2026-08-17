import { useEffect, useState, type FormEvent } from 'react'
import type { TeamMember } from '../../data/dashboard'
import { MentionTextarea } from '../shared/MentionTextarea'

export function KudoModal({ team, onClose, onSent }: { team: TeamMember[]; onClose: () => void; onSent: () => void }) {
  const [targetName, setTargetName] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!targetName || !reason.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetName, reason }),
      })
      if (!res.ok) throw new Error('Não foi possível enviar kudos.')
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar kudo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-edit-overlay" role="dialog" aria-modal="true" aria-label="Enviar Kudos">
      <form className="profile-edit-dialog" onSubmit={handleSubmit} style={{ width: 'min(480px, 100%)' }}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar modal de kudos">×</button>
        <h2>Mandar <em>Kudos ✦</em></h2>
        <div className="profile-edit-form">
          <label>
            <span>COLEGA DE EQUIPE</span>
            <select value={targetName} onChange={(e) => setTargetName(e.target.value)} required>
              <option value="" disabled>Selecione um colega</option>
              {team.map((m) => (
                <option value={m.name} key={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>MOTIVO DO ELOGIO / RECONHECIMENTO</span>
            <MentionTextarea
              value={reason}
              onChange={setReason}
              teamMembers={team}
              placeholder="Descreva por que você está elogiando este colega e mencione com @..."
              maxLength={200}
              required
              rows={3}
            />
          </label>
          {error && <p style={{ margin: 0, color: '#d63031', fontSize: '11px' }}>{error}</p>}
          <button className="profile-edit-submit" style={{ background: '#8b73ff', color: '#fff' }} type="submit" disabled={saving}>
            {saving ? 'ENVIANDO...' : 'ENVIAR KUDOS ✦'}
          </button>
        </div>
      </form>
    </div>
  )
}
