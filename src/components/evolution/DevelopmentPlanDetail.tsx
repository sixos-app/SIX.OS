import { useState, useEffect } from 'react'

export function DevelopmentPlanDetail({ planId, onBack, user }: { planId: string; onBack: () => void; user: any }) {
  const [plan, setPlan] = useState<any>(null)
  const [goals, setGoals] = useState<any[]>([])
  const [actions, setActions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [newGoalTitle, setNewGoalTitle] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      const pRes = await fetch(`/api/evolution/development-plans/${planId}`)
      if (!pRes.ok) throw new Error('Not found')
      const p = await pRes.json()
      
      const gRes = await fetch(`/api/evolution/development-plans/${planId}/goals`)
      const g = await gRes.json()

      const aRes = await fetch(`/api/evolution/development-plans/${planId}/actions`)
      const a = await aRes.json()

      setPlan(p)
      setGoals(g || [])
      setActions(a || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [planId])

  const handleAddGoal = async () => {
    if (!newGoalTitle) return
    const res = await fetch(`/api/evolution/development-plans/${planId}/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newGoalTitle })
    })
    if (res.ok) {
      setNewGoalTitle('')
      fetchData()
    }
  }

  if (loading) return <div style={{ color: '#888' }}>Carregando detalhes do PDI...</div>
  if (!plan) return <div style={{ color: '#ff5252' }}>Erro ao carregar plano.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onBack} style={{ background: 'transparent', color: '#c6ff38', border: '1px solid #c6ff38', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>&larr; Voltar</button>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#fff' }}>{plan.title}</h2>
          <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>Status: {plan.status}</div>
        </div>
      </div>

      <div style={{ background: '#141414', border: '1px solid #2a2a2a', padding: '24px', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '16px' }}>Metas e Ações</h3>
        
        {plan.status !== 'completed' && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <input 
              type="text" 
              placeholder="Nova Meta (Ex: Aprofundar em Typescript)"
              value={newGoalTitle}
              onChange={e => setNewGoalTitle(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
            />
            <button onClick={handleAddGoal} style={{ background: '#2a2a2a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Adicionar Meta</button>
          </div>
        )}

        {goals.length === 0 ? (
          <p style={{ color: '#888' }}>Nenhuma meta definida.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {goals.map(g => (
              <div key={g.id} style={{ background: '#1a1a1a', border: '1px solid #333', padding: '16px', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#c6ff38', fontSize: '15px' }}>{g.title}</h4>
                <div style={{ color: '#aaa', fontSize: '13px' }}>Status: {g.status} | Prioridade: {g.priority}</div>
                
                <div style={{ marginTop: '16px', borderTop: '1px dashed #333', paddingTop: '16px' }}>
                  <h5 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '13px' }}>Plano de Ação:</h5>
                  {actions.filter(a => a.goalId === g.id).length === 0 ? (
                    <div style={{ color: '#888', fontSize: '12px' }}>Sem ações cadastradas.</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#ddd', fontSize: '13px' }}>
                      {actions.filter(a => a.goalId === g.id).map(a => (
                        <li key={a.id} style={{ marginBottom: '4px' }}>{a.title} ({a.status})</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
