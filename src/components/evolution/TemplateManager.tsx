import { useState, useEffect } from 'react'

export function TemplateManager() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/evolution/admin/templates')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Erro ao carregar templates.')
        return d
      })
      .then(d => {
        setTemplates(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ color: '#888' }}>Carregando templates...</div>
  if (error) return (
    <div style={{ color: '#ff5252', background: 'rgba(255, 82, 82, 0.1)', padding: '24px', borderRadius: '8px' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Erro</h3>
      <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', color: '#fff', margin: 0 }}>Gestão de Templates</h2>
        <button style={{ background: '#c6ff38', color: '#000', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
          + Novo Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div style={{ padding: '40px', background: '#141414', border: '1px dashed #333', borderRadius: '12px', textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>📄</div>
          Nenhum template cadastrado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {templates.map(t => (
            <div key={t.id} style={{ padding: '16px', background: '#141414', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
              <div style={{ color: '#fff', fontWeight: 'bold' }}>{t.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
