import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../../../_access'
import { canAccessClient } from '../../_clientAccess'
import { normalizeOptionalString } from '../../_clientMaster'

type ContactPayload = { name?: unknown; roleTitle?: unknown; email?: unknown; phone?: unknown; isPrimary?: unknown; isActive?: unknown }
const select = 'SELECT id, name, role_title AS roleTitle, email, phone, is_primary AS isPrimary, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt FROM client_contacts WHERE id = ? AND client_id = ? AND organization_id = ? LIMIT 1'
function own(body: ContactPayload, key: keyof ContactPayload) { return Object.prototype.hasOwnProperty.call(body, key) }
function bool(value: unknown, name: string) { if (typeof value !== 'boolean') throw new Error(`${name} inválido`); return value ? 1 : 0 }

async function access(env: Bindings, request: Request, user: Awaited<ReturnType<typeof getAccessUser>>, clientId: string) {
  return Boolean(user && await canAccessClient(env, request, user, clientId, 'clients.manage'))
}

export const onRequestPatch: PagesFunction<Bindings, 'id' | 'contactId'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env); if (!user) return accessRequiredResponse()
  if (!await access(env, request, user, params.id as string)) return permissionRequiredResponse()
  const contact = await env.DB.prepare(select).bind(params.contactId, params.id, user.organizationId).first<{ id: string; isPrimary: number; isActive: number }>()
  if (!contact) return Response.json({ error: 'Contato não encontrado' }, { status: 404 })
  const body = await request.json().catch(() => null) as ContactPayload | null
  if (!body) return Response.json({ error: 'Dados do contato inválidos' }, { status: 400 })
  const values: Array<string | number | null> = [], assignments: string[] = []
  const set = (column: string, value: string | number | null) => { assignments.push(`${column} = ?`); values.push(value) }
  let nextPrimary = contact.isPrimary, nextActive = contact.isActive
  try {
    if (own(body, 'name')) { const value = normalizeOptionalString(body.name, 160, 'Nome do contato'); if (!value) throw new Error('Nome do contato é obrigatório'); set('name', value) }
    if (own(body, 'roleTitle')) set('role_title', normalizeOptionalString(body.roleTitle, 120, 'Cargo'))
    if (own(body, 'email')) { const value = normalizeOptionalString(body.email, 320, 'E-mail'); if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('E-mail inválido'); set('email', value?.toLowerCase() ?? null) }
    if (own(body, 'phone')) set('phone', normalizeOptionalString(body.phone, 48, 'Telefone'))
    if (own(body, 'isPrimary')) { nextPrimary = bool(body.isPrimary, 'Contato principal'); set('is_primary', nextPrimary) }
    if (own(body, 'isActive')) { nextActive = bool(body.isActive, 'Status do contato'); set('is_active', nextActive) }
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Dados do contato inválidos' }, { status: 400 }) }
  if (!assignments.length) return Response.json({ error: 'Nenhum campo atualizável foi informado' }, { status: 400 })
  const now = new Date().toISOString(), statements = []
  if (nextPrimary === 1 && nextActive === 1) statements.push(env.DB.prepare('UPDATE client_contacts SET is_primary = 0, updated_at = ? WHERE client_id = ? AND organization_id = ? AND id <> ? AND is_primary = 1 AND is_active = 1').bind(now, params.id, user.organizationId, contact.id))
  statements.push(env.DB.prepare(`UPDATE client_contacts SET ${assignments.join(', ')}, updated_at = ? WHERE id = ? AND client_id = ? AND organization_id = ?`).bind(...values, now, contact.id, params.id, user.organizationId))
  try { await env.DB.batch(statements) } catch { return Response.json({ error: 'Conflito ao atualizar contato' }, { status: 409 }) }
  const updated = await env.DB.prepare(select).bind(contact.id, params.id, user.organizationId).first()
  return Response.json({ contact: updated })
}

export const onRequestDelete: PagesFunction<Bindings, 'id' | 'contactId'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env); if (!user) return accessRequiredResponse()
  if (!await access(env, request, user, params.id as string)) return permissionRequiredResponse()
  const result = await env.DB.prepare('UPDATE client_contacts SET is_active = 0, is_primary = 0, updated_at = ? WHERE id = ? AND client_id = ? AND organization_id = ?').bind(new Date().toISOString(), params.contactId, params.id, user.organizationId).run()
  if (!result.meta.changes) return Response.json({ error: 'Contato não encontrado' }, { status: 404 })
  return new Response(null, { status: 204 })
}
