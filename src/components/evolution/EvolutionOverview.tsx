import { useState, useEffect } from 'react'

export function EvolutionOverview({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const [data, setData] = useState<{ activeCycles: any[], pendingAssignments: number, resultsAvailable: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/evolution/overview')
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
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ color: '#888' }}>Carregando visão geral...</div>
  if (error) return (
    <div style={{ color: '#fff', background: '#2a2a2a', padding: '24px', borderRadius: '8px', border: '1px solid #444', textAlign: 'center' }}>
      <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>Não foi possível carregar esta área.</p>
      <button onClick={() => window.location.reload()} style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Tentar novamente</button>
    </div>
  )
  if (!data) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>Avaliações Pendentes</h3>
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: data.pendingAssignments > 0 ? '#c6ff38' : '#fff', marginBottom: '16px' }}>{data.pendingAssignments}</div>
          <button onClick={() => onNavigate('evaluations')} style={{ background: '#2a2a2a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            Acessar Avaliações
          </button>
        </div>

        <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>Resultados Disponíveis</h3>
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#fff', marginBottom: '16px' }}>{data.resultsAvailable}</div>
          <button onClick={() => onNavigate('results')} style={{ background: '#2a2a2a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            Ver Resultados
          </button>
        </div>

      </div>

      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#fff' }}>Ciclos em Andamento</h3>
        {data.activeCycles.length === 0 ? (
          <p style={{ color: '#888', margin: 0, fontSize: '14px' }}>Nenhum ciclo ativo no momento.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.activeCycles.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>{c.name}</div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>Prazo: {c.responsesDueAt ? new Date(c.responsesDueAt).toLocaleDateString('pt-BR') : 'Sem prazo configurado'}</div>
                </div>
                <div style={{ background: 'rgba(198, 255, 56, 0.1)', color: '#c6ff38', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>ATIVO</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
