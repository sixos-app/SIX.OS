import { useState, useEffect } from 'react'

export function TemplateManager() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/evolution/admin/templates')
      .then(r => r.json())
      .then(d => {
        setTemplates(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: '#888' }}>Carregando templates...</div>

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
