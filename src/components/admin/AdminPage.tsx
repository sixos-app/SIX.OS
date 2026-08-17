import { useEffect, useState } from 'react'
import {
  createAdminClient,
  createAdminUser,
  getAdminOverview,
  type AdminOverview,
  type CreateAdminUserInput,
} from '../../data/adminRepository'
import type { ClientIdentity } from '../../data/clientRepository'
import {
  getGamificationConfig,
  updateGamificationConfig,
  type GamificationConfig,
} from '../../data/profileRepository'
import { AdminClientDialog } from './AdminClientDialog'
import { AdminUserDialog } from './AdminUserDialog'
import { DepartmentManager } from './DepartmentManager'
import { GamificationManager } from './GamificationManager'
import { PeopleAccessAdmin } from './PeopleAccessAdmin'

export function AdminPage({ onClientCreated = () => undefined }: { onClientCreated?: (client: ClientIdentity) => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<'user' | 'client' | null>(null)
  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'people' | 'departments'>('overview')
  const [gamificationConfig, setGamificationConfig] = useState<GamificationConfig | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configMessage, setConfigMessage] = useState('')

  const [slackWebhook, setSlackWebhook] = useState('')
  const [savingSlack, setSavingSlack] = useState(false)
  const [runrunToken, setRunrunToken] = useState('')
  const [savingRunrun, setSavingRunrun] = useState(false)
  const [integrationMessage, setIntegrationMessage] = useState('')
  const [configuredIntegrations, setConfiguredIntegrations] = useState<string[]>([])

  useEffect(() => {
    void getAdminOverview().then((res) => { setOverview(res); setError('') }).catch((reason: Error) => setError(reason.message))
    void getGamificationConfig().then(setGamificationConfig).catch(() => undefined)

    fetch('/api/admin/integrations')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Integrações indisponíveis')))
      .then((data: any) => {
        if (Array.isArray(data)) {
          setConfiguredIntegrations(data.filter((item) => item.configured).map((item) => item.provider))
        }
      })
      .catch(() => undefined)
  }, [])

  const data = overview ?? { team: [], roles: [], clientCount: 0 }

  async function handleCreateUser(input: CreateAdminUserInput) {
    const member = await createAdminUser(input)
    setOverview((current) => current ? { ...current, team: [...current.team, member] } : current)
  }

  async function handleCreateClient(input: { name: string; shortCode: string; imageDataUrl: string | null }) {
    const client = await createAdminClient(input)
    setOverview((current) => current ? { ...current, clientCount: current.clientCount + 1 } : current)
    onClientCreated(client)
  }

  async function handleSaveConfig() {
    if (!gamificationConfig) return
    setSavingConfig(true)
    setConfigMessage('')
    try {
      await updateGamificationConfig(gamificationConfig)
      setConfigMessage('Configurações de gamificação salvas com sucesso!')
      setTimeout(() => setConfigMessage(''), 3000)
    } catch (reason: unknown) {
      setConfigMessage(reason instanceof Error ? reason.message : 'Erro ao salvar configurações')
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleSaveIntegration(provider: string, config: Record<string, string>, isActive: boolean) {
    if (provider === 'slack') setSavingSlack(true)
    if (provider === 'runrunit') setSavingRunrun(true)
    setIntegrationMessage('')
    try {
      const res = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, config, isActive }),
      })
      const payload = res.headers.get('content-type')?.includes('application/json') ? await res.json() as { error?: string } : null
      if (!res.ok) throw new Error(payload?.error || 'Erro ao salvar integração.')
      setConfiguredIntegrations((current) => current.includes(provider) ? current : [...current, provider])
      if (provider === 'slack') setSlackWebhook('')
      if (provider === 'runrunit') setRunrunToken('')
      setIntegrationMessage(`Integração com ${provider} salva com sucesso!`)
      setTimeout(() => setIntegrationMessage(''), 3000)
    } catch (reason) {
      setIntegrationMessage(reason instanceof Error ? reason.message : 'Erro ao salvar integração.')
    } finally {
      setSavingSlack(false)
      setSavingRunrun(false)
    }
  }

  return (
    <div className="admin-page">
      <section className="admin-intro">
        <div>
          <span>PAINEL ADMINISTRATIVO</span>
          <h1>Controle a <em>operação.</em></h1>
          <p>Colaboradores, cargos e configurações centrais da Agência SIX em um só lugar.</p>
        </div>
        <div className="admin-intro-side">
          <div className="admin-status">
            <i />
            <span>ACESSO ADMINISTRATIVO</span>
            <b>Permissões verificadas</b>
          </div>
          <div className="admin-actions">
            <button onClick={() => setDialog('user')}>NOVO COLABORADOR <span>+</span></button>
            <button onClick={() => setDialog('client')}>NOVO CLIENTE <span>+</span></button>
          </div>
        </div>
      </section>

      <nav className="admin-section-tabs" aria-label="Áreas do painel administrativo">
        <button type="button" className={activeAdminTab === 'overview' ? 'selected' : ''} aria-pressed={activeAdminTab === 'overview'} onClick={() => setActiveAdminTab('overview')}>
          Visão Geral & Setup
        </button>
        <button type="button" className={activeAdminTab === 'people' ? 'selected' : ''} aria-pressed={activeAdminTab === 'people'} onClick={() => setActiveAdminTab('people')}>
          Pessoas & Acessos
        </button>
        <button type="button" className={activeAdminTab === 'departments' ? 'selected' : ''} aria-pressed={activeAdminTab === 'departments'} onClick={() => setActiveAdminTab('departments')}>
          Departamentos
        </button>
      </nav>

      {activeAdminTab === 'people' && <PeopleAccessAdmin />}
      {activeAdminTab === 'departments' && <DepartmentManager />}

      {activeAdminTab === 'overview' && (
        error ? <p className="admin-error">{error}</p> : !overview ? <p className="admin-error">Carregando administração…</p> : (
          <>
            <section className="admin-metrics">
              <article><span>COLABORADORES</span><b>{data.team.length}</b><small>Perfis ativos na organização</small></article>
              <article><span>CARGOS CONFIGURADOS</span><b>{data.roles.length}</b><small>Escopos prontos para aplicar</small></article>
              <article><span>CLIENTES CADASTRADOS</span><b>{data.clientCount}</b><small>Base operacional atual</small></article>
              <article className="admin-metric-highlight"><span>SEGURANÇA</span><b>RBAC</b><small>Perfis e permissões verificados no servidor</small></article>
            </section>

            <section className="admin-grid">
              <article className="admin-card admin-team-card">
                <div className="admin-card-head">
                  <div><span>EQUIPE</span><h2>Perfis e <em>acessos.</em></h2></div>
                  <b>{data.team.length} pessoas</b>
                </div>
                <div className="admin-team-list">
                  {data.team.map((member) => (
                    <div key={member.id}>
                      <i>{member.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</i>
                      <p>
                        <b>{member.name}</b>
                        <small>{member.username ? `@${member.username}` : ((member as any).email || `${member.name.toLowerCase().replace(/\s+/g, '.') }@agenciasix.com.br`)}</small>
                      </p>
                      <span>{(member.roles?.length ? member.roles : [member.role]).map((code) => data.roles.find((item) => item.code === code)?.name ?? code).join(' · ').toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </article>
              <article className="admin-card">
                <div className="admin-card-head">
                  <div><span>RBAC</span><h2>Cargos e <em>regras.</em></h2></div>
                  <b>{data.roles.reduce((total, role) => total + role.permissionCount, 0)} permissões</b>
                </div>
                <div className="admin-role-list">
                  {data.roles.map((role) => (
                    <div key={role.code}>
                      <p><b>{role.name}</b><small>{role.description}</small></p>
                      <span>{role.permissionCount}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            {gamificationConfig && <GamificationManager config={gamificationConfig} onChange={setGamificationConfig} onSave={() => void handleSaveConfig()} saving={savingConfig} message={configMessage} />}
            <section className="admin-gamification" style={{ marginTop: '24px' }}>
              <h3>Integrações Externas</h3>
              <div className="gamification-config-grid">
                <div className="gamification-config-card">
                  <div>
                    <b>Conector Slack (Alertas e Feed)</b>
                    <br />
                    <small>Envia alertas de kudos e conclusões de missões no Slack.</small>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="password"
                      placeholder={configuredIntegrations.includes('slack') ? 'Configurado — informe um novo webhook para substituir' : 'Webhook URL (https://hooks.slack.com/...)'}
                      value={slackWebhook}
                      onChange={(e) => setSlackWebhook(e.target.value)}
                      style={{ width: '320px', textAlign: 'left' }}
                      autoComplete="off"
                    />
                    <button className="gamification-save-button" style={{ margin: 0, padding: '8px 12px' }} onClick={() => handleSaveIntegration('slack', { webhookUrl: slackWebhook }, true)} disabled={!slackWebhook || savingSlack}>
                      {savingSlack ? 'SALVANDO...' : 'SALVAR & ATIVAR'}
                    </button>
                  </div>
                </div>

                <div className="gamification-config-card">
                  <div>
                    <b>Conector Runrun.it</b>
                    <br />
                    <small>Sincronização de eventos e importação de tarefas.</small>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="password"
                      placeholder={configuredIntegrations.includes('runrunit') ? 'Configurado — informe um novo token para substituir' : 'API Token do Runrun.it'}
                      value={runrunToken}
                      onChange={(e) => setRunrunToken(e.target.value)}
                      style={{ width: '320px', textAlign: 'left' }}
                      autoComplete="off"
                    />
                    <button className="gamification-save-button" style={{ margin: 0, padding: '8px 12px' }} onClick={() => handleSaveIntegration('runrunit', { token: runrunToken }, true)} disabled={!runrunToken || savingRunrun}>
                      {savingRunrun ? 'SALVANDO...' : 'SALVAR & ATIVAR'}
                    </button>
                  </div>
                </div>
              </div>
              {integrationMessage && <p style={{ fontSize: '11px', color: '#536e10', marginTop: 10 }}>{integrationMessage}</p>}
            </section>
          </>
        )
      )}
      {dialog === 'user' && <AdminUserDialog roles={data.roles} onClose={() => setDialog(null)} onCreate={handleCreateUser} />}
      {dialog === 'client' && <AdminClientDialog onClose={() => setDialog(null)} onCreate={handleCreateClient} />}
    </div>
  )
}
