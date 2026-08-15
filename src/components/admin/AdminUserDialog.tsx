import { useEffect, useState, type FormEvent } from 'react'
import type { AdminOverview, CreateAdminUserInput } from '../../data/adminRepository'
import { Icon } from '../shared/Icon'

export function AdminUserDialog({ roles, onClose, onCreate }: { roles: AdminOverview['roles']; onClose: () => void; onCreate: (input: CreateAdminUserInput) => Promise<void> }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [initialPassword, setInitialPassword] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['specialist'])
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState<CreateAdminUserInput['status']>('active')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    void fetch('/api/admin/departments', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar os departamentos.')
        return await response.json() as Array<{ id: string; name: string; is_active: boolean }>
      })
      .then((items) => {
        const activeDepartments = items.filter((item) => item.is_active !== false)
        setDepartments(activeDepartments)
        setDepartment((current) => current || activeDepartments[0]?.id || '')
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  function toggleRole(code: string) {
    setError('')
    setSelectedRoles((current) => {
      if (current.includes(code)) return current.length === 1 ? current : current.filter((item) => item !== code)
      if (current.length >= 5) {
        setError('Cada colaborador pode ter no máximo cinco cargos.')
        return current
      }
      return [...current, code]
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!department) {
      setError('Selecione um departamento antes de criar o colaborador.')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      await onCreate({ name: name.trim(), email: email.trim(), username: username.trim(), roles: selectedRoles, initialPassword, department, status })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o colaborador.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mission-create-overlay" role="dialog" aria-modal="true" aria-label="Novo colaborador">
      <form className="mission-create-dialog admin-create-dialog" onSubmit={submit}>
        <button className="close-button" type="button" onClick={onClose} aria-label="Fechar cadastro de colaborador">×</button>
        <span className="mission-create-icon"><Icon name="people" size={21} /></span>
        <p>CADASTRO COMPLETO DE COLABORADOR</p>
        <h2>Quem vai tornar<br /><em>possível?</em></h2>
        <label>
          <span>NOME COMPLETO</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Lucas Mendes" required />
        </label>
        <div className="mission-create-row">
          <label>
            <span>E-MAIL PROFISSIONAL</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="nome@agenciasix.com.br" required />
          </label>
          <label>
            <span>SENHA INICIAL</span>
            <input value={initialPassword} onChange={(event) => setInitialPassword(event.target.value)} type="password" minLength={12} placeholder="Mínimo 12 caracteres" required />
          </label>
        </div>
        <label>
          <span>CARGOS & PERMISSÕES · {selectedRoles.length}/5</span>
          <div className="admin-role-picker" role="group" aria-label="Selecione até cinco cargos">
            {roles.map((item) => {
              const selected = selectedRoles.includes(item.code)
              return (
                <button className={selected ? 'selected' : ''} type="button" key={item.code} aria-pressed={selected} onClick={() => toggleRole(item.code)}>
                  <i>{selected ? '✓' : '+'}</i>
                  <span><b>{item.name}</b><small>{item.permissionCount} permissões</small></span>
                </button>
              )
            })}
          </div>
          <small className="admin-role-picker-note">As permissões dos cargos selecionados serão somadas.</small>
        </label>
        <div className="mission-create-row">
          <label>
            <span>LOGIN (OPCIONAL)</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="nome.sobrenome" />
          </label>
          <label>
            <span>STATUS INICIAL</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as CreateAdminUserInput['status'])}>
              <option value="active">Ativo (Permitir Acesso)</option>
              <option value="blocked">Bloqueado</option>
              <option value="inactive">Desativado</option>
            </select>
          </label>
        </div>
        <label>
          <span>DEPARTAMENTO</span>
          <select value={department} onChange={(event) => setDepartment(event.target.value)} required>
            <option value="">Selecione um departamento</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        {error && <p className="admin-dialog-error">{error}</p>}
        <button className="mission-create-submit" type="submit" disabled={isSaving || departments.length === 0}>
          {isSaving ? 'SALVANDO…' : <>CRIAR COLABORADOR <span>→</span></>}
        </button>
      </form>
    </div>
  )
}
