import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { getAdminOverview, type AdminTeamMember } from '../../data/adminRepository'
import {
  createClientContact,
  createClientContract,
  deactivateClientContact,
  getClient,
  getClientContacts,
  getClientContracts,
  updateClient,
  updateClientContact,
  updateClientContract,
  type ClientContact,
  type ClientContract,
  type ClientMaster,
} from '../../data/clientRepository'
import { usePermission } from '../../hooks/usePermission'
import { ClientLibraryManager } from '../library/ClientLibraryManager'
import { FileUploadField } from '../shared/FileUploadField'
import { FormField } from '../shared/FormField'
import { Icon } from '../shared/Icon'
import { ModalHeader } from '../shared/ModalHeader'
import { ModalShell } from '../shared/ModalShell'

type Tab = 'general' | 'contacts' | 'address' | 'contracts' | 'finance' | 'documents'
type ContactDraft = { name: string; roleTitle: string; email: string; phone: string; isPrimary: boolean; isActive: boolean }
type ContractDraft = { startDate: string; status: string; renewalType: string; billingDay: string; contractValue: string; notes: string }

const TAB_LABELS: Record<Tab, string> = { general: 'GERAL', contacts: 'CONTATOS', address: 'ENDEREÇO', contracts: 'CONTRATOS', finance: 'FINANCEIRO', documents: 'DOCUMENTOS' }
const emptyContact: ContactDraft = { name: '', roleTitle: '', email: '', phone: '', isPrimary: false, isActive: true }
const emptyContract: ContractDraft = { startDate: new Date().toISOString().slice(0, 10), status: 'active', renewalType: '', billingDay: '', contractValue: '', notes: '' }

