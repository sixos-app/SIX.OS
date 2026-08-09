import { useState, useEffect } from 'react'
import { usePermission } from '../../hooks/usePermission'
import { DevelopmentPlanDetail } from './DevelopmentPlanDetail'

export function DevelopmentDashboard({ user }: { user: any }) {
  const { can } = usePermission()
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newPlanTitle, setNewPlanTitle] = useState('')

  const fetchPlans = () => {
    setLoading(true)
    fetch('/api/evolution/development-plans')
      .then(r => r.json())
      .then(d => {
        setPlans(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const handleCreate = async () => {
    if (!newPlanTitle) return
    const res = await fetch('/api/evolution/development-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newPlanTitle })
    })
    if (res.ok) {
      setIsCreating(false)
      setNewPlanTitle('')
      fetchPlans()
    } else {
      alert('Erro ao criar PDI')
    }
  }

  if (selectedPlanId) {
    return <DevelopmentPlanDetail planId={selectedPlanId} onBack={() => setSelectedPlanId(null)} user={user} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>Planos de Desenvolvimento (PDI)</h2>
        {can('development.plans.create') && (
          <button onClick={() => setIsCreating(true)} style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            Novo PDI
          </button>
        )}
      </div>

      {isCreating && (
        <div style={{ background: '#141414', padding: '16px', borderRadius: '8px', border: '1px solid #2a2a2a', display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            placeholder="Título do PDI (ex: PDI 2026)" 
            value={newPlanTitle} 
            onChange={e => setNewPlanTitle(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
          />
          <button onClick={handleCreate} style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Criar</button>
          <button onClick={() => setIsCreating(false)} style={{ background: 'transparent', color: '#888', border: '1px solid #333', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#888' }}>Carregando PDIs...</p>
      ) : plans.length === 0 ? (
        <p style={{ color: '#888' }}>Nenhum PDI encontrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {plans.map(p => (
            <div key={p.id} onClick={() => setSelectedPlanId(p.id)} style={{ background: '#141414', border: '1px solid #2a2a2a', padding: '16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', color: '#fff' }}>{p.title}</h4>
                <div style={{ fontSize: '13px', color: '#888' }}>Colaborador: {p.subjectName}</div>
              </div>
              <div style={{ padding: '4px 8px', background: p.status === 'completed' ? '#1b331b' : '#332b1b', color: p.status === 'completed' ? '#c6ff38' : '#ffc107', borderRadius: '4px', fontSize: '12px', textTransform: 'uppercase' }}>
                {p.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
