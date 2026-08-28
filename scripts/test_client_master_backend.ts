import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { onRequestPost as createAdminClient } from '../functions/api/admin/clients.ts'
import { onRequestGet as getClient, onRequestPatch as patchClient } from '../functions/api/clients/[id].ts'
import { onRequestGet as listContacts, onRequestPost as createContact } from '../functions/api/clients/[id]/contacts.ts'
import { onRequestDelete as deleteContact, onRequestPatch as patchContact } from '../functions/api/clients/[id]/contacts/[contactId].ts'
import { onRequestPost as provisionFolders } from '../functions/api/clients/[id]/library/provision.ts'
import { onRequestGet as listContracts, onRequestPost as createContract } from '../functions/api/contracts.ts'
import { onRequestPatch as patchContract } from '../functions/api/contracts/[id].ts'

type Value = string | number | null
type Scope = 'all' | 'assigned_clients' | 'participating_projects'
type Client = Record<string, string | null> & { id: string; organizationId: string; name: string; status: string }
type Contact = { id: string; organizationId: string; clientId: string; name: string; roleTitle: string | null; email: string | null; phone: string | null; isPrimary: number; isActive: number; createdAt: string; updatedAt: string }
type Contract = Record<string, string | number | null> & { id: string; organizationId: string; clientId: string; contractValue: number; monthlyBalance: number; status: string }
const now = '2026-08-27T12:00:00.000Z'
const checksum = '6632b6458ef29fff4e47e308577dcd1de4cbe8268f5451ef951e275716f39950'
const FOLDERS = [['logo', 'Logo'], ['brandbook', 'Brandbook'], ['briefing', 'Briefing'], ['contrato', 'Contrato'], ['referencias', 'Referências'], ['outros', 'Outros']]

class Statement {
  constructor(private readonly db: Db, readonly sql: string, readonly values: Value[] = []) {}
  bind(...values: Value[]) { return new Statement(this.db, this.sql, values) }
  first<T>() { return this.db.first<T>(this.sql, this.values) }
  all<T>() { return this.db.all<T>(this.sql, this.values) }
  run() { return this.db.run(this.sql, this.values) }
}

