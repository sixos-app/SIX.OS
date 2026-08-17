import { useState, useEffect } from 'react'

type Department = { id: string, name: string, is_active?: boolean }
type Position = {
  id: string
  code: string
  name: string
  description: string | null
  department_id: string | null
  is_active: boolean
}

export function PositionManager() {
  const [positions, setPositions] = useState<Position[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Position | null>(null)
  const [form, setForm] = useState({ code: '', name: '', description: '', department_id: '', is_active: true })
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [posRes, depRes] = await Promise.all([
        fetch('/api/admin/positions'),
        fetch('/api/admin/departments')
      ])
      if (posRes.ok) setPositions(await posRes.json())
      if (depRes.ok) setDepartments(await depRes.json())
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const method = editing && editing.id ? 'PATCH' : 'POST'
      const url = editing && editing.id ? `/api/admin/positions/${editing.id}` : '/api/admin/positions'
      
      const payload = {
        ...form,
        department_id: form.department_id || null
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar')
        return
      }

      setEditing(null)
      handleCancel()
      loadData()
    } catch {
      setError('Erro de conexão')
    }
  }

  function handleEdit(pos: Position) {
    setEditing(pos)
    setForm({ code: pos.code, name: pos.name, description: pos.description || '', department_id: pos.department_id || '', is_active: pos.is_active })
  }

  function handleCancel() {
    setEditing(null)
    setForm({ code: '', name: '', description: '', department_id: '', is_active: true })
    setError('')
  }

  if (loading) return <div style={{ color: '#888' }}>Carregando cargos...</div>

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
        <h3>Cargos Profissionais</h3>
        {!editing && (
          <button className="admin-manager-create-button" onClick={() => setEditing({ id: '', code: '', name: '', description: '', department_id: '', is_active: true })}>
            + Novo Cargo
          </button>
        )}
      </header>

      <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid #2a2a2a', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a2a', background: '#1a1a1a' }}>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Cargo</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Departamento</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Código</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Status</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => (
              <tr key={pos.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{pos.name}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{pos.description || 'Sem descrição'}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontSize: '13px', color: '#eee' }}>
                    {departments.find(d => d.id === pos.department_id)?.name || <span style={{ color: '#555' }}>Sem departamento</span>}
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ background: '#333', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#aaa', fontFamily: 'monospace' }}>{pos.code}</span>
                </td>
                <td style={{ padding: '16px' }}>
                  {pos.is_active ? <span style={{ color: '#4CAF50', fontSize: '13px' }}>Ativo</span> : <span style={{ color: '#ff5252', fontSize: '13px' }}>Inativo</span>}
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button onClick={() => handleEdit(pos)} style={{ padding: '6px 12px', background: 'none', border: '1px solid #444', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <form onSubmit={handleSave} style={{ marginTop: '24px', padding: '24px', background: '#1a1a1a', borderRadius: '12px', border: '1px solid #2a2a2a' }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#fff' }}>{editing.id ? 'Editar Cargo' : 'Novo Cargo'}</h4>
          {error && <div style={{ color: '#ff5252', marginBottom: '20px', padding: '12px', background: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.2)', borderRadius: '6px', fontSize: '14px' }}>{error}</div>}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Código Interno</label>
              <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} style={inputStyle} placeholder="ex: DEV, DES" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Nome do Cargo</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Departamento (Opcional)</label>
              <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} style={inputStyle}>
                <option value="">-- Nenhum --</option>
                {departments.filter(d => d.is_active !== false).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Descrição (Opcional)</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
          </div>
          
          {editing.id && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#eee', fontSize: '14px' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ accentColor: '#c6ff38', width: '16px', height: '16px' }} />
                Cargo Ativo
              </label>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleCancel} style={{ padding: '10px 20px', background: 'none', border: '1px solid #444', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
            <button type="submit" style={{ padding: '10px 24px', background: '#c6ff38', color: '#000', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{editing.id ? 'Salvar Alterações' : 'Criar Cargo'}</button>
          </div>
        </form>
      )}
    </div>
  )
}
