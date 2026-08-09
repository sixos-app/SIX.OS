import { useState, useEffect } from 'react'

type Department = {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
}

export function DepartmentManager() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState({ code: '', name: '', description: '', is_active: true })
  const [error, setError] = useState('')

  useEffect(() => {
    loadDepartments()
  }, [])

  async function loadDepartments() {
    try {
      const res = await fetch('/api/admin/departments')
      if (res.ok) {
        setDepartments(await res.json())
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
      const url = editing && editing.id ? `/api/admin/departments/${editing.id}` : '/api/admin/departments'
      
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
      setForm({ code: '', name: '', description: '', is_active: true })
      loadDepartments()
    } catch {
      setError('Erro de conexão')
    }
  }

  function handleEdit(dept: Department) {
    setEditing(dept)
    setForm({ code: dept.code, name: dept.name, description: dept.description || '', is_active: dept.is_active })
  }

  function handleCancel() {
    setEditing(null)
    setForm({ code: '', name: '', description: '', is_active: true })
    setError('')
  }

  if (loading) return <div style={{ color: '#888' }}>Carregando departamentos...</div>

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: '#fff' }}>Departamentos</h3>
        {!editing && (
          <button onClick={() => setEditing({ id: '', code: '', name: '', description: '', is_active: true })} style={{ background: '#c6ff38', color: '#000', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            + Novo Departamento
          </button>
        )}
      </div>

      <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid #2a2a2a', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a2a', background: '#1a1a1a' }}>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Departamento</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Código</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Status</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {departments.map(dept => (
              <tr key={dept.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{dept.name}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{dept.description || 'Sem descrição'}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ background: '#333', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: '#aaa', fontFamily: 'monospace' }}>{dept.code}</span>
                </td>
                <td style={{ padding: '16px' }}>
                  {dept.is_active ? <span style={{ color: '#4CAF50', fontSize: '13px' }}>Ativo</span> : <span style={{ color: '#ff5252', fontSize: '13px' }}>Inativo</span>}
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button onClick={() => handleEdit(dept)} style={{ padding: '6px 12px', background: 'none', border: '1px solid #444', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <form onSubmit={handleSave} style={{ marginTop: '24px', padding: '24px', background: '#1a1a1a', borderRadius: '12px', border: '1px solid #2a2a2a' }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#fff' }}>{editing.id ? 'Editar Departamento' : 'Novo Departamento'}</h4>
          {error && <div style={{ color: '#ff5252', marginBottom: '20px', padding: '12px', background: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.2)', borderRadius: '6px', fontSize: '14px' }}>{error}</div>}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Código Interno</label>
              <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} style={inputStyle} placeholder="ex: MKT, FIN" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Nome do Departamento</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
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
                Departamento Ativo
              </label>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleCancel} style={{ padding: '10px 20px', background: 'none', border: '1px solid #444', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
            <button type="submit" style={{ padding: '10px 24px', background: '#c6ff38', color: '#000', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{editing.id ? 'Salvar Alterações' : 'Criar Departamento'}</button>
          </div>
        </form>
      )}
    </div>
  )
}
