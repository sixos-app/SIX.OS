import { useState, useEffect } from 'react'
import { CycleWizard } from './CycleWizard'

export function CycleManager() {
  const [cycles, setCycles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState<any | null>(null)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCycles()
  }, [])

  const fetchCycles = () => {
    setLoading(true)
    setError(null)
    fetch('/api/evolution/admin/cycles')
      .then(async r => {
        let d;
        try {
          d = await r.json()
        } catch(e) {
          throw new Error('Payload inválido da API.')
        }
        if (!r.ok) {
          throw new Error(d?.error || 'Erro ao carregar dados.')
        }
        return d
      })
      .then(d => {
        setCycles(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }

  const handleActivate = async (id: string) => {
    if (!confirm('Ativar ciclo? Isso irá gerar as avaliações automaticamente e permitir que os usuários respondam.')) return
    const r = await fetch(`/api/evolution/admin/cycles/${id}/activate`, { method: 'POST' })
    if (r.ok) {
      const { generatedCount } = await r.json()
      alert(`Ciclo ativado! ${generatedCount} avaliações geradas.`)
      fetchCycles()
    } else {
      const err = await r.json()
      alert('Erro: ' + (err.error || 'Falha ao ativar'))
    }
  }

  if (isCreating) {
    return <CycleWizard onCancel={() => setIsCreating(false)} onCreated={() => { setIsCreating(false); fetchCycles() }} />
  }

  if (selectedCycle) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button onClick={() => setSelectedCycle(null)} style={{ background: '#2a2a2a', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>← Voltar</button>
          <h2 style={{ fontSize: '20px', color: '#fff', margin: 0 }}>Detalhes do Ciclo: {selectedCycle.name}</h2>
        </div>
        <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '32px', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <p style={{ color: '#888', margin: '0 0 8px 0' }}>Status</p>
              <span style={{ background: '#2a2a2a', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', color: selectedCycle.status === 'active' ? '#c6ff38' : '#ffa500' }}>{selectedCycle.status.toUpperCase()}</span>
            </div>
            <div>
              <p style={{ color: '#888', margin: '0 0 8px 0' }}>Prazo das Respostas</p>
              <strong>{selectedCycle.responsesDueAt ? new Date(selectedCycle.responsesDueAt).toLocaleDateString() : 'N/A'}</strong>
            </div>
            <div>
              <p style={{ color: '#888', margin: '0 0 8px 0' }}>Disponibilidade dos Resultados</p>
              <strong>{selectedCycle.resultsAvailableAt ? new Date(selectedCycle.resultsAvailableAt).toLocaleDateString() : 'N/A'}</strong>
            </div>
          </div>

          <div style={{ padding: '24px', background: '#0a0a0a', borderRadius: '8px', border: '1px solid #333' }}>
            <h4 style={{ margin: '0 0 16px 0' }}>Participantes e Assignments</h4>
            <p style={{ color: '#888', fontSize: '14px' }}>A gestão manual avançada de participantes será liberada em breve. O banco de dados já possui os vínculos criados no seed ou gerados automaticamente na ativação.</p>
            {selectedCycle.status === 'draft' && (
              <div style={{ marginTop: '24px' }}>
                <button onClick={() => handleActivate(selectedCycle.id)} style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Ativar Ciclo Agora
                </button>
                <p style={{ color: '#ffa500', fontSize: '12px', marginTop: '8px' }}>Isso gerará os assignments baseados nas configurações de liderança escolhidas.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div style={{ color: '#888', padding: '20px' }}>Carregando ciclos...</div>
  if (error) return (
    <div style={{ color: '#fff', background: '#2a2a2a', padding: '24px', borderRadius: '8px', border: '1px solid #444', textAlign: 'center' }}>
      <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>Não foi possível carregar esta área.</p>
      <button onClick={() => window.location.reload()} style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Tentar novamente</button>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', color: '#fff', margin: 0 }}>Gestão de Ciclos</h2>
        <button 
          onClick={() => setIsCreating(true)}
          style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          + Novo Ciclo
        </button>
      </div>

      {cycles.length === 0 ? (
        <div style={{ padding: '40px', background: '#141414', border: '1px dashed #333', borderRadius: '12px', textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>📋</div>
          Nenhum ciclo cadastrado. Crie um novo ciclo para iniciar.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cycles.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: '#141414', borderRadius: '12px', border: '1px solid #2a2a2a' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff' }}>{c.name}</h3>
                <div style={{ fontSize: '13px', color: '#888' }}>
                  Status: <strong style={{ color: c.status === 'active' ? '#c6ff38' : c.status === 'draft' ? '#ffa500' : '#aaa' }}>{c.status.toUpperCase()}</strong> 
                  &nbsp;•&nbsp; Prazo: {c.responsesDueAt ? new Date(c.responsesDueAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {c.status === 'draft' && (
                  <button onClick={() => handleActivate(c.id)} style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Ativar Ciclo
                  </button>
                )}
                <button onClick={() => setSelectedCycle(c)} style={{ background: '#2a2a2a', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>Detalhes</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
