import { useState, useEffect } from 'react'

type Level = {
  id: string
  code: string
  name: string
  sort_order: number
  is_active: boolean
}

export function LevelManager() {
  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Level | null>(null)
  const [form, setForm] = useState({ code: '', name: '', sort_order: 0, is_active: true })
  const [error, setError] = useState('')

  useEffect(() => {
    loadLevels()
  }, [])

  async function loadLevels() {
    try {
      const res = await fetch('/api/admin/professional-levels')
      if (res.ok) {
        setLevels(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const method = editing && editing.id ? 'PATCH' : 'POST'
      const url = editing && editing.id ? `/api/admin/professional-levels/${editing.id}` : '/api/admin/professional-levels'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar')
        return
      }

      setEditing(null)
      setForm({ code: '', name: '', sort_order: 0, is_active: true })
      loadLevels()
    } catch {
      setError('Erro de conexão')
    }
  }

  function handleEdit(lvl: Level) {
    setEditing(lvl)
    setForm({ code: lvl.code, name: lvl.name, sort_order: lvl.sort_order, is_active: lvl.is_active })
  }

  function handleCancel() {
    setEditing(null)
    setForm({ code: '', name: '', sort_order: 0, is_active: true })
    setError('')
  }

  if (loading) return <div style={{ color: '#888' }}>Carregando níveis...</div>

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: '#1c1c1c',
    border: '1px solid #333',
    color: '#fff',
    borderRadius: '6px',
    marginTop: '6px',
    fontSize: '13px'
  }

  return (
    <div className="admin-manager">
      <header className="admin-manager-head">
        <h3>Níveis Profissionais</h3>
        {!editing && (
          <button className="admin-manager-create-button" onClick={() => setEditing({ id: '', code: '', name: '', sort_order: 0, is_active: true })}>
            + Novo Nível
          </button>
        )}
      </header>

      <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid #2a2a2a', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a2a', background: '#1a1a1a' }}>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold', width: '60px' }}>Hierarquia</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Nível</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Código</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Status</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {levels.map(lvl => (
              <tr key={lvl.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ background: '#333', color: '#c6ff38', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                    {lvl.sort_order}
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{lvl.name}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ background: '#333', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#aaa', fontFamily: 'monospace' }}>{lvl.code}</span>
                </td>
                <td style={{ padding: '16px' }}>
                  {lvl.is_active ? <span style={{ color: '#4CAF50', fontSize: '13px' }}>Ativo</span> : <span style={{ color: '#ff5252', fontSize: '13px' }}>Inativo</span>}
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button onClick={() => handleEdit(lvl)} style={{ padding: '6px 12px', background: 'none', border: '1px solid #444', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <form onSubmit={handleSave} style={{ marginTop: '24px', padding: '24px', background: '#1a1a1a', borderRadius: '12px', border: '1px solid #2a2a2a' }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#fff' }}>{editing.id ? 'Editar Nível' : 'Novo Nível'}</h4>
          {error && <div style={{ color: '#ff5252', marginBottom: '20px', padding: '12px', background: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.2)', borderRadius: '6px', fontSize: '14px' }}>{error}</div>}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Código Interno</label>
              <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} style={inputStyle} placeholder="ex: JR, PL, SR" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Nome do Nível</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Hierarquia (0 = Mais alto)</label>
              <input type="number" required value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} style={inputStyle} />
            </div>
          </div>
          
          {editing.id && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#eee', fontSize: '14px' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ accentColor: '#c6ff38', width: '16px', height: '16px' }} />
                Nível Ativo
              </label>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleCancel} style={{ padding: '10px 20px', background: 'none', border: '1px solid #444', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
            <button type="submit" style={{ padding: '10px 24px', background: '#c6ff38', color: '#000', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{editing.id ? 'Salvar Alterações' : 'Criar Nível'}</button>
          </div>
        </form>
      )}
    </div>
  )
}
