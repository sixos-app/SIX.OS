import { useState, useEffect } from 'react'
import { ProfileMatrixEditor } from './ProfileMatrixEditor'

type Profile = {
  id: string
  code: string
  name: string
  description: string | null
  is_system: boolean
  is_active: boolean
  users_count: number
  permissions_count: number
}

export function ProfileManager() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [editingMatrix, setEditingMatrix] = useState<Profile | null>(null)
  const [form, setForm] = useState({ code: '', name: '', description: '', is_active: true })
  const [error, setError] = useState('')

  useEffect(() => {
    loadProfiles()
  }, [])

  async function loadProfiles() {
    try {
      const res = await fetch('/api/admin/access-profiles')
      if (res.ok) {
        setProfiles(await res.json())
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
      const url = editing && editing.id ? `/api/admin/access-profiles/${editing.id}` : '/api/admin/access-profiles'
      
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
      handleCancel()
      loadProfiles()
    } catch {
      setError('Erro de conexão')
    }
  }

  function handleEdit(prof: Profile) {
    setEditing(prof)
    setForm({ code: prof.code, name: prof.name, description: prof.description || '', is_active: prof.is_active })
  }

  function handleCancel() {
    setEditing(null)
    setForm({ code: '', name: '', description: '', is_active: true })
    setError('')
  }

  if (loading) return <div style={{ color: '#888' }}>Carregando perfis de acesso...</div>

  if (editingMatrix) {
    return <ProfileMatrixEditor profile={editingMatrix} onBack={() => { setEditingMatrix(null); loadProfiles() }} />
  }

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
        <h3 style={{ margin: 0, color: '#fff' }}>Perfis de Acesso (RBAC)</h3>
        {!editing && (
          <button onClick={() => setEditing({ id: '', code: '', name: '', description: '', is_system: false, is_active: true, users_count: 0, permissions_count: 0 })} style={{ background: '#c6ff38', color: '#000', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            + Novo Perfil
          </button>
        )}
      </div>

      <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid #2a2a2a', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a2a', background: '#1a1a1a' }}>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Perfil & Código</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Métricas</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Status</th>
              <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(prof => (
              <tr key={prof.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{prof.name}</div>
                    {prof.is_system && <span style={{ background: 'rgba(255,255,255,0.1)', color: '#eee', padding: '2px 6px', fontSize: '10px', borderRadius: '4px' }}>SISTEMA</span>}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ background: '#333', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', color: '#aaa', fontFamily: 'monospace' }}>{prof.code}</span>
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>
                    <span style={{ color: '#c6ff38', fontWeight: 'bold' }}>{prof.permissions_count}</span> permissões
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                    <span style={{ color: '#c6ff38', fontWeight: 'bold' }}>{prof.users_count}</span> usuários
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  {prof.is_active ? <span style={{ color: '#4CAF50', fontSize: '13px' }}>Ativo</span> : <span style={{ color: '#ff5252', fontSize: '13px' }}>Inativo</span>}
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingMatrix(prof)} style={{ padding: '6px 12px', background: '#333', border: '1px solid #444', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Matriz de Permissões</button>
                    <button onClick={() => handleEdit(prof)} style={{ padding: '6px 12px', background: 'none', border: '1px solid #444', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Editar Perfil</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <form onSubmit={handleSave} style={{ marginTop: '24px', padding: '24px', background: '#1a1a1a', borderRadius: '12px', border: '1px solid #2a2a2a' }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#fff' }}>{editing.id ? 'Editar Perfil' : 'Novo Perfil'}</h4>
          {error && <div style={{ color: '#ff5252', marginBottom: '20px', padding: '12px', background: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.2)', borderRadius: '6px', fontSize: '14px' }}>{error}</div>}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Código Interno (Imutável após criação)</label>
              <input required disabled={!!editing.id} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} style={{ ...inputStyle, opacity: editing.id ? 0.6 : 1, cursor: editing.id ? 'not-allowed' : 'text' }} placeholder="ex: admin, manager, member" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Nome do Perfil</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Descrição (Opcional)</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
          </div>
          
          {editing.id && !editing.is_system && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#eee', fontSize: '14px' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ accentColor: '#c6ff38', width: '16px', height: '16px' }} />
                Perfil Ativo
              </label>
            </div>
          )}

          {editing.is_system && (
             <div style={{ color: '#ff9800', marginBottom: '24px', fontSize: '13px', background: 'rgba(255, 152, 0, 0.1)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
               ⚠️ <b>Perfil de Sistema</b>: Este perfil faz parte da infraestrutura core do SIX.OS e não pode ser inativado para evitar bloqueios gerais na plataforma (Anti-Lockout).
             </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleCancel} style={{ padding: '10px 20px', background: 'none', border: '1px solid #444', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
            <button type="submit" style={{ padding: '10px 24px', background: '#c6ff38', color: '#000', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{editing.id ? 'Salvar Cadastro' : 'Criar Perfil'}</button>
          </div>
        </form>
      )}
    </div>
  )
}