export function formatCnpj(value: string | null) {
  if (!value || value.length !== 14) return value ?? ''
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function clientPatch(before: ClientMaster, form: ClientMaster, imageUrl: string | null | undefined) {
  const fields: Array<keyof ClientMaster> = ['name', 'shortCode', 'corporateName', 'tradeName', 'cnpj', 'stateRegistration', 'municipalRegistration', 'segment', 'units', 'website', 'status', 'accountManagerId', 'description']
  const patch: Record<string, unknown> = {}
  for (const field of fields) if (before[field] !== form[field]) patch[field] = form[field]
  for (const [field, key] of Object.entries({ zipCode: 'addressZipCode', street: 'addressStreet', number: 'addressNumber', complement: 'addressComplement', district: 'addressDistrict', city: 'addressCity', state: 'addressState', country: 'addressCountry' })) {
    if (before.address[field as keyof ClientMaster['address']] !== form.address[field as keyof ClientMaster['address']]) patch[key] = form.address[field as keyof ClientMaster['address']]
  }
  if (imageUrl !== undefined && imageUrl !== before.imageUrl) patch.imageUrl = imageUrl
  return patch
}

function errorMessage(reason: unknown, fallback: string) { return reason instanceof Error ? reason.message : fallback }
function inputValue(value: string | null | undefined) { return value ?? '' }

export function ClientMasterModal({ clientId, onClose, onUpdated }: { clientId: string; onClose: () => void; onUpdated?: (client: ClientMaster) => void }) {
  const { can } = usePermission()
  const canView = can('clients.view')
  const canManage = can('clients.manage')
  const canContracts = can('contracts.view')
  const canCreateContracts = can('contracts.create')
  const canManageContracts = can('contracts.manage')
  const canViewFinance = can('finance.view') || can('finance.manage')
  const canManageFinance = can('finance.manage')
  const canLibrary = can('library.view')
  const canManageLibrary = can('library.manage')
  const [client, setClient] = useState<ClientMaster | null>(null)
  const [form, setForm] = useState<ClientMaster | null>(null)
  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [contracts, setContracts] = useState<ClientContract[]>([])
  const [managers, setManagers] = useState<AdminTeamMember[]>([])
  const [tab, setTab] = useState<Tab>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [contactDraft, setContactDraft] = useState<ContactDraft>(emptyContact)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contractDraft, setContractDraft] = useState<ContractDraft>(emptyContract)
  const [editingContractId, setEditingContractId] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null | undefined>(undefined)
  const tabs = useMemo(() => (['general', 'contacts', 'address', ...(canContracts ? ['contracts'] : []), ...(canViewFinance ? ['finance'] : []), ...(canLibrary ? ['documents'] : [])] as Tab[]), [canContracts, canLibrary, canViewFinance])
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    setLoading(true); setError('')
    void getClient(clientId).then((next) => { setClient(next); setForm(next); setImageUrl(undefined) }).catch((reason) => setError(errorMessage(reason, 'Falha ao carregar cliente.'))).finally(() => setLoading(false))
  }, [clientId])

  useEffect(() => {
    if (tab === 'contacts' && canView) void getClientContacts(clientId).then(setContacts).catch((reason) => setError(errorMessage(reason, 'Falha ao carregar contatos.')))
    if ((tab === 'contracts' || tab === 'finance') && canContracts) void getClientContracts().then((all) => setContracts(all.filter((item) => item.clientId === clientId))).catch((reason) => setError(errorMessage(reason, 'Falha ao carregar contratos.')))
    if (canManage && can('users.manage') && managers.length === 0) void getAdminOverview().then((overview) => setManagers(overview.team)).catch(() => undefined)
  }, [can, canContracts, canManage, canView, clientId, managers.length, tab])

  function switchTab(next: Tab) { setTab(next); setError(''); setFeedback('') }
  function handleTabsKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const current = tabs.indexOf(tab)
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    switchTab(tabs[index]!); tabRefs.current[index]?.focus()
  }
  function updateForm(field: keyof ClientMaster, value: string | null) { setForm((current) => current ? { ...current, [field]: value } : current) }
  function updateAddress(field: keyof ClientMaster['address'], value: string | null) { setForm((current) => current ? { ...current, address: { ...current.address, [field]: value } } : current) }
  function handleLogo(file: File | null) {
    if (!file) { setImageUrl(null); return }
    const reader = new FileReader(); reader.onload = () => setImageUrl(typeof reader.result === 'string' ? reader.result : null); reader.readAsDataURL(file)
  }
  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!client || !form || !canManage || saving) return
    const patch = clientPatch(client, form, imageUrl); if (!Object.keys(patch).length) return
    setSaving(true); setError(''); setFeedback('')
    try { const saved = await updateClient(clientId, patch); setClient(saved); setForm(saved); setImageUrl(undefined); onUpdated?.(saved); setFeedback('Alterações salvas.') }
    catch (reason) { setError(errorMessage(reason, 'Falha ao salvar alterações.')) }
    finally { setSaving(false) }
  }
  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canManage) return
    setSaving(true); setError('')
    try {
      const payload = { ...contactDraft, roleTitle: contactDraft.roleTitle || null, email: contactDraft.email || null, phone: contactDraft.phone || null }
      const saved = editingContactId ? await updateClientContact(clientId, editingContactId, payload) : await createClientContact(clientId, payload)
      setContacts((current) => editingContactId ? current.map((item) => item.id === saved.id ? saved : (saved.isPrimary ? { ...item, isPrimary: 0 } : item)) : [saved, ...current.map((item) => saved.isPrimary ? { ...item, isPrimary: 0 } : item)])
      setContactDraft(emptyContact); setEditingContactId(null); setFeedback('Contato salvo.')
    } catch (reason) { setError(errorMessage(reason, 'Falha ao salvar contato.')) }
    finally { setSaving(false) }
  }
  async function deactivateContact(contactId: string) {
    if (!canManage) return
    setError(''); try { await deactivateClientContact(clientId, contactId); setContacts((current) => current.map((item) => item.id === contactId ? { ...item, isActive: 0, isPrimary: 0 } : item)); setFeedback('Contato desativado.') }
    catch (reason) { setError(errorMessage(reason, 'Falha ao desativar contato.')) }
  }
  function editContact(item: ClientContact) { setEditingContactId(item.id); setContactDraft({ name: item.name, roleTitle: inputValue(item.roleTitle), email: inputValue(item.email), phone: inputValue(item.phone), isPrimary: item.isPrimary === 1, isActive: item.isActive === 1 }) }
  async function saveContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if ((!editingContractId && !canCreateContracts) || (editingContractId && !canManageContracts)) return
    const billingDay = contractDraft.billingDay ? Number(contractDraft.billingDay) : null
    if (billingDay !== null && (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31)) { setError('Dia de cobrança deve estar entre 1 e 31.'); return }
    const payload: Record<string, unknown> = { startDate: contractDraft.startDate, status: contractDraft.status, renewalType: contractDraft.renewalType || null, billingDay, notes: contractDraft.notes || null }
    if (canManageFinance && contractDraft.contractValue) payload.contractValue = Number(contractDraft.contractValue)
    setSaving(true); setError('')
    try {
      if (editingContractId) { await updateClientContract(editingContractId, payload); setContracts(await getClientContracts().then((all) => all.filter((item) => item.clientId === clientId))) }
      else { const saved = await createClientContract({ clientId, monthlyDeliverables: 0, hourLimit: 0, agreedDeadlineDays: 3, revisionRounds: 2, ...payload }); setContracts((current) => [saved, ...current]) }
      setContractDraft(emptyContract); setEditingContractId(null); setFeedback('Contrato salvo.')
    } catch (reason) { setError(errorMessage(reason, 'Falha ao salvar contrato.')) }
    finally { setSaving(false) }
  }
  function editContract(item: ClientContract) { setEditingContractId(item.id); setContractDraft({ startDate: item.startDate, status: item.status, renewalType: item.renewalType ?? '', billingDay: item.billingDay?.toString() ?? '', contractValue: item.contractValue?.toString() ?? '', notes: item.notes ?? '' }) }

  return (
    <ModalShell accessibleTitle="Cadastro mestre de cliente" onClose={onClose} size="lg">
      <div className="client-master-modal">
        <ModalHeader closeLabel="Fechar cadastro mestre de cliente" eyebrow="CADASTRO MESTRE" icon={<Icon name="folder" size={21} />} onClose={onClose} subtitle={client ? `${client.shortCode ?? 'SEM SIGLA'} · ${client.status === 'active' ? 'ATIVO' : client.status === 'paused' ? 'PAUSADO' : 'ARQUIVADO'}` : undefined} title={client?.name ?? 'Cliente'} />
        {loading && <p className="client-master-modal__state">Carregando cliente…</p>}
        {!loading && error && <p className="client-master-modal__error" role="alert">{error}</p>}
        {!loading && feedback && <p className="client-master-modal__feedback" role="status">{feedback}</p>}
        {!loading && client && form && (
          <>
            <nav className="client-master-tabs" role="tablist" aria-label="Seções do cadastro mestre" onKeyDown={handleTabsKey}>
              {tabs.map((item, index) => <button key={item} ref={(node) => { tabRefs.current[index] = node }} type="button" role="tab" aria-selected={tab === item} aria-controls={`client-master-panel-${item}`} className={tab === item ? 'active' : ''} onClick={() => switchTab(item)}>{TAB_LABELS[item]}</button>)}
            </nav>
            {tab === 'general' && <form id="client-master-panel-general" role="tabpanel" className="client-master-modal__body" onSubmit={saveClient}>
              <section className="client-master-form-grid">
                <FormField controlId="client-master-name" label="NOME OPERACIONAL" required><input value={form.name} disabled={!canManage} onChange={(event) => updateForm('name', event.target.value)} required /></FormField>
                <FormField controlId="client-master-short-code" label="SIGLA"><input value={inputValue(form.shortCode)} disabled={!canManage} maxLength={6} onChange={(event) => updateForm('shortCode', event.target.value.toUpperCase())} /></FormField>
                <FormField controlId="client-master-corporate" label="RAZÃO SOCIAL"><input value={inputValue(form.corporateName)} disabled={!canManage} onChange={(event) => updateForm('corporateName', event.target.value || null)} /></FormField>
                <FormField controlId="client-master-trade" label="NOME FANTASIA"><input value={inputValue(form.tradeName)} disabled={!canManage} onChange={(event) => updateForm('tradeName', event.target.value || null)} /></FormField>
                <FormField controlId="client-master-cnpj" label="CNPJ" hint="Armazenado sem pontuação."><input value={formatCnpj(form.cnpj)} disabled={!canManage} inputMode="numeric" onChange={(event) => updateForm('cnpj', event.target.value || null)} /></FormField>
                <FormField controlId="client-master-status" label="STATUS"><select value={form.status} disabled={!canManage} onChange={(event) => updateForm('status', event.target.value)}><option value="active">Ativo</option><option value="paused">Pausado</option><option value="archived">Arquivado</option></select></FormField>
                <FormField controlId="client-master-ie" label="INSCRIÇÃO ESTADUAL"><input value={inputValue(form.stateRegistration)} disabled={!canManage} onChange={(event) => updateForm('stateRegistration', event.target.value || null)} /></FormField>
                <FormField controlId="client-master-im" label="INSCRIÇÃO MUNICIPAL"><input value={inputValue(form.municipalRegistration)} disabled={!canManage} onChange={(event) => updateForm('municipalRegistration', event.target.value || null)} /></FormField>
                <FormField controlId="client-master-segment" label="SEGMENTO"><input value={inputValue(form.segment)} disabled={!canManage} onChange={(event) => updateForm('segment', event.target.value || null)} /></FormField>
                <FormField controlId="client-master-units" label="UNIDADES"><input value={inputValue(form.units)} disabled={!canManage} onChange={(event) => updateForm('units', event.target.value || null)} /></FormField>
                <FormField controlId="client-master-website" label="WEBSITE" hint="Use http:// ou https://."><input value={inputValue(form.website)} disabled={!canManage} type="url" onChange={(event) => updateForm('website', event.target.value || null)} /></FormField>
                {can('users.manage') ? <FormField controlId="client-master-manager" label="RESPONSÁVEL INTERNO"><select value={inputValue(form.accountManagerId)} disabled={!canManage} onChange={(event) => updateForm('accountManagerId', event.target.value || null)}><option value="">Sem responsável</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select></FormField> : <p className="client-master-form-note">Responsável interno preservado. A lista de usuários requer permissão de gestão de acessos.</p>}
              </section>
              <FormField controlId="client-master-description" label="DESCRIÇÃO"><textarea value={inputValue(form.description)} disabled={!canManage} onChange={(event) => updateForm('description', event.target.value || null)} /></FormField>
              {canManage && <FileUploadField accept="image/png,image/jpeg,image/webp" buttonLabel="ATUALIZAR LOGO" hint="PNG, JPEG ou WebP · até 250 KB" label="LOGO" onChange={handleLogo} validateFile={(file) => file.size > 250000 ? 'Use uma imagem de até 250 KB.' : undefined} />}
              {canManage && <button className="client-master-primary" type="submit" disabled={saving}>{saving ? 'SALVANDO…' : 'SALVAR ALTERAÇÕES'}</button>}
            </form>}
            {tab === 'address' && <form id="client-master-panel-address" role="tabpanel" className="client-master-modal__body" onSubmit={saveClient}>
              <section className="client-master-form-grid">
                <FormField controlId="client-address-zip" label="CEP / CÓDIGO POSTAL"><input value={inputValue(form.address.zipCode)} disabled={!canManage} onChange={(event) => updateAddress('zipCode', event.target.value || null)} /></FormField>
                <FormField controlId="client-address-country" label="PAÍS" hint="Código ISO de duas letras."><input value={inputValue(form.address.country)} disabled={!canManage} maxLength={2} placeholder="BR" onChange={(event) => updateAddress('country', event.target.value.toUpperCase() || null)} /></FormField>
                <FormField controlId="client-address-street" label="LOGRADOURO"><input value={inputValue(form.address.street)} disabled={!canManage} onChange={(event) => updateAddress('street', event.target.value || null)} /></FormField>
                <FormField controlId="client-address-number" label="NÚMERO"><input value={inputValue(form.address.number)} disabled={!canManage} onChange={(event) => updateAddress('number', event.target.value || null)} /></FormField>
                <FormField controlId="client-address-complement" label="COMPLEMENTO"><input value={inputValue(form.address.complement)} disabled={!canManage} onChange={(event) => updateAddress('complement', event.target.value || null)} /></FormField>
                <FormField controlId="client-address-district" label="BAIRRO"><input value={inputValue(form.address.district)} disabled={!canManage} onChange={(event) => updateAddress('district', event.target.value || null)} /></FormField>
                <FormField controlId="client-address-city" label="CIDADE"><input value={inputValue(form.address.city)} disabled={!canManage} onChange={(event) => updateAddress('city', event.target.value || null)} /></FormField>
                <FormField controlId="client-address-state" label="ESTADO / REGIÃO"><input value={inputValue(form.address.state)} disabled={!canManage} onChange={(event) => updateAddress('state', event.target.value || null)} /></FormField>
              </section>
              {canManage && <button className="client-master-primary" type="submit" disabled={saving}>{saving ? 'SALVANDO…' : 'SALVAR ENDEREÇO'}</button>}
            </form>}
            {tab === 'contacts' && <section id="client-master-panel-contacts" role="tabpanel" className="client-master-modal__body">
              {!canView ? <p className="client-master-modal__state">Sem permissão para visualizar contatos.</p> : <><div className="client-master-list">{contacts.map((item) => <article key={item.id} className={!item.isActive ? 'inactive' : ''}><div><b>{item.name} {item.isPrimary === 1 && <small>PRINCIPAL</small>}</b><span>{item.roleTitle || 'Sem cargo'} · {item.email || 'Sem e-mail'} · {item.phone || 'Sem telefone'}</span></div>{canManage && <p><button type="button" onClick={() => editContact(item)}>EDITAR</button>{item.isActive === 1 && <button type="button" onClick={() => void deactivateContact(item.id)}>DESATIVAR</button>}</p>}</article>)}</div>{canManage && <form className="client-master-inline-form" onSubmit={saveContact}><h3>{editingContactId ? 'Editar contato' : 'Adicionar contato'}</h3><section className="client-master-form-grid"><FormField controlId="contact-name" label="NOME" required><input value={contactDraft.name} onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} required /></FormField><FormField controlId="contact-role" label="CARGO"><input value={contactDraft.roleTitle} onChange={(event) => setContactDraft({ ...contactDraft, roleTitle: event.target.value })} /></FormField><FormField controlId="contact-email" label="E-MAIL"><input type="email" value={contactDraft.email} onChange={(event) => setContactDraft({ ...contactDraft, email: event.target.value })} /></FormField><FormField controlId="contact-phone" label="TELEFONE"><input value={contactDraft.phone} onChange={(event) => setContactDraft({ ...contactDraft, phone: event.target.value })} /></FormField></section><label className="client-master-check"><input type="checkbox" checked={contactDraft.isPrimary} onChange={(event) => setContactDraft({ ...contactDraft, isPrimary: event.target.checked })} /> Contato principal</label><label className="client-master-check"><input type="checkbox" checked={contactDraft.isActive} onChange={(event) => setContactDraft({ ...contactDraft, isActive: event.target.checked })} /> Ativo</label><button className="client-master-primary" type="submit" disabled={saving}>{editingContactId ? 'SALVAR CONTATO' : 'ADICIONAR CONTATO'}</button></form>}</>}</section>}
            {tab === 'contracts' && <section id="client-master-panel-contracts" role="tabpanel" className="client-master-modal__body"><div className="client-master-list">{contracts.map((item) => <article key={item.id}><div><b>{item.status.toUpperCase()} {canViewFinance && item.contractValue !== undefined ? <small>{item.contractValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</small> : null}</b><span>Início: {item.startDate} · Renovação: {item.renewalType || 'Não definida'} · Cobrança: {item.billingDay || '—'}</span></div>{canManageContracts && <button type="button" onClick={() => editContract(item)}>EDITAR</button>}</article>)}</div>{!canManageContracts && <p className="client-master-form-note">Contratos em modo leitura.</p>}{(canCreateContracts || editingContractId) && <ContractForm draft={contractDraft} canManageFinance={canManageFinance} editing={Boolean(editingContractId)} onChange={setContractDraft} onSubmit={saveContract} saving={saving} />}</section>}
            {tab === 'finance' && <section id="client-master-panel-finance" role="tabpanel" className="client-master-modal__body"><p className="client-master-form-note">Informações financeiras disponíveis por contrato. Métricas consolidadas e invoices não fazem parte desta etapa.</p>{canContracts ? <div className="client-master-list">{contracts.map((item) => <article key={item.id}><div><b>{item.status.toUpperCase()}</b><span>{item.contractValue === undefined ? 'Sem permissão para valores financeiros.' : `Valor contratado: ${item.contractValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Saldo mensal: ${(item.monthlyBalance ?? 0).toLocaleString('pt-BR')}`}</span></div></article>)}</div> : <p className="client-master-modal__state">Permissão de contratos necessária para visualizar dados financeiros por cliente.</p>}</section>}
            {tab === 'documents' && <section id="client-master-panel-documents" role="tabpanel" className="client-master-modal__body client-master-modal__documents"><ClientLibraryManager client={client} embedded canManageLibrary={canManageLibrary} /></section>}
          </>
        )}
      </div>
    </ModalShell>
  )
}

