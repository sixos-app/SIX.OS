import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'
import { canAccessClient } from '../clients/_clientAccess'

type Payload = Record<string, unknown>
const statuses = ['active', 'renewed', 'expired', 'cancelled']
function own(body: Payload, key: string) { return Object.prototype.hasOwnProperty.call(body, key) }
function text(value: unknown, limit: number, field: string) { if (value === null) return null; if (typeof value !== 'string') throw new Error(`${field} inválido`); const result = value.trim(); if (result.length > limit) throw new Error(`${field} excede o limite permitido`); return result || null }
function numeric(value: unknown, field: string) { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${field} inválido`); return value }
function date(value: unknown, field: string, nullable = true) { const result = text(value, 10, field); if (result === null && nullable) return null; if (!result || !/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`${field} inválida`); return result }

export const onRequestPatch: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env); if (!user) return accessRequiredResponse()
  const contract = await env.DB.prepare('SELECT id, client_id AS clientId FROM contracts WHERE id = ? AND organization_id = ? LIMIT 1').bind(params.id, user.organizationId).first<{ id: string; clientId: string }>()
  if (!contract) return Response.json({ error: 'Contrato não encontrado' }, { status: 404 })
  if (!await canAccessClient(env, request, user, contract.clientId, 'contracts.manage')) return permissionRequiredResponse()
  const body = await request.json().catch(() => null) as Payload | null; if (!body) return Response.json({ error: 'Dados do contrato inválidos' }, { status: 400 })
  if ((own(body, 'contractValue') || own(body, 'monthlyBalance')) && !(await hasPermissionV2(env, request, user, 'finance.manage'))) return permissionRequiredResponse()
  const values: Array<string | number | null> = [], assignments: string[] = []
  const set = (column: string, value: string | number | null) => { assignments.push(`${column} = ?`); values.push(value) }
  try {
    for (const [key, column, label] of [['monthlyDeliverables', 'monthly_deliverables', 'Entregas mensais'], ['hourLimit', 'hour_limit', 'Limite de horas'], ['agreedDeadlineDays', 'agreed_deadline_days', 'Prazo'], ['revisionRounds', 'revision_rounds', 'Revisões'], ['monthlyBalance', 'monthly_balance', 'Saldo mensal'], ['contractValue', 'contract_value', 'Valor contratado']] as const) if (own(body, key)) set(column, numeric(body[key], label))
    if (own(body, 'startDate')) set('start_date', date(body.startDate, 'Data inicial', false))
    if (own(body, 'endDate')) set('end_date', date(body.endDate, 'Data final'))
    if (own(body, 'status')) { if (typeof body.status !== 'string' || !statuses.includes(body.status)) throw new Error('Status inválido'); set('status', body.status) }
    if (own(body, 'renewalType')) { const value = text(body.renewalType, 16, 'Tipo de renovação'); if (value && !['manual', 'automatic'].includes(value)) throw new Error('Tipo de renovação inválido'); set('renewal_type', value) }
    if (own(body, 'renewalDate')) set('renewal_date', date(body.renewalDate, 'Data de renovação'))
    if (own(body, 'billingFrequency')) set('billing_frequency', text(body.billingFrequency, 64, 'Periodicidade'))
    if (own(body, 'billingDay')) { if (body.billingDay === null) set('billing_day', null); else if (!Number.isInteger(body.billingDay) || Number(body.billingDay) < 1 || Number(body.billingDay) > 31) throw new Error('Dia de cobrança inválido'); else set('billing_day', Number(body.billingDay)) }
    if (own(body, 'commercialTerms')) set('commercial_terms', text(body.commercialTerms, 4000, 'Condições comerciais'))
    if (own(body, 'notes')) set('notes', text(body.notes, 4000, 'Observações'))
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Dados do contrato inválidos' }, { status: 400 }) }
  if (!assignments.length) return Response.json({ error: 'Nenhum campo atualizável foi informado' }, { status: 400 })
  await env.DB.prepare(`UPDATE contracts SET ${assignments.join(', ')}, updated_at = ? WHERE id = ? AND organization_id = ?`).bind(...values, new Date().toISOString(), contract.id, user.organizationId).run()
  return Response.json({ ok: true })
}