class Db {
  activeUser = 'all'
  permissions = new Map<string, Map<string, Scope>>()
  users = new Map([
    ['all', { id: 'all', organizationId: 'org-a', departmentId: 'dept-a', accessProfileId: 'profile-all' }],
    ['assigned', { id: 'assigned', organizationId: 'org-a', departmentId: 'dept-a', accessProfileId: 'profile-assigned' }],
    ['participating', { id: 'participating', organizationId: 'org-a', departmentId: 'dept-a', accessProfileId: 'profile-participating' }],
    ['restricted', { id: 'restricted', organizationId: 'org-a', departmentId: 'dept-a', accessProfileId: 'profile-restricted' }],
    ['foreign', { id: 'foreign', organizationId: 'org-b', departmentId: 'dept-b', accessProfileId: 'profile-foreign' }],
    ['manager-a', { id: 'manager-a', organizationId: 'org-a', departmentId: 'dept-a', accessProfileId: 'profile-ma' }],
    ['manager-b', { id: 'manager-b', organizationId: 'org-b', departmentId: 'dept-b', accessProfileId: 'profile-mb' }],
  ])
  clients = new Map<string, Client>([
    ['a1', makeClient('a1', 'org-a', 'Cliente A1', 'A1', 'manager-a', '11222333000144')],
    ['a2', makeClient('a2', 'org-a', 'Cliente A2', 'A2', 'assigned', '22333444000155')],
    ['b1', makeClient('b1', 'org-b', 'Cliente B1', 'B1', 'manager-b', '11222333000144')],
  ])
  contacts = new Map<string, Contact>([
    ['a1-primary', makeContact('a1-primary', 'org-a', 'a1', 'Ana', 'Diretora', 'ana@example.test', '1111', 1, 1)],
    ['a2-contact', makeContact('a2-contact', 'org-a', 'a2', 'A2', 'Gestora', 'a2@example.test', '2222', 0, 1)],
  ])
  contracts = new Map<string, Contract>([
    ['contract-a1', makeContract('contract-a1', 'org-a', 'a1', 1000, 250, 'Inicial')],
    ['contract-b1', makeContract('contract-b1', 'org-b', 'b1', 999, 99, 'Externo')],
  ])
  folders = new Map<string, { id: string; clientId: string; slug: string; name: string; position: number }>()
  participating = new Set(['a1'])
  constructor() {
    this.permissions.set('all', new Map([['clients.view', 'all'], ['clients.manage', 'all'], ['library.manage', 'all'], ['contracts.view', 'all'], ['contracts.create', 'all'], ['contracts.manage', 'all'], ['finance.view', 'all'], ['finance.manage', 'all']]))
    this.permissions.set('assigned', new Map([['clients.view', 'assigned_clients'], ['clients.manage', 'assigned_clients'], ['library.manage', 'assigned_clients'], ['contracts.view', 'assigned_clients'], ['contracts.create', 'assigned_clients'], ['contracts.manage', 'assigned_clients'], ['finance.view', 'all'], ['finance.manage', 'all']]))
    this.permissions.set('participating', new Map([['clients.view', 'participating_projects'], ['clients.manage', 'participating_projects']]))
    this.permissions.set('restricted', new Map([['clients.view', 'all'], ['clients.manage', 'all'], ['contracts.view', 'all'], ['contracts.create', 'all'], ['contracts.manage', 'all']]))
    this.permissions.set('foreign', new Map([['clients.view', 'all'], ['clients.manage', 'all']]))
  }
  prepare(sql: string) { return new Statement(this, sql) }
  async batch(statements: Statement[]) { for (const statement of statements) await statement.run() }
  private q(sql: string) { return sql.replace(/\s+/g, ' ').trim() }
  private clientRow(item: Client) { return { ...item, shortCode: item.shortCode, imageUrl: item.imageUrl, corporateName: item.corporateName, tradeName: item.tradeName, stateRegistration: item.stateRegistration, municipalRegistration: item.municipalRegistration, accountManagerId: item.accountManagerId, brandbookUrl: item.brandbookUrl, zipCode: item.zipCode, street: item.street, number: item.number, complement: item.complement, district: item.district, city: item.city, state: item.state, country: item.country, createdAt: item.createdAt } }
  async first<T>(raw: string, values: Value[]): Promise<T | null> {
    const sql = this.q(raw)
    if (sql.includes('FROM auth_sessions')) { const u = this.users.get(this.activeUser)!; return { expiresAt: '2099-01-01T00:00:00.000Z', ...u, teamId: null, managerId: null, name: u.id, email: `${u.id}@test`, role: 'specialist' } as T }
    if (sql.includes('FROM user_permission_overrides')) return null
    if (sql.includes('FROM profile_permissions')) { const scope = this.permissions.get(this.activeUser)?.get(values[0] as string); return scope ? { scope } as T : null }
    if (sql.includes('SELECT id FROM users WHERE id = ?')) { const u = this.users.get(values[0] as string); return u?.organizationId === values[1] ? { id: u.id } as T : null }
    if (sql.includes('FROM client_contacts WHERE id = ?')) { const c = this.contacts.get(values[0] as string); return c && c.clientId === values[1] && c.organizationId === values[2] ? { ...c } as T : null }
    if (sql.includes('FROM contracts WHERE id = ?')) { const c = this.contracts.get(values[0] as string); return c && c.organizationId === values[1] ? { id: c.id, clientId: c.clientId } as T : null }
    if (sql.includes('FROM clients')) {
      const c = this.clients.get(values[0] as string)
      if (!c || c.organizationId !== values[1]) return null
      if (sql.includes('account_manager_id = ?') && c.accountManagerId !== values[2]) return null
      if (sql.includes('JOIN mission_assignees') && (!this.participating.has(c.id) || values[2] !== 'participating')) return null
      if (sql.includes('JOIN users') && this.users.get(c.accountManagerId ?? '')?.departmentId !== values[2]) return null
      return sql.startsWith('SELECT id FROM clients') ? { id: c.id } as T : this.clientRow(c) as T
    }
    return null
  }
  async all<T>(raw: string, values: Value[]): Promise<{ results: T[] }> {
    const sql = this.q(raw)
    if (sql.includes('FROM client_contacts')) return { results: [...this.contacts.values()].filter((c) => c.clientId === values[0] && c.organizationId === values[1]).sort((a, b) => b.isActive - a.isActive || b.isPrimary - a.isPrimary || a.name.localeCompare(b.name)).map((c) => ({ ...c } as T)) }
    if (sql.includes('FROM contracts ctr')) {
      let rows = [...this.contracts.values()].filter((c) => c.organizationId === values[0])
      if (sql.includes('c.account_manager_id = ?')) rows = rows.filter((c) => this.clients.get(c.clientId)?.accountManagerId === values[1])
      if (sql.includes('mission_assignees.user_id = ?')) rows = rows.filter((c) => this.participating.has(c.clientId) && values[1] === 'participating')
      return { results: rows.map((c) => ({ ...c, clientName: this.clients.get(c.clientId)?.name } as T)) }
    }
    return { results: [] }
  }
  async run(raw: string, values: Value[]) {
    const sql = this.q(raw)
    if (sql.startsWith('INSERT INTO clients')) {
      const [id, organizationId, name, shortCode, imageUrl] = values as string[]
      if ([...this.clients.values()].some((c) => c.organizationId === organizationId && c.shortCode === shortCode)) throw new Error('unique')
      this.clients.set(id, makeClient(id, organizationId, name, shortCode, null, null, imageUrl)); return { meta: { changes: 1 } }
    }
    if (sql.includes('INSERT OR IGNORE INTO client_library_folders')) {
      const [id, clientId, name, slug, position] = values as [string, string, string, string, number]
      if (![...this.folders.values()].some((f) => f.clientId === clientId && f.slug === slug)) this.folders.set(id, { id, clientId, name, slug, position })
      return { meta: { changes: 1 } }
    }
    if (sql.startsWith('UPDATE clients SET')) {
      const id = values.at(-2) as string, org = values.at(-1) as string, c = this.clients.get(id)
      if (!c || c.organizationId !== org) return { meta: { changes: 0 } }
      const cols = sql.slice(sql.indexOf(' SET ') + 5, sql.indexOf(' WHERE ')).split(', ').map((p) => p.split(' = ')[0])
      const map: Record<string, string> = { short_code: 'shortCode', image_url: 'imageUrl', corporate_name: 'corporateName', trade_name: 'tradeName', state_registration: 'stateRegistration', municipal_registration: 'municipalRegistration', account_manager_id: 'accountManagerId', brandbook_url: 'brandbookUrl', address_zip_code: 'zipCode', address_street: 'street', address_number: 'number', address_complement: 'complement', address_district: 'district', address_city: 'city', address_state: 'state', address_country: 'country' }
      cols.forEach((column, index) => { if (column === 'cnpj' && [...this.clients.values()].some((other) => other.id !== id && other.organizationId === org && other.cnpj === values[index])) throw new Error('unique cnpj'); c[map[column] ?? column] = values[index] as string | null })
      return { meta: { changes: 1 } }
    }
    if (sql.startsWith('INSERT INTO client_contacts')) {
      const [id, organizationId, clientId, name, roleTitle, email, phone, isPrimary, isActive, createdAt, updatedAt] = values
      this.contacts.set(id as string, { id: id as string, organizationId: organizationId as string, clientId: clientId as string, name: name as string, roleTitle: roleTitle as string | null, email: email as string | null, phone: phone as string | null, isPrimary: isPrimary as number, isActive: isActive as number, createdAt: createdAt as string, updatedAt: updatedAt as string }); return { meta: { changes: 1 } }
    }
    if (sql.startsWith('UPDATE client_contacts SET is_primary = 0')) {
      const [updatedAt, clientId, organizationId, excluded] = values
      for (const c of this.contacts.values()) if (c.clientId === clientId && c.organizationId === organizationId && c.id !== excluded && c.isPrimary && c.isActive) { c.isPrimary = 0; c.updatedAt = updatedAt as string }
      return { meta: { changes: 1 } }
    }
    if (sql.startsWith('UPDATE client_contacts SET is_active = 0')) {
      const c = this.contacts.get(values[1] as string)
      if (!c || c.clientId !== values[2] || c.organizationId !== values[3]) return { meta: { changes: 0 } }
      c.isActive = 0; c.isPrimary = 0; c.updatedAt = values[0] as string; return { meta: { changes: 1 } }
    }
    if (sql.startsWith('UPDATE client_contacts SET')) {
      const id = values.at(-3) as string, c = this.contacts.get(id)
      if (!c) return { meta: { changes: 0 } }
      const cols = sql.slice(sql.indexOf(' SET ') + 5, sql.indexOf(', updated_at')).split(', ').map((p) => p.split(' = ')[0])
      const map: Record<string, keyof Contact> = { role_title: 'roleTitle', is_primary: 'isPrimary', is_active: 'isActive' }
      cols.forEach((column, index) => { c[map[column] ?? column as keyof Contact] = values[index] as never }); c.updatedAt = values[cols.length] as string; return { meta: { changes: 1 } }
    }
    if (sql.startsWith('INSERT INTO contracts')) {
      const [id, organizationId, clientId, monthlyDeliverables, hourLimit, agreedDeadlineDays, revisionRounds, monthlyBalance, contractValue, startDate, endDate, status, renewalType, renewalDate, billingFrequency, billingDay, commercialTerms, notes] = values
      this.contracts.set(id as string, { id: id as string, organizationId: organizationId as string, clientId: clientId as string, monthlyDeliverables, hourLimit, agreedDeadlineDays, revisionRounds, monthlyBalance: monthlyBalance as number, contractValue: contractValue as number, startDate, endDate, status: status as string, renewalType, renewalDate, billingFrequency, billingDay, commercialTerms, notes }); return { meta: { changes: 1 } }
    }
    if (sql.startsWith('UPDATE contracts SET')) {
      const id = values.at(-2) as string, c = this.contracts.get(id)
      if (!c) return { meta: { changes: 0 } }
      const cols = sql.slice(sql.indexOf(' SET ') + 5, sql.indexOf(', updated_at')).split(', ').map((p) => p.split(' = ')[0])
      const map: Record<string, string> = { monthly_deliverables: 'monthlyDeliverables', hour_limit: 'hourLimit', agreed_deadline_days: 'agreedDeadlineDays', revision_rounds: 'revisionRounds', monthly_balance: 'monthlyBalance', contract_value: 'contractValue', start_date: 'startDate', end_date: 'endDate', renewal_type: 'renewalType', renewal_date: 'renewalDate', billing_frequency: 'billingFrequency', billing_day: 'billingDay', commercial_terms: 'commercialTerms' }
      cols.forEach((column, index) => { c[map[column] ?? column] = values[index] }); return { meta: { changes: 1 } }
    }
    return { meta: { changes: 0 } }
  }
}

