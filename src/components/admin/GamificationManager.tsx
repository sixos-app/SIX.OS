import { useEffect, useState } from 'react'
import type { GamificationConfig } from '../../data/profileRepository'
import { GAMIFICATION_LEVELS } from '../../../shared/gamificationLevels'

type Option = { id?: string; code?: string; name: string }
type XpRule = { id: string; name: string; description: string; baseXp: number; recipientMode: 'responsible' | 'participants_split' | 'participants_each'; onTimeBonusPercent: number; roleCodes: string[]; departmentIds: string[]; isActive: boolean; version: number }
type Award = { id: string; missionTitle: string; userName: string; ruleName: string; ruleVersion: number; baseXp: number; bonusXp: number; finalXp: number; createdAt: string }

const emptyRule: Omit<XpRule, 'id' | 'version'> = { name: '', description: '', baseXp: 80, recipientMode: 'participants_each', onTimeBonusPercent: 0, roleCodes: [], departmentIds: [], isActive: true }

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json', ...(init?.headers ?? {}) }, ...init })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Não foi possível atualizar a gamificação')
  return payload
}

export function GamificationManager({ config, onChange, onSave, saving, message }: { config: GamificationConfig; onChange: (value: GamificationConfig) => void; onSave: () => void; saving: boolean; message: string }) {
  const [tab, setTab] = useState<'rules' | 'levels' | 'rewards' | 'history'>('rules')
  const [rules, setRules] = useState<XpRule[]>([])
  const [roles, setRoles] = useState<Option[]>([])
  const [departments, setDepartments] = useState<Option[]>([])
  const [awards, setAwards] = useState<Award[]>([])
  const [draft, setDraft] = useState(emptyRule)
  const [editingId, setEditingId] = useState('')
  const [status, setStatus] = useState('')

  function loadRules() {
    void json<{ rules: XpRule[]; roles: Option[]; departments: Option[] }>('/api/admin/gamification/rules').then((data) => { setRules(data.rules); setRoles(data.roles); setDepartments(data.departments) }).catch((error: Error) => setStatus(error.message))
  }
  useEffect(loadRules, [])
  useEffect(() => { if (tab === 'history') void json<{ awards: Award[] }>('/api/admin/gamification/history').then((data) => setAwards(data.awards)).catch((error: Error) => setStatus(error.message)) }, [tab])

  function edit(rule: XpRule) { setEditingId(rule.id); setDraft({ name: rule.name, description: rule.description, baseXp: rule.baseXp, recipientMode: rule.recipientMode, onTimeBonusPercent: rule.onTimeBonusPercent, roleCodes: rule.roleCodes, departmentIds: rule.departmentIds, isActive: rule.isActive }) }
  function reset() { setEditingId(''); setDraft(emptyRule) }
  function toggle(list: string[], value: string) { return list.includes(value) ? list.filter((item) => item !== value) : [...list, value] }
  async function saveRule() {
    setStatus('')
    try {
      await json('/api/admin/gamification/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, id: editingId || undefined }) })
      setStatus(editingId ? 'Regra atualizada e versionada.' : 'Regra criada.')
      reset(); loadRules()
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Erro ao salvar regra') }
  }

  return <section className="admin-gamification gamification-manager">
      <div className="gamification-heading"><div><span>GAMIFICAÇÃO</span><h3>Regras de XP <em>auditáveis.</em></h3><p>Na aprovação final, cada colaborador que concluiu uma etapa recebe o XP da regra, conforme sua elegibilidade.</p></div><label>Multiplicador global<input type="number" min="0.1" max="10" step="0.1" value={config.xpMultiplier} onChange={(event) => onChange({ ...config, xpMultiplier: Number(event.target.value) || 1 })} /></label></div>
    <nav className="gamification-tabs" aria-label="Configuração da gamificação">
      {([['rules', 'Regras de XP'], ['levels', 'Níveis'], ['rewards', 'Recompensas'], ['history', 'Histórico']] as const).map(([id, label]) => <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}
    </nav>

    {tab === 'rules' && <div className="gamification-rules-layout">
      <div className="xp-rule-list">{rules.map((rule) => <button className={!rule.isActive ? 'inactive' : ''} onClick={() => edit(rule)} key={rule.id}><span>{rule.isActive ? 'ATIVA' : 'INATIVA'} · V{rule.version}</span><b>{rule.name}</b><small>{rule.baseXp} XP · {rule.onTimeBonusPercent}% bônus no prazo</small></button>)}{rules.length === 0 && <p>Nenhuma regra configurada.</p>}</div>
      <div className="xp-rule-editor"><h4>{editingId ? 'Editar regra' : 'Nova regra de XP'}</h4><label>Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Key Visual aprovado" /></label><label>Descrição<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Quando e por que esta regra é usada." /></label><div className="xp-rule-fields"><label>XP base<input type="number" min="0" max="10000" value={draft.baseXp} onChange={(event) => setDraft({ ...draft, baseXp: Number(event.target.value) })} /></label><label>Bônus no prazo (%)<input type="number" min="0" max="100" value={draft.onTimeBonusPercent} onChange={(event) => setDraft({ ...draft, onTimeBonusPercent: Number(event.target.value) })} /></label><label>Destinatários<select value="participants_each" disabled><option value="participants_each">Cada participante do fluxo</option></select></label></div><div className="xp-eligibility"><fieldset><legend>Cargos elegíveis</legend>{roles.map((role) => <label key={role.code}><input type="checkbox" checked={draft.roleCodes.includes(role.code ?? '')} onChange={() => setDraft({ ...draft, roleCodes: toggle(draft.roleCodes, role.code ?? '') })} />{role.name}</label>)}<small>Nenhum marcado = todos os cargos.</small></fieldset><fieldset><legend>Departamentos elegíveis</legend>{departments.map((department) => <label key={department.id ?? ''}><input type="checkbox" checked={draft.departmentIds.includes(department.id ?? '')} onChange={() => setDraft({ ...draft, departmentIds: toggle(draft.departmentIds, department.id ?? '') })} />{department.name}</label>)}<small>Nenhum marcado = todos os departamentos.</small></fieldset></div><label className="xp-rule-active"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />Regra ativa</label><div className="xp-rule-actions"><button onClick={() => void saveRule()} disabled={!draft.name.trim()}>SALVAR REGRA <span>→</span></button>{editingId && <button className="secondary" onClick={reset}>CANCELAR</button>}</div></div>
    </div>}

    {tab === 'levels' && <div className="gamification-config-grid">{GAMIFICATION_LEVELS.map((level) => <div className="gamification-config-card" key={level.id}><div><b>{level.name}</b><small>{level.description}</small></div><div className="gamification-inline-fields"><b>{level.minXp.toLocaleString('pt-BR')} XP</b></div></div>)}</div>}
    {tab === 'rewards' && <div className="gamification-config-grid">{config.rewardsConfig.map((reward, index) => <div className="gamification-config-card" key={reward.id}><div><b>{reward.title}</b><small>Recompensa disponível por XP.</small></div><div className="gamification-inline-fields"><input value={reward.title} onChange={(event) => { const next = [...config.rewardsConfig]; next[index] = { ...reward, title: event.target.value }; onChange({ ...config, rewardsConfig: next }) }} /><input type="number" value={reward.xpCost} onChange={(event) => { const next = [...config.rewardsConfig]; next[index] = { ...reward, xpCost: Number(event.target.value) }; onChange({ ...config, rewardsConfig: next }) }} /></div></div>)}</div>}
    {tab === 'history' && <div className="xp-award-history">{awards.map((award) => <article key={award.id}><div><span>{new Date(award.createdAt).toLocaleDateString('pt-BR')}</span><b>{award.userName}</b><small>{award.missionTitle} · {award.ruleName} v{award.ruleVersion}</small></div><strong>+{award.finalXp} XP<small>{award.bonusXp ? `+${award.bonusXp} bônus` : 'sem bônus'}</small></strong></article>)}{awards.length === 0 && <p>Nenhum crédito de XP registrado ainda.</p>}</div>}
    {status && <p className="gamification-message">{status}</p>}{message && <p className="gamification-message">{message}</p>}
    {tab === 'rewards' && <button className="gamification-save-button" onClick={onSave} disabled={saving}>{saving ? 'SALVANDO…' : 'SALVAR CONFIGURAÇÃO'}</button>}
  </section>
}
