import { useState, useEffect } from 'react'

type Profile = { id: string, name: string }
type PermissionDef = { code: string, module: string, action: string, description: string }
type ProfilePermission = { permission_code: string, scope: string }

const SCOPES = [
  { value: 'all', label: 'Tudo (All)' },
  { value: 'department', label: 'Departamento (Department)' },
  { value: 'team', label: 'Time (Team)' },
  { value: 'participating_projects', label: 'Projetos Participantes' },
  { value: 'assigned_clients', label: 'Clientes Atribuídos' },
  { value: 'own', label: 'Próprio (Own)' },
  { value: 'unit', label: 'Unidade' }
]

export function ProfileMatrixEditor({ profile, onBack }: { profile: Profile, onBack: () => void }) {
  const [permissions, setPermissions] = useState<PermissionDef[]>([])
  const [activePerms, setActivePerms] = useState<Record<string, string>>({}) // code -> scope
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [allPermsRes, profilePermsRes] = await Promise.all([
        fetch('/api/admin/permissions'),
        fetch(`/api/admin/access-profiles/${profile.id}`)
      ])
      
      if (allPermsRes.ok) {
        setPermissions(await allPermsRes.json())
      }
      
      if (profilePermsRes.ok) {
        const data = await profilePermsRes.json()
        const map: Record<string, string> = {}
        data.permissions.forEach((p: ProfilePermission) => {
          map[p.permission_code] = p.scope
        })
        setActivePerms(map)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    
    const payload = Object.entries(activePerms).map(([code, scope]) => ({
      permission_code: code,
      scope
    }))

    try {
      const res = await fetch(`/api/admin/access-profiles/${profile.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: payload })
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar matriz')
        setSaving(false)
        return
      }
      onBack()
    } catch {
      setError('Erro de conexão')
      setSaving(false)
    }
  }

  function togglePermission(code: string) {
    setActivePerms(current => {
      const next = { ...current }
      if (next[code]) {
        delete next[code]
      } else {
        next[code] = 'own' // NEVER use 'all' as default for security
      }
      return next
    })
  }

  function setScope(code: string, scope: string) {
    setActivePerms(current => ({ ...current, [code]: scope }))
  }

  if (loading) return <div style={{ color: '#888' }}>Carregando matriz de permissões...</div>

  // Group permissions by module
  const byModule: Record<string, PermissionDef[]> = {}
  permissions.forEach(p => {
    if (!byModule[p.module]) byModule[p.module] = []
    byModule[p.module].push(p)
  })

  return (
    <div className="admin-manager matrix-editor">
      <header className="matrix-editor-head">
        <div className="matrix-editor-heading">
          <h3>Matriz de Permissões</h3>
          <p>Editando permissões para o perfil: <strong>{profile.name}</strong></p>
        </div>
        <div className="matrix-editor-actions">
          <button className="matrix-editor-cancel" onClick={onBack} disabled={saving}>Cancelar</button>
          <button className="matrix-editor-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Matriz'}
          </button>
        </div>
      </header>

      {error && <div style={{ color: '#ff5252', marginBottom: '20px', padding: '12px', background: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.2)', borderRadius: '6px', fontSize: '14px' }}>{error}</div>}

      <div style={{ display: 'grid', gap: '20px' }}>
        {Object.entries(byModule).map(([mod, perms]) => (
          <div key={mod} style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ background: '#1a1a1a', padding: '16px', borderBottom: '1px solid #2a2a2a' }}>
              <h4 style={{ margin: 0, textTransform: 'uppercase', color: '#aaa', fontSize: '12px', letterSpacing: '1px' }}>Módulo: {mod}</h4>
            </div>
            <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
              {perms.map(p => {
                const isActive = !!activePerms[p.code]
                return (
                  <div key={p.code} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: isActive ? 'rgba(198, 255, 56, 0.05)' : '#1a1a1a', border: isActive ? '1px solid rgba(198, 255, 56, 0.2)' : '1px solid #2a2a2a', borderRadius: '8px', transition: 'all 0.2s' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, cursor: 'pointer' }}>
                      <input type="checkbox" checked={isActive} onChange={() => togglePermission(p.code)} style={{ accentColor: '#c6ff38', width: '18px', height: '18px' }} />
                      <div>
                        <div style={{ fontWeight: 'bold', color: isActive ? '#fff' : '#aaa', fontSize: '14px' }}>{p.description || p.action}</div>
                        <div style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace', marginTop: '4px' }}>{p.code}</div>
                      </div>
                    </label>
                    {isActive && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#888' }}>Escopo:</span>
                        <select value={activePerms[p.code]} onChange={e => setScope(p.code, e.target.value)} style={{ padding: '8px 12px', background: '#111', border: '1px solid #333', color: activePerms[p.code] === 'all' ? '#ff5252' : '#fff', borderRadius: '6px', fontSize: '13px', minWidth: '150px' }}>
                          {SCOPES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
