import { useEffect, useState, type FormEvent } from 'react'
import type { ClientIdentity } from '../../data/clientRepository'
import type { Project } from '../../data/dashboard'
import { missionDateTimeInputValue } from '../../utils/formatters'
import { DateTimePicker } from '../shared/DateTimePicker'
import { Icon } from '../shared/Icon'

export function ProjectCreateModal({ clients, onClose, onCreate }: { clients: ClientIdentity[]; onClose: () => void; onCreate: (input: { name: string; client: string; deadline: string; tone: Project['tone'] }) => Promise<Project> }) {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [deadline, setDeadline] = useState(() => missionDateTimeInputValue('Amanhã · 18h'))
  const [tone, setTone] = useState<Project['tone']>('lime')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !client || !deadline) return
    setIsSaving(true)
    setError('')
    try {
      await onCreate({ name: name.trim(), client, deadline, tone })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar o projeto.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Criar projeto">
      <form className="mission-create-dialog project-create-dialog" onSubmit={submit}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar criação de projeto">×</button>
        <span className="mission-create-icon"><Icon name="folder" size={21} /></span>
        <p>NOVA FRENTE</p>
        <h2>Qual projeto vamos<br /><em>colocar em órbita?</em></h2>
        <label>
          <span>NOME DO PROJETO</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Campanha de Natal" required />
        </label>
        <label>
          <span>CLIENTE</span>
          <select value={client} onChange={(event) => setClient(event.target.value)} required>
            <option value="" disabled>Selecione o cliente</option>
            {clients.map((item) => (
              <option value={item.name} key={item.id}>{item.name} · {item.shortCode ?? 'SEM SIGLA'}</option>
            ))}
          </select>
          <small className="project-create-client-note">Para cadastrar outro cliente, use Administração → Novo cliente.</small>
        </label>
        <div className="mission-create-row">
          <label>
            <span>PRÓXIMO MARCO</span>
            <DateTimePicker value={deadline} onChange={setDeadline} />
          </label>
          <label>
            <span>IDENTIDADE</span>
            <select value={tone} onChange={(event) => setTone(event.target.value as Project['tone'])}>
              <option value="lime">Lima</option>
              <option value="purple">Roxo</option>
              <option value="orange">Laranja</option>
            </select>
          </label>
        </div>
        {error && <p className="admin-dialog-error">{error}</p>}
        <button className="mission-create-submit" type="submit" disabled={clients.length === 0 || isSaving}>
          {isSaving ? 'SALVANDO…' : <>CRIAR PROJETO <span>→</span></>}
        </button>
      </form>
    </div>
  )
}
