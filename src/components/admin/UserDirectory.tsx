import { useState, useEffect } from 'react'
import { UserAccessEditor } from './UserAccessEditor'

type UserRow = {
  id: string
  name: string
  email: string
  username: string | null
  status: 'active' | 'inactive' | 'blocked'
  department_id: string | null
  position_id: string | null
  professional_level_id: string | null
  access_profile_id: string | null
  manager_id: string | null
  legacy_role: string
  overrides_count?: number
}

type Dep = { id: string, name: string }
type Prof = { id: string, name: string }

export function UserDirectory() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [departments, setDepartments] = useState<Dep[]>([])
  const [profiles, setProfiles] = useState<Prof[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProfile, setFilterProfile] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [uRes, dRes, pRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/departments'),
        fetch('/api/admin/access-profiles')
      ])
      if (uRes.ok) {
        const data = await uRes.json()
        setUsers(data)
      }
      if (dRes.ok) setDepartments(await dRes.json())
      if (pRes.ok) setProfiles(await pRes.json())
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ color: '#888', padding: '24px' }}>Carregando colaboradores do SIX.OS...</div>

  if (editingUser) {
    return <UserAccessEditor user={editingUser} onBack={() => { setEditingUser(null); loadData() }} />
  }

  const filtered = users.filter(u => {
    if (filterStatus && u.status !== filterStatus) return false
    if (filterDept && u.department_id !== filterDept) return false
    if (filterProfile && u.access_profile_id !== filterProfile) return false
    if (search) {
      const s = search.toLowerCase()
      if (!u.name.toLowerCase().includes(s) && !u.email.toLowerCase().includes(s) && !(u.username && u.username.toLowerCase().includes(s))) return false
    }
    return true
  })

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px',
    background: '#1c1c1c',
    border: '1px solid #333',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '13px'
  }

  return (
    <div className="user-directory" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input 
          placeholder="Buscar por nome, e-mail ou username..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          style={{ ...inputStyle, flex: '1 1 300px' }} 
        />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ ...inputStyle, flex: '1 1 150px' }}>
          <option value="">Todos Departamentos</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filterProfile} onChange={e => setFilterProfile(e.target.value)} style={{ ...inputStyle, flex: '1 1 150px' }}>
          <option value="">Todos os Perfis</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, flex: '1 1 150px' }}>
          <option value="">Todos os Status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="blocked">Bloqueados</option>
        </select>
      </div>

      <div style={{ background: '#141414', borderRadius: '12px', border: '1px solid #2a2a2a', overflowX: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
            <p>Nenhum colaborador encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a', background: '#1a1a1a' }}>
                <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Colaborador</th>
                <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Departamento & Líder</th>
                <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Perfil de Acesso</th>
                <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Status</th>
                <th style={{ padding: '16px', color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const initials = u.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
                const manager = users.find(m => m.id === u.manager_id)
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#333', color: '#c6ff38', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{u.name}</div>
                          <div style={{ fontSize: '12px', color: '#888' }}>{u.username ? `@${u.username}` : u.email}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td style={{ padding: '16px' }}>
                      <div style={{ color: '#eee', fontSize: '13px' }}>
                        {departments.find(d => d.id === u.department_id)?.name || <span style={{ color: '#555' }}>Sem departamento</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                        Líder: {manager ? manager.name : 'Nenhum'}
                      </div>
                    </td>
                    
                    <td style={{ padding: '16px' }}>
                      <div style={{ color: '#c6ff38', fontSize: '13px', fontWeight: 'bold' }}>
                        {profiles.find(p => p.id === u.access_profile_id)?.name || <span style={{ color: '#888' }}>{u.legacy_role.toUpperCase()} (Legacy V1)</span>}
                      </div>
                      {u.overrides_count ? (
                        <div style={{ fontSize: '11px', background: 'rgba(198, 255, 56, 0.1)', color: '#c6ff38', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '6px' }}>
                          + Acessos Personalizados
                        </div>
                      ) : null}
                    </td>
                    
                    <td style={{ padding: '16px' }}>
                      {u.status === 'active' && <span style={{ color: '#4CAF50', fontSize: '13px' }}>🟢 Ativo</span>}
                      {u.status === 'inactive' && <span style={{ color: '#888', fontSize: '13px' }}>⚪️ Inativo</span>}
                      {u.status === 'blocked' && <span style={{ color: '#ff5252', fontSize: '13px' }}>🔴 Bloqueado</span>}
                    </td>
                    
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <button onClick={() => setEditingUser(u)} style={{ padding: '8px 16px', background: 'none', border: '1px solid #444', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Gerenciar Acesso</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