function makeClient(id: string, organizationId: string, name: string, shortCode: string, accountManagerId: string | null, cnpj: string | null, imageUrl: string | null = null): Client { return { id, organizationId, name, shortCode, imageUrl, corporateName: null, tradeName: null, cnpj, stateRegistration: null, municipalRegistration: null, segment: null, units: null, accountManagerId, status: 'active', brandbookUrl: null, description: null, website: null, zipCode: null, street: null, number: null, complement: null, district: null, city: null, state: null, country: null, createdAt: now } }
function makeContact(id: string, organizationId: string, clientId: string, name: string, roleTitle: string | null, email: string | null, phone: string | null, isPrimary: number, isActive: number): Contact { return { id, organizationId, clientId, name, roleTitle, email, phone, isPrimary, isActive, createdAt: now, updatedAt: now } }
function makeContract(id: string, organizationId: string, clientId: string, contractValue: number, monthlyBalance: number, notes: string): Contract { return { id, organizationId, clientId, monthlyDeliverables: 1, hourLimit: 1, agreedDeadlineDays: 3, revisionRounds: 2, monthlyBalance, contractValue, startDate: '2026-01-01', endDate: null, status: 'active', renewalType: null, renewalDate: null, billingFrequency: null, billingDay: null, commercialTerms: null, notes } }
function req(path: string, method = 'GET', data?: Record<string, unknown>) { return new Request(`https://sixos.local${path}`, { method, headers: { Cookie: 'sixos_session=test', ...(data ? { 'Content-Type': 'application/json' } : {}) }, body: data ? JSON.stringify(data) : undefined }) }
function ctx(db: Db, request: Request, params: Record<string, string> = {}) { return { env: { DB: db }, request, params } as never }
async function body(response: Response) { return response.json() as Promise<Record<string, unknown>> }
async function test(id: string, run: () => Promise<void>) { await run(); console.log(`${id}: PASS`) }