function ContractForm({ draft, canManageFinance, editing, onChange, onSubmit, saving }: { draft: ContractDraft; canManageFinance: boolean; editing: boolean; onChange: (next: ContractDraft) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  return <form className="client-master-inline-form" onSubmit={onSubmit}><h3>{editing ? 'Editar contrato' : 'Novo contrato'}</h3><section className="client-master-form-grid"><FormField controlId="contract-start" label="DATA DE INÍCIO" required><input type="date" value={draft.startDate} onChange={(event) => onChange({ ...draft, startDate: event.target.value })} required /></FormField><FormField controlId="contract-status" label="STATUS"><select value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value })}><option value="active">Ativo</option><option value="renewed">Renovado</option><option value="expired">Expirado</option><option value="cancelled">Cancelado</option></select></FormField><FormField controlId="contract-renewal" label="RENOVAÇÃO"><select value={draft.renewalType} onChange={(event) => onChange({ ...draft, renewalType: event.target.value })}><option value="">Não definida</option><option value="manual">Manual</option><option value="automatic">Automática</option></select></FormField><FormField controlId="contract-billing-day" label="DIA DE COBRANÇA"><input min="1" max="31" type="number" value={draft.billingDay} onChange={(event) => onChange({ ...draft, billingDay: event.target.value })} /></FormField>{canManageFinance && <FormField controlId="contract-value" label="VALOR CONTRATADO"><input min="0" step="0.01" type="number" value={draft.contractValue} onChange={(event) => onChange({ ...draft, contractValue: event.target.value })} /></FormField>}</section><FormField controlId="contract-notes" label="OBSERVAÇÕES"><textarea value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></FormField><button className="client-master-primary" type="submit" disabled={saving}>{editing ? 'SALVAR CONTRATO' : 'CRIAR CONTRATO'}</button></form>
}
