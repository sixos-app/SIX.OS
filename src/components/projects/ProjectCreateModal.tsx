import { useEffect, useState, type FormEvent } from 'react'
import type { ClientIdentity } from '../../data/clientRepository'
import type { Project } from '../../data/dashboard'
import { fetchWorkTypes, type WorkType } from '../../data/workTypeRepository'
import { missionDateTimeInputValue } from '../../utils/formatters'
import { DateTimePicker } from '../shared/DateTimePicker'
import { Icon } from '../shared/Icon'
import { WorkTypeSelector } from '../shared/WorkTypeSelector'

export function ProjectCreateModal({
  clients,
  workTypes: initialWorkTypes,
  onClose,
  onCreate,
}: {
  clients: ClientIdentity[]
  workTypes?: WorkType[]
  onClose: () => void
  onCreate: (input: {
    name: string
    client: string
    deadline: string
    tone: Project['tone']
    workTypeIds?: string[]
  }) => Promise<Project>
}) {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [deadline, setDeadline] = useState(() => missionDateTimeInputValue('Amanhã · 18h'))
  const [tone, setTone] = useState<Project['tone']>('lime')
  const [workTypes, setWorkTypes] = useState<WorkType[]>(initialWorkTypes ?? [])
  const [workTypeIds, setWorkTypeIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!initialWorkTypes || initialWorkTypes.length === 0) {
      fetchWorkTypes().then(setWorkTypes).catch(() => {})
    }
  }, [initialWorkTypes])

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
      await onCreate({ name: name.trim(), client, deadline, tone, workTypeIds })
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
        <div className="mission-create-scroll">
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

          <div className="mission-create-field">
            <span>TIPOS DE TRABALHO HABILITADOS</span>
            <WorkTypeSelector
              mode="multiple"
              workTypes={workTypes}
              selectedIds={workTypeIds}
              onChangeMultiple={setWorkTypeIds}
              onWorkTypeCreated={(newType) => setWorkTypes((prev) => [...prev, newType])}
              placeholder="Selecione ou crie tipos de trabalho para este projeto..."
            />
            <small>Tipos de entregas comuns desta frente (ex.: Design, Vídeo, Redação, Social).</small>
          </div>

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
                <option value="blue">Azul</option>
                <option value="cyan">Ciano</option>
                <option value="turquoise">Turquesa</option>
                <option value="yellow">Amarelo</option>
                <option value="pink">Rosa</option>
                <option value="coral">Coral</option>
                <option value="magenta">Magenta</option>
              </select>
            </label>
          </div>
        </div>
        <footer className="mission-create-footer">
          {error && <p className="admin-dialog-error">{error}</p>}
          <button className="mission-create-submit" type="submit" disabled={clients.length === 0 || isSaving}>
            {isSaving ? 'SALVANDO…' : <>CRIAR PROJETO <span>→</span></>}
          </button>
        </footer>
      </form>
    </div>
  )
}