async function main() {
  assert.equal(createHash('sha256').update(readFileSync(new URL('../migrations/0049_client_master_data.sql', import.meta.url))).digest('hex'), checksum)
  const db = new Db()
  const cg = (user: string, id: string) => { db.activeUser = user; return getClient(ctx(db, req(`/api/clients/${id}`), { id })) }
  const cp = (user: string, id: string, data: Record<string, unknown>) => { db.activeUser = user; return patchClient(ctx(db, req('', 'PATCH', data), { id })) }
  await test('CM1', async () => { const r = await cg('all', 'a1'); assert.equal(r.status, 200); assert.equal(((await body(r)).client as { name: string }).name, 'Cliente A1') })
  await test('CM2', async () => assert.equal((await cg('assigned', 'a2')).status, 200))
  await test('CM3', async () => assert.equal((await cg('assigned', 'a1')).status, 403))
  await test('CM4', async () => assert.equal((await cg('participating', 'a1')).status, 200))
  await test('CM5', async () => assert.equal((await cg('all', 'b1')).status, 403))
  await test('CM6', async () => { assert.equal((await cp('all', 'a1', { tradeName: 'Marca', corporateName: 'Razão', website: 'https://a.test', addressCity: 'São Paulo' })).status, 200); const c = db.clients.get('a1')!; assert.equal(c.tradeName, 'Marca'); assert.equal(c.corporateName, 'Razão'); assert.equal(c.website, 'https://a.test'); assert.equal(c.city, 'São Paulo') })
  await test('CM7', async () => { const before = db.clients.get('a1')!.description; assert.equal((await cp('assigned', 'a1', { description: 'negado' })).status, 403); assert.equal(db.clients.get('a1')!.description, before) })
  await test('CM8', async () => { const before = db.clients.get('a1')!.accountManagerId; assert.equal((await cp('all', 'a1', { accountManagerId: 'manager-b' })).status, 400); assert.equal(db.clients.get('a1')!.accountManagerId, before) })
  await test('CV1', async () => { assert.equal((await cp('all', 'a1', { cnpj: '12.345.678/0001-90' })).status, 200); assert.equal(db.clients.get('a1')!.cnpj, '12345678000190') })
  await test('CV2', async () => { for (const cnpj of ['1234567890123', '123456789012345', 'abcdefghijklmn']) assert.equal((await cp('all', 'a1', { cnpj })).status, 400) })
  await test('CV3', async () => assert.equal((await cp('all', 'a2', { cnpj: '12.345.678/0001-90' })).status, 409))
  await test('CV4', async () => { assert.equal((await cp('foreign', 'b1', { cnpj: '12.345.678/0001-90' })).status, 200); assert.equal(db.clients.get('b1')!.cnpj, db.clients.get('a1')!.cnpj) })
  await test('CV5', async () => assert.equal((await cp('all', 'a1', { website: 'http://a.test' })).status, 200))
  await test('CV6', async () => { for (const website of ['javascript:alert(1)', 'ftp://a.test']) assert.equal((await cp('all', 'a1', { website })).status, 400) })
  await test('CV7', async () => { assert.equal((await cp('all', 'a1', { addressCountry: 'br' })).status, 200); assert.equal(db.clients.get('a1')!.country, 'BR') })
  await test('CV8', async () => { assert.equal((await cp('all', 'a1', { status: 'wrong' })).status, 400); for (const status of ['active', 'paused', 'archived']) assert.equal((await cp('all', 'a1', { status })).status, 200) })

  const cl = (user: string, id: string) => { db.activeUser = user; return listContacts(ctx(db, req(''), { id })) }
  const cc = (user: string, id: string, data: Record<string, unknown>) => { db.activeUser = user; return createContact(ctx(db, req('', 'POST', data), { id })) }
  const cu = (user: string, id: string, contactId: string, data: Record<string, unknown>) => { db.activeUser = user; return patchContact(ctx(db, req('', 'PATCH', data), { id, contactId })) }
  await test('CT1', async () => { const r = await cl('all', 'a1'); assert.equal(r.status, 200); assert.equal(((await body(r)).contacts as unknown[]).length, 1) })
  let contactId = ''
  await test('CT2', async () => { const r = await cc('all', 'a1', { name: 'Bruno', roleTitle: 'Atendimento', email: 'BRUNO@EXAMPLE.TEST', phone: '3333', isPrimary: false, isActive: true }); assert.equal(r.status, 201); contactId = ((await body(r)).contact as { id: string }).id; assert.equal(db.contacts.get(contactId)!.email, 'bruno@example.test') })
  await test('CT3', async () => { const before = db.contacts.size; assert.equal((await cc('assigned', 'a1', { name: 'Negado' })).status, 403); assert.equal(db.contacts.size, before) })
  await test('CT4', async () => { const before = db.contacts.size; assert.equal((await cc('all', 'b1', { name: 'Negado' })).status, 403); assert.equal(db.contacts.size, before) })
  let primaryId = ''
  await test('CT5', async () => { const r = await cc('all', 'a1', { name: 'Beatriz', isPrimary: true, isActive: true }); assert.equal(r.status, 201); primaryId = ((await body(r)).contact as { id: string }).id; assert.equal(db.contacts.get('a1-primary')!.isPrimary, 0); assert.equal(db.contacts.get(primaryId)!.isPrimary, 1) })
  await test('CT6', async () => assert.equal((await cc('all', 'a1', { name: 'Caio', isPrimary: true, isActive: true })).status, 201))
  await test('CT7', async () => { const before = { ...db.contacts.get(contactId)! }; assert.equal((await cu('all', 'a1', contactId, { phone: '4444' })).status, 200); const after = db.contacts.get(contactId)!; assert.equal(after.phone, '4444'); assert.equal(after.name, before.name); assert.equal(after.email, before.email); assert.equal(after.roleTitle, before.roleTitle); assert.equal(after.isActive, before.isActive) })
  await test('CT8', async () => assert.equal((await cu('all', 'a1', 'a2-contact', { phone: 'x' })).status, 404))
  await test('CT9', async () => { db.activeUser = 'all'; assert.equal((await deleteContact(ctx(db, req('', 'DELETE'), { id: 'a1', contactId }))).status, 204); assert.equal(db.contacts.get(contactId)!.isActive, 0) })
  await test('CT10', async () => { const r = await cc('all', 'a1', { name: 'Novo', isPrimary: true, isActive: true }); assert.equal(r.status, 201); assert.equal(((await body(r)).contact as { isPrimary: number }).isPrimary, 1) })

  const cr = (user: string) => { db.activeUser = user; return listContracts(ctx(db, req(''))) }
  const ca = (user: string, data: Record<string, unknown>) => { db.activeUser = user; return createContract(ctx(db, req('', 'POST', data))) }
  const cu2 = (user: string, id: string, data: Record<string, unknown>) => { db.activeUser = user; return patchContract(ctx(db, req('', 'PATCH', data), { id })) }
  await test('CO1', async () => { const rows = await (await cr('restricted')).json() as Array<Record<string, unknown>>; assert.ok(rows.length); assert.ok(!Object.hasOwn(rows[0]!, 'contractValue')); assert.ok(!Object.hasOwn(rows[0]!, 'monthlyBalance')) })
  await test('CO2', async () => { const rows = await (await cr('all')).json() as Array<Record<string, unknown>>; assert.equal(rows[0]!.contractValue, 1000) })
  const createPayload = { clientId: 'a1', monthlyDeliverables: 2, hourLimit: 10, agreedDeadlineDays: 5, revisionRounds: 1, contractValue: 2000, monthlyBalance: 20, startDate: '2026-08-01' }
  await test('CO3', async () => { const before = db.contracts.size; assert.equal((await ca('restricted', createPayload)).status, 403); assert.equal(db.contracts.size, before) })
  await test('CO4', async () => { const r = await ca('all', createPayload); assert.equal(r.status, 201); const id = (await body(r)).id as string; assert.equal(db.contracts.get(id)!.contractValue, 2000) })
  await test('CO5', async () => { assert.equal((await cu2('restricted', 'contract-a1', { notes: 'Atualizado', renewalType: 'manual' })).status, 200); assert.equal(db.contracts.get('contract-a1')!.notes, 'Atualizado') })
  await test('CO6', async () => { const before = db.contracts.get('contract-a1')!.contractValue; assert.equal((await cu2('restricted', 'contract-a1', { contractValue: 1 })).status, 403); assert.equal(db.contracts.get('contract-a1')!.contractValue, before) })
  await test('CO7', async () => { assert.equal((await cu2('all', 'contract-a1', { contractValue: 2500 })).status, 200); assert.equal(db.contracts.get('contract-a1')!.contractValue, 2500) })
  await test('CO8', async () => { for (const type of ['manual', 'automatic']) assert.equal((await cu2('all', 'contract-a1', { renewalType: type })).status, 200); assert.equal((await cu2('all', 'contract-a1', { renewalType: 'other' })).status, 400) })
  await test('CO9', async () => { for (const day of [1, 31]) assert.equal((await cu2('all', 'contract-a1', { billingDay: day })).status, 200); for (const day of [0, 32]) assert.equal((await cu2('all', 'contract-a1', { billingDay: day })).status, 400) })
  await test('CO10', async () => { assert.equal((await ca('all', { ...createPayload, clientId: 'b1' })).status, 403); assert.equal((await cu2('all', 'contract-b1', { notes: 'negado' })).status, 404) })

  const pf = (user: string, id: string) => { db.activeUser = user; return provisionFolders(ctx(db, req('', 'POST'), { id })) }
  let newClient = ''
  await test('FL1', async () => { db.activeUser = 'all'; const r = await createAdminClient(ctx(db, req('', 'POST', { name: 'Novo', shortCode: 'NOVO' }))); assert.equal(r.status, 201); newClient = ((await body(r)).client as { id: string }).id; assert.equal([...db.folders.values()].filter((f) => f.clientId === newClient).length, 6) })
  await test('FL2', async () => { assert.equal((await pf('all', newClient)).status, 200); assert.equal([...db.folders.values()].filter((f) => f.clientId === newClient).length, 6) })
  await test('FL3', async () => { db.folders.set('legacy-logo', { id: 'legacy-logo', clientId: 'a2', slug: 'logo', name: 'Logo', position: 1 }); db.folders.set('legacy-contract', { id: 'legacy-contract', clientId: 'a2', slug: 'contrato', name: 'Contrato', position: 2 }); assert.equal((await pf('all', 'a2')).status, 200); assert.equal([...db.folders.values()].filter((f) => f.clientId === 'a2').length, 6) })
  await test('FL4', async () => assert.deepEqual([...db.folders.values()].filter((f) => f.clientId === newClient).sort((a, b) => a.position - b.position).map((f) => [f.slug, f.name]), FOLDERS))
  await test('FL5', async () => { const before = [...db.folders.values()].filter((f) => f.clientId === 'a1').length; assert.equal((await pf('assigned', 'a1')).status, 403); assert.equal([...db.folders.values()].filter((f) => f.clientId === 'a1').length, before) })
  console.log('Client master backend behavioral certification: PASS')
}

main().catch((error) => { console.error(error); process.exit(1) })
