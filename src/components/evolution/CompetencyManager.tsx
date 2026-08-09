import { useState, useEffect } from 'react'

export function CompetencyManager() {
  const [data, setData] = useState<{ categories: any[], competencies: any[] }>({ categories: [], competencies: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/evolution/admin/competencies')
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

  if (loading) return <div style={{ color: '#888' }}>Carregando competências...</div>
  if (error) return (
    <div style={{ color: '#fff', background: '#2a2a2a', padding: '24px', borderRadius: '8px', border: '1px solid #444', textAlign: 'center' }}>
      <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>Não foi possível carregar esta área.</p>
      <button onClick={() => window.location.reload()} style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Tentar novamente</button>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', color: '#fff', margin: 0 }}>Gestão de Competências</h2>
        <button style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
          + Nova Competência
        </button>
      </div>

      {data.competencies.length === 0 ? (
        <div style={{ padding: '40px', background: '#141414', border: '1px dashed #333', borderRadius: '12px', textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>🎯</div>
          Nenhuma competência cadastrada.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.competencies.map(c => {
            const cat = data.categories.find(cat => cat.id === c.categoryId)
            return (
              <div key={c.id} style={{ padding: '16px', background: '#141414', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ color: '#fff', fontWeight: 'bold' }}>{c.name}</div>
                  <div style={{ color: '#aaa', fontSize: '12px' }}>{cat?.name || 'Sem Categoria'}</div>
                </div>
                <div style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>{c.description}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
