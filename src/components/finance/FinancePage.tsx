import { useEffect, useState } from 'react'
import { usePermission } from '../../hooks/usePermission'
import { ConfirmActionModal } from '../modals/ConfirmActionModal'
import { Icon } from '../shared/Icon'

type CostCenterType = 'general' | 'department' | 'project' | 'mission'
type CostCenter = { id: string; name: string; code: string; type: CostCenterType; description: string | null }
type LoadState = 'loading' | 'ready' | 'empty' | 'unauthenticated' | 'forbidden' | 'error'

const typeLabels: Record<CostCenterType, string> = {
  general: 'Geral', department: 'Departamento', project: 'Projeto', mission: 'Missão',
}

function requestErrorMessage(response: Response) {
  if (response.status === 401) return 'Sua sessão não está mais disponível. Entre novamente para continuar.'
  if (response.status === 403) return 'Seu acesso financeiro não permite consultar centros de custo.'
  return 'Não foi possível carregar os centros de custo agora.'
}

export function FinancePage() {
  const { can, hasScope } = usePermission()
  const canViewFinance = can('finance.view') || can('finance.manage')
  const canManageCenters = can('finance.manage') && hasScope('finance.manage', 'all')
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [type, setType] = useState<CostCenterType>('general')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CostCenter | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function loadCostCenters() {
    setLoadState('loading')
    setMessage('')
    try {
      const response = await fetch('/api/cost-centers', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      if (!response.ok) {
        setLoadState(response.status === 401 ? 'unauthenticated' : response.status === 403 ? 'forbidden' : 'error')
        setMessage(requestErrorMessage(response))
        return
      }
      const centers = await response.json() as CostCenter[]
      setCostCenters(Array.isArray(centers) ? centers : [])
      setLoadState(centers.length ? 'ready' : 'empty')
    } catch {
      setLoadState('error')
      setMessage('Não foi possível carregar os centros de custo agora.')
    }
  }

  useEffect(() => {
    if (!canViewFinance) return
    void loadCostCenters()
  }, [canViewFinance])

  async function createCostCenter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManageCenters || isSaving) return
    setMessage('')
    setIsSaving(true)
    try {
      const response = await fetch('/api/cost-centers', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), code: code.trim(), type, description: description.trim() || undefined }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string }
        setMessage(payload.error ?? requestErrorMessage(response))
        return
      }
      const created = await response.json() as CostCenter
      setCostCenters((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      setLoadState('ready')
      setName('')
      setCode('')
      setType('general')
      setDescription('')
    } catch {
      setMessage('Não foi possível criar o centro de custo agora.')
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteCostCenter() {
    if (!pendingDelete || !canManageCenters || isDeleting) return
    setIsDeleting(true)
    setMessage('')
    try {
      const response = await fetch(`/api/cost-centers/${encodeURIComponent(pendingDelete.id)}`, { method: 'DELETE', headers: { Accept: 'application/json' } })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string }
        setMessage(payload.error ?? 'Não foi possível excluir o centro de custo.')
        return
      }
      const remainingCenters = costCenters.filter((center) => center.id !== pendingDelete.id)
      setCostCenters(remainingCenters)
      setLoadState(remainingCenters.length ? 'ready' : 'empty')
      setPendingDelete(null)
    } catch {
      setMessage('Não foi possível excluir o centro de custo agora.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!canViewFinance) {
    return <div className="admin-page" style={{ padding: '34px', color: '#fff' }}>Você não tem permissão para acessar o financeiro.</div>
  }

  return (
    <div className="admin-page">
      <section className="admin-intro">
        <div>
          <span>GESTÃO FINANCEIRA</span>
          <h1>Centros de <em>custo.</em></h1>
          <p>Organize os vínculos financeiros das missões com os centros autorizados da sua organização.</p>
        </div>
      </section>

      <section style={{ background: '#191919', border: '1px solid #333', borderRadius: '12px', padding: '24px', marginTop: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: '40px', height: '40px', background: '#333', color: '#c6ff38', borderRadius: '8px' }}><Icon name="pie-chart" size={20} /></span>
          <div><h3 style={{ color: '#fff', margin: 0 }}>Centros de custos</h3><p style={{ color: '#888', fontSize: '12px', margin: '4px 0 0' }}>Dados carregados diretamente da sua organização.</p></div>
        </div>

        {loadState === 'loading' && <p style={{ color: '#888', fontSize: '12px' }}>Carregando centros de custo…</p>}
        {(loadState === 'unauthenticated' || loadState === 'forbidden' || loadState === 'error') && <div style={{ color: '#ffb0b0', fontSize: '12px' }}><p>{message}</p>{loadState === 'error' && <button type="button" onClick={() => { void loadCostCenters() }}>TENTAR NOVAMENTE</button>}</div>}
        {loadState === 'empty' && <p style={{ color: '#888', fontSize: '12px' }}>Nenhum centro de custo cadastrado.</p>}
        {loadState === 'ready' && <div style={{ display: 'grid', gap: '8px' }}>
          {costCenters.map((center) => <article key={center.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #303030', borderRadius: '8px', padding: '12px' }}>
            <div><strong style={{ color: '#f8f8f2' }}>{center.name}</strong><small style={{ display: 'block', color: '#888', marginTop: '3px' }}>{center.code} · {typeLabels[center.type]}</small>{center.description && <small style={{ display: 'block', color: '#aaa', marginTop: '5px' }}>{center.description}</small>}</div>
            {canManageCenters && <button type="button" className="mission-delete-button" style={{ marginTop: 0 }} onClick={() => setPendingDelete(center)}>EXCLUIR</button>}
          </article>)}
        </div>}
      </section>

      {canManageCenters && loadState !== 'unauthenticated' && loadState !== 'forbidden' && <section style={{ background: '#191919', border: '1px solid #333', borderRadius: '12px', padding: '24px', marginTop: '20px' }}>
        <h3 style={{ color: '#fff', margin: '0 0 16px' }}>Novo centro de custo</h3>
        <form onSubmit={(event) => { void createCostCenter(event) }} style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <label><span>NOME</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label><span>CÓDIGO</span><input value={code} onChange={(event) => setCode(event.target.value)} required /></label>
            <label><span>TIPO</span><select value={type} onChange={(event) => setType(event.target.value as CostCenterType)}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label><span>DESCRIÇÃO (OPCIONAL)</span><input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          {message && loadState !== 'error' && <p className="mission-create-error" role="alert">{message}</p>}
          <div><button className="mission-create-submit" type="submit" disabled={isSaving}>{isSaving ? 'CRIANDO…' : 'CRIAR CENTRO DE CUSTO'}</button></div>
        </form>
      </section>}

      {pendingDelete && <ConfirmActionModal title="Excluir centro de custo?" message={`“${pendingDelete.name}” deixará de estar disponível para novos vínculos.`} confirmLabel={isDeleting ? 'EXCLUINDO…' : 'EXCLUIR'} onConfirm={() => { void deleteCostCenter() }} onCancel={() => { if (!isDeleting) setPendingDelete(null) }} />}
    </div>
  )
}
