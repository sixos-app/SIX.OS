import { accessRequiredResponse, getAccessUser, getPermissionScope, hasPermissionV2, permissionRequiredResponse, type Bindings } from './_access'
import { canAccessClient } from './clients/_clientAccess'

type Payload = Record<string, unknown>
const statuses = ['active', 'renewed', 'expired', 'cancelled']
function own(body: Payload, key: string) { return Object.prototype.hasOwnProperty.call(body, key) }
function text(value: unknown, limit: number, field: string) { if (value === null) return null; if (typeof value !== 'string') throw new Error(`${field} inválido`); const result = value.trim(); if (result.length > limit) throw new Error(`${field} excede o limite permitido`); return result || null }
function nonNegative(value: unknown, field: string) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${field} inválido`); return value }
function date(value: unknown, field: string, nullable = true) { const result = text(value, 10, field); if (result === null && nullable) return null; if (!result || !/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`${field} inválida`); return result }
function input(body: Payload, create: boolean) {
  const value: Record<string, string | number | null> = {}
  const numeric = [['monthlyDeliverables', 'Entregas mensais', 0], ['hourLimit', 'Limite de horas', 0], ['agreedDeadlineDays', 'Prazo', 3], ['revisionRounds', 'Revisões', 2], ['monthlyBalance', 'Saldo mensal', 0], ['contractValue', 'Valor contratado', 0]] as const
  for (const [key, label, fallback] of numeric) if (create || own(body, key)) value[key] = create && !own(body, key) ? fallback : nonNegative(body[key], label)
  if (create || own(body, 'startDate')) value.startDate = create && !own(body, 'startDate') ? new Date().toISOString().slice(0, 10) : date(body.startDate, 'Data inicial', false)
  if (own(body, 'endDate')) value.endDate = date(body.endDate, 'Data final')
  if (own(body, 'status')) { if (typeof body.status !== 'string' || !statuses.includes(body.status)) throw new Error('Status inválido'); value.status = body.status }
  if (own(body, 'renewalType')) { const item = text(body.renewalType, 16, 'Tipo de renovação'); if (item && !['manual', 'automatic'].includes(item)) throw new Error('Tipo de renovação inválido'); value.renewalType = item }
  if (own(body, 'renewalDate')) value.renewalDate = date(body.renewalDate, 'Data de renovação')
  if (own(body, 'billingFrequency')) value.billingFrequency = text(body.billingFrequency, 64, 'Periodicidade')
  if (own(body, 'billingDay')) { if (body.billingDay === null) value.billingDay = null; else if (!Number.isInteger(body.billingDay) || Number(body.billingDay) < 1 || Number(body.billingDay) > 31) throw new Error('Dia de cobrança inválido'); else value.billingDay = Number(body.billingDay) }
  if (own(body, 'commercialTerms')) value.commercialTerms = text(body.commercialTerms, 4000, 'Condições comerciais')
  if (own(body, 'notes')) value.notes = text(body.notes, 4000, 'Observações')
  return value
}
function money(body: Payload) { return own(body, 'contractValue') || own(body, 'monthlyBalance') }

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env); if (!user) return accessRequiredResponse()
  const scope = await getPermissionScope(env, request, user, 'contracts.view'); if (!scope) return permissionRequiredResponse()
  let filter = '', binds: string[] = [user.organizationId]
  if (scope === 'assigned_clients') { filter = ' AND c.account_manager_id = ?'; binds.push(user.id) }
  else if (scope === 'department' && user.departmentId) { filter = ' AND c.account_manager_id IN (SELECT id FROM users WHERE department_id = ?)'; binds.push(user.departmentId) }
  else if (scope === 'participating_projects') { filter = ' AND c.id IN (SELECT missions.client_id FROM missions JOIN mission_assignees ON mission_assignees.mission_id = missions.id WHERE mission_assignees.user_id = ?)'; binds.push(user.id) }
  else if (scope !== 'all') return Response.json([])
  const canReadMoney = await hasPermissionV2(env, request, user, 'finance.view') || await hasPermissionV2(env, request, user, 'finance.manage')
  const { results } = await env.DB.prepare(`SELECT ctr.id, ctr.client_id AS clientId, ctr.monthly_deliverables AS monthlyDeliverables, ctr.hour_limit AS hourLimit, ctr.agreed_deadline_days AS agreedDeadlineDays, ctr.revision_rounds AS revisionRounds, ctr.monthly_balance AS monthlyBalance, ctr.contract_value AS contractValue, ctr.start_date AS startDate, ctr.end_date AS endDate, ctr.status, ctr.renewal_type AS renewalType, ctr.renewal_date AS renewalDate, ctr.billing_frequency AS billingFrequency, ctr.billing_day AS billingDay, ctr.commercial_terms AS commercialTerms, ctr.notes, c.name AS clientName FROM contracts ctr JOIN clients c ON ctr.client_id = c.id AND c.organization_id = ctr.organization_id WHERE ctr.organization_id = ?${filter} ORDER BY ctr.created_at DESC`).bind(...binds).all<Record<string, unknown>>()
  return Response.json((results ?? []).map((row) => { if (canReadMoney) return row; const { contractValue: _value, monthlyBalance: _balance, ...safe } = row; return safe }))
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env); if (!user) return accessRequiredResponse()
  const body = await request.json().catch(() => null) as Payload | null
  if (!body || typeof body.clientId !== 'string' || !body.clientId) return Response.json({ error: 'Cliente é obrigatório' }, { status: 400 })
  if (!await canAccessClient(env, request, user, body.clientId, 'contracts.create')) return permissionRequiredResponse()
  if (money(body) && !(await hasPermissionV2(env, request, user, 'finance.manage'))) return permissionRequiredResponse()
  let values: Record<string, string | number | null>; try { values = input(body, true) } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Dados do contrato inválidos' }, { status: 400 }) }
  const client = await env.DB.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ? LIMIT 1').bind(body.clientId, user.organizationId).first<{ id: string }>(); if (!client) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  const id = `contract-${crypto.randomUUID()}`, now = new Date().toISOString()
  await env.DB.prepare(`INSERT INTO contracts (id, organization_id, client_id, monthly_deliverables, hour_limit, agreed_deadline_days, revision_rounds, monthly_balance, contract_value, start_date, end_date, status, renewal_type, renewal_date, billing_frequency, billing_day, commercial_terms, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, user.organizationId, client.id, values.monthlyDeliverables, values.hourLimit, values.agreedDeadlineDays, values.revisionRounds, values.monthlyBalance, values.contractValue, values.startDate, values.endDate ?? null, values.status ?? 'active', values.renewalType ?? null, values.renewalDate ?? null, values.billingFrequency ?? null, values.billingDay ?? null, values.commercialTerms ?? null, values.notes ?? null, now, now).run()
  return Response.json({ id, clientId: client.id, ...values, status: values.status ?? 'active' }, { status: 201 })
}
