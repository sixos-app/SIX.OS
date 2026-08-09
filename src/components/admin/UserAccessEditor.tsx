import { useState, useEffect } from 'react'
import { getAccessSession } from '../../data/accessRepository'

type UserRow = any
type Override = any
type EffectivePerm = any

const SCOPES_BR: Record<string, string> = {
  'all': 'Global (Tudo)',
  'department': 'Departamento',
  'team': 'Time',
  'own': 'Apenas Próprio',
  'participating_projects': 'Projetos Participantes',
  'assigned_clients': 'Clientes Atribuídos',
  'unit': 'Unidade'
}

export function UserAccessEditor({ user, onBack }: { user: UserRow, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'org' | 'access' | 'effective'>('org')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    department_id: user.department_id || '',
    position_id: user.position_id || '',
    professional_level_id: user.professional_level_id || '',
    manager_id: user.manager_id || '',
    access_profile_id: user.access_profile_id || '',
    status: user.status
  })

  // Reference data
  const [departments, setDepartments] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])

  // Overrides and effective
  const [overrides, setOverrides] = useState<Override[]>([])
  const [effective, setEffective] = useState<Record<string, string[]>>({})
  const [loadingExtras, setLoadingExtras] = useState(true)

  const [newOverride, setNewOverride] = useState({ permission_code: '', scope: 'all', is_granted: true, reason: '', starts_at: '', expires_at: '' })
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    getAccessSession().then(session => setCurrentUser(session))
    loadReferences()
    loadExtras()
  }, [])

  async function loadReferences() {
    const [dRes, posRes, lRes, profRes, uRes, permRes] = await Promise.all([
      fetch('/api/admin/departments'),
      fetch('/api/admin/positions'),
      fetch('/api/admin/professional-levels'),
      fetch('/api/admin/access-profiles'),
      fetch('/api/admin/users'),
      fetch('/api/admin/permissions')
    ])
    if (dRes.ok) setDepartments(await dRes.json())
    if (posRes.ok) setPositions(await posRes.json())
    if (lRes.ok) setLevels(await lRes.json())
    if (profRes.ok) setProfiles(await profRes.json())
    if (uRes.ok) setAllUsers(await uRes.json())
    if (permRes.ok) setPermissions(await permRes.json())
  }

  async function loadExtras() {
    setLoadingExtras(true)
    const [oRes, eRes] = await Promise.all([
      fetch(`/api/admin/users/${user.id}/overrides`),
      fetch(`/api/admin/users/${user.id}/effective-permissions`)
    ])
    if (oRes.ok) setOverrides(await oRes.json())
    if (eRes.ok) {
      const data = await eRes.json()
      setEffective(data.capabilities || {})
    }
    setLoadingExtras(false)
  }

  async function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccessMsg('')
    try {
      const payload = { ...form }
      if (!payload.department_id) delete payload.department_id
      if (!payload.position_id) delete payload.position_id
      if (!payload.professional_level_id) delete payload.professional_level_id
      if (!payload.manager_id) delete payload.manager_id
      if (!payload.access_profile_id) delete payload.access_profile_id

      const res = await fetch(`/api/admin/users/${user.id}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar dados')
      } else {
        setSuccessMsg('Dados salvos com sucesso!')
        if (currentUser && currentUser.id === user.id) {
           await getAccessSession()
           window.dispatchEvent(new Event('sixos:refresh-session'))
        } else {
           loadExtras()
        }
      }
    } catch {
      setError('Erro de conexão')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddOverride(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    
    if (newOverride.starts_at && newOverride.expires_at) {
      if (new Date(newOverride.expires_at) < new Date(newOverride.starts_at)) {
        setError('A data de fim não pode ser anterior à data de início.')
        return
      }
    }

    const payload = {
      ...newOverride,
      starts_at: newOverride.starts_at ? new Date(newOverride.starts_at).toISOString() : null,
      expires_at: newOverride.expires_at ? new Date(newOverride.expires_at).toISOString() : null
    }

    const res = await fetch(`/api/admin/users/${user.id}/overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (res.ok) {
      setNewOverride({ permission_code: '', scope: 'all', is_granted: true, reason: '', starts_at: '', expires_at: '' })
      if (currentUser && currentUser.id === user.id) {
         await getAccessSession()
         window.dispatchEvent(new Event('sixos:refresh-session'))
      } else {
         loadExtras()
      }
    } else {
      const data = await res.json()
      setError(data.error || 'Erro ao adicionar')
    }
  }

  async function handleRemoveOverride(overrideId: string) {
    if (!confirm('Deseja remover este override?')) return
    const res = await fetch(`/api/admin/users/${user.id}/overrides/${overrideId}`, { method: 'DELETE' })
    if (res.ok) {
      if (currentUser && currentUser.id === user.id) {
         await getAccessSession()
         window.dispatchEvent(new Event('sixos:refresh-session'))
      } else {
         loadExtras()
      }
    }
  }

  const getPermissionLabel = (code: string) => {
    const p = permissions.find(x => x.code === code)
    return p ? p.description : code
  }

  const baseContainerStyle: React.CSSProperties = {
    background: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '24px',
    color: '#eee'
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
    <div className="user-access-editor" style={baseContainerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '1px solid #2a2a2a', paddingBottom: '20px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{user.name}</h2>
          <div style={{ color: '#888', fontSize: '14px' }}>@{user.username || user.email.split('@')[0]} · {user.email}</div>
        </div>
        <button onClick={onBack} style={{ background: '#2a2a2a', color: '#fff', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
          Voltar para Lista
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #2a2a2a', marginBottom: '24px' }}>
        <button style={{ paddingBottom: '12px', background: 'none', border: 'none', color: activeTab === 'org' ? '#c6ff38' : '#888', fontWeight: activeTab === 'org' ? 'bold' : 'normal', borderBottom: activeTab === 'org' ? '2px solid #c6ff38' : '2px solid transparent', cursor: 'pointer', fontSize: '14px' }} onClick={() => setActiveTab('org')}>Identidade & Organização</button>
        <button style={{ paddingBottom: '12px', background: 'none', border: 'none', color: activeTab === 'access' ? '#c6ff38' : '#888', fontWeight: activeTab === 'access' ? 'bold' : 'normal', borderBottom: activeTab === 'access' ? '2px solid #c6ff38' : '2px solid transparent', cursor: 'pointer', fontSize: '14px' }} onClick={() => setActiveTab('access')}>Permissões Temporárias (Overrides)</button>
        <button style={{ paddingBottom: '12px', background: 'none', border: 'none', color: activeTab === 'effective' ? '#c6ff38' : '#888', fontWeight: activeTab === 'effective' ? 'bold' : 'normal', borderBottom: activeTab === 'effective' ? '2px solid #c6ff38' : '2px solid transparent', cursor: 'pointer', fontSize: '14px' }} onClick={() => setActiveTab('effective')}>Acesso Efetivo</button>
      </div>

      {error && <div style={{ color: '#ff5252', marginBottom: '20px', padding: '12px', background: 'rgba(255, 82, 82, 0.1)', border: '1px solid rgba(255, 82, 82, 0.2)', borderRadius: '6px', fontSize: '14px' }}>{error}</div>}
      {successMsg && <div style={{ color: '#c6ff38', marginBottom: '20px', padding: '12px', background: 'rgba(198, 255, 56, 0.1)', border: '1px solid rgba(198, 255, 56, 0.2)', borderRadius: '6px', fontSize: '14px' }}>{successMsg}</div>}

      {activeTab === 'org' && (
        <form onSubmit={handleSaveOrg} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div>
            <h4 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Identidade</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Nome Completo</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>E-mail corporativo</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
              </div>
            </div>
          </div>
          
          <hr style={{ border: 0, borderTop: '1px solid #2a2a2a', margin: '8px 0' }} />
          
          <div>
            <h4 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Organização</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Departamento</label>
                <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} style={inputStyle}>
                  <option value="">-- Selecione --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Líder Direto</label>
                <select value={form.manager_id} onChange={e => setForm({ ...form, manager_id: e.target.value })} style={inputStyle}>
                  <option value="">-- Selecione --</option>
                  {allUsers.filter(u => u.id !== user.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Cargo Profissional <span style={{ color: '#555', fontWeight: 'normal' }}>(Define a função, não concede acessos)</span></label>
                <select value={form.position_id} onChange={e => setForm({ ...form, position_id: e.target.value })} style={inputStyle}>
                  <option value="">-- Selecione --</option>
                  {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Nível Profissional</label>
                <select value={form.professional_level_id} onChange={e => setForm({ ...form, professional_level_id: e.target.value })} style={inputStyle}>
                  <option value="">-- Selecione --</option>
                  {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid #2a2a2a', margin: '8px 0' }} />

          <div>
            <h4 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Acesso ao Sistema</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#c6ff38', fontWeight: 'bold' }}>Perfil de Acesso Base <span style={{ color: '#888', fontWeight: 'normal' }}>(Define permissões nativas)</span></label>
                <select value={form.access_profile_id} onChange={e => setForm({ ...form, access_profile_id: e.target.value })} style={{...inputStyle, border: '1px solid #4CAF50'}}>
                  <option value="">-- Sistema V1 Legacy / Nenhum --</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>Status da Conta</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} style={inputStyle}>
                  <option value="active">🟢 Ativo (Acesso Liberado)</option>
                  <option value="inactive">⚪️ Inativo (Acesso Suspenso)</option>
                  <option value="blocked">🔴 Bloqueado (Acesso Revogado)</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving} style={{ background: '#c6ff38', color: '#000', padding: '10px 24px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Salvando...' : 'Salvar Organização & Perfil'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'access' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div style={{ background: '#1a1a1a', padding: '24px', borderRadius: '8px', border: '1px solid #333' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>Adicionar Permissão Específica (Override)</h4>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>Conceda ou restrinja uma permissão isolada. Você pode definir um prazo de expiração para acessos temporários.</p>
            
            <form onSubmit={handleAddOverride} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold' }}>Permissão</label>
                  <select required value={newOverride.permission_code} onChange={e => setNewOverride({ ...newOverride, permission_code: e.target.value })} style={inputStyle}>
                    <option value="">Selecione a permissão...</option>
                    {permissions.map(p => <option key={p.code} value={p.code}>{p.description} ({p.code})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold' }}>Ação</label>
                  <select value={newOverride.is_granted ? 'true' : 'false'} onChange={e => setNewOverride({ ...newOverride, is_granted: e.target.value === 'true' })} style={inputStyle}>
                    <option value="true">✅ Permitir (Allow)</option>
                    <option value="false">⛔️ Restringir (Deny)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold' }}>Escopo</label>
                  <select value={newOverride.scope} onChange={e => setNewOverride({ ...newOverride, scope: e.target.value })} style={inputStyle} disabled={!newOverride.is_granted}>
                    <option value="all">Tudo / Global</option>
                    <option value="department">Departamento</option>
                    <option value="team">Time</option>
                    <option value="own">Próprio</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold' }}>Motivo / Justificativa</label>
                  <input type="text" placeholder="Ex: Cobertura de férias do atendimento" value={newOverride.reason} onChange={e => setNewOverride({ ...newOverride, reason: e.target.value })} style={inputStyle} required />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold' }}>Início (Opcional)</label>
                  <input type="date" value={newOverride.starts_at} onChange={e => setNewOverride({ ...newOverride, starts_at: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold' }}>Fim (Opcional)</label>
                  <input type="date" value={newOverride.expires_at} onChange={e => setNewOverride({ ...newOverride, expires_at: e.target.value })} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="submit" style={{ padding: '8px 24px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>Adicionar Exceção</button>
              </div>
            </form>
          </div>

          <div>
            <h4 style={{ margin: '0 0 16px 0', color: '#fff', borderBottom: '1px solid #2a2a2a', paddingBottom: '12px' }}>Overrides Ativos</h4>
            {loadingExtras ? <p style={{ color: '#888', fontSize: '14px' }}>Carregando...</p> : (
              overrides.length === 0 ? <p style={{ color: '#666', fontSize: '14px', fontStyle: 'italic' }}>Nenhuma exceção configurada para este usuário.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {overrides.map(ov => {
                    const isActive = (!ov.starts_at || new Date(ov.starts_at) <= new Date()) && (!ov.expires_at || new Date(ov.expires_at) >= new Date())
                    const statusText = !isActive ? (ov.expires_at && new Date(ov.expires_at) < new Date() ? 'Expirada' : 'Agendada') : 'Ativa'

                    return (
                      <div key={ov.id} style={{ padding: '16px', border: '1px solid #2a2a2a', background: '#1a1a1a', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <strong style={{ color: ov.is_granted ? '#c6ff38' : '#ff5252', fontSize: '14px' }}>
                              {ov.is_granted ? '✓ PERMITIDO' : '✕ NEGADO'}: {getPermissionLabel(ov.permission_code)}
                            </strong>
                            <span style={{ fontSize: '11px', background: '#333', padding: '2px 6px', borderRadius: '4px', color: '#aaa' }}>{ov.permission_code}</span>
                            {!isActive && <span style={{ fontSize: '11px', background: 'rgba(255, 165, 0, 0.2)', color: 'orange', padding: '2px 6px', borderRadius: '4px' }}>{statusText}</span>}
                          </div>
                          
                          <div style={{ fontSize: '13px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {ov.is_granted && <div><b>Escopo:</b> {ov.scope}</div>}
                            {ov.reason && <div><b>Motivo:</b> {ov.reason}</div>}
                            {(ov.starts_at || ov.expires_at) && (
                              <div style={{ color: isActive ? '#4CAF50' : '#ff9800' }}>
                                ⏱ Temporária: {ov.starts_at ? new Date(ov.starts_at).toLocaleDateString('pt-BR') : 'Agora'} até {ov.expires_at ? new Date(ov.expires_at).toLocaleDateString('pt-BR') : 'Sem data fim'}
                              </div>
                            )}
                          </div>
                        </div>
                        <button onClick={() => handleRemoveOverride(ov.id)} style={{ color: '#ff5252', background: 'none', border: '1px solid #ff5252', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Remover</button>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {activeTab === 'effective' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', borderBottom: '1px solid #2a2a2a', paddingBottom: '16px' }}>
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#fff' }}>Acesso Efetivo (Resultado Final)</h4>
              <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>Esta aba mostra o que o usuário **realmente** consegue acessar no sistema após calcular o perfil base e aplicar os overrides.</p>
            </div>
            <div style={{ background: '#333', color: '#fff', fontSize: '12px', padding: '4px 8px', borderRadius: '4px' }}>Autoridade do Backend</div>
          </div>

          {loadingExtras ? <p style={{ color: '#888', fontSize: '14px' }}>Calculando acesso em tempo real...</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {Object.entries(effective).map(([permCode, scopes]) => (
                <div key={permCode} style={{ padding: '16px', border: '1px solid rgba(198, 255, 56, 0.3)', borderRadius: '8px', background: 'rgba(198, 255, 56, 0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{getPermissionLabel(permCode)}</div>
                  <div style={{ fontSize: '11px', color: '#aaa', fontFamily: 'monospace' }}>{permCode}</div>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {scopes.map(s => (
                       <span key={s} style={{ background: '#333', color: s === 'all' ? '#ff9800' : '#eee', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', border: s === 'all' ? '1px solid #ff9800' : '1px solid #444' }}>
                         {SCOPES_BR[s] || s}
                       </span>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(effective).length === 0 && (
                <div style={{ color: '#ff5252', padding: '24px', background: 'rgba(255, 82, 82, 0.05)', border: '1px dashed #ff5252', borderRadius: '8px', textAlign: 'center', gridColumn: '1 / -1' }}>
                  Nenhum acesso garantido. Este usuário será bloqueado em praticamente todas as rotas do sistema.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
