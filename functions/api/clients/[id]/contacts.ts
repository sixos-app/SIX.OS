import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../../_access'
import { canAccessClient } from '../_clientAccess'
import { normalizeOptionalString } from '../_clientMaster'

type ContactPayload = { name?: unknown; roleTitle?: unknown; email?: unknown; phone?: unknown; isPrimary?: unknown; isActive?: unknown }
const contactFields = 'id, name, role_title AS roleTitle, email, phone, is_primary AS isPrimary, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt'

function boolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') throw new Error(`${field} inválido`)
  return value ? 1 : 0
}
function contactInput(payload: ContactPayload, requiredName: boolean) {
  const values: Record<string, string | number | null> = {}
  if (Object.prototype.hasOwnProperty.call(payload, 'name')) { const name = normalizeOptionalString(payload.name, 160, 'Nome do contato'); if (!name) throw new Error('Nome do contato é obrigatório'); values.name = name }
  else if (requiredName) throw new Error('Nome do contato é obrigatório')
  if (Object.prototype.hasOwnProperty.call(payload, 'roleTitle')) values.roleTitle = normalizeOptionalString(payload.roleTitle, 120, 'Cargo')
  if (Object.prototype.hasOwnProperty.call(payload, 'email')) { const email = normalizeOptionalString(payload.email, 320, 'E-mail'); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido'); values.email = email?.toLowerCase() ?? null }
  if (Object.prototype.hasOwnProperty.call(payload, 'phone')) values.phone = normalizeOptionalString(payload.phone, 48, 'Telefone')
  if (Object.prototype.hasOwnProperty.call(payload, 'isPrimary')) values.isPrimary = boolean(payload.isPrimary, 'Contato principal')
  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) values.isActive = boolean(payload.isActive, 'Status do contato')
  return values
}
async function requireClient(env: Bindings, request: Request, user: Awaited<ReturnType<typeof getAccessUser>>, clientId: string, permission: string) {
  if (!user) return null
  if (!await canAccessClient(env, request, user, clientId, permission)) return null
  return env.DB.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ? LIMIT 1').bind(clientId, user.organizationId).first<{ id: string }>()
}

export const onRequestGet: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env); if (!user) return accessRequiredResponse()
  const client = await requireClient(env, request, user, params.id as string, 'clients.view'); if (!client) return permissionRequiredResponse()
  const contacts = await env.DB.prepare(`SELECT ${contactFields} FROM client_contacts WHERE client_id = ? AND organization_id = ? ORDER BY is_active DESC, is_primary DESC, name ASC`).bind(client.id, user.organizationId).all()
  return Response.json({ contacts: contacts.results ?? [] })
}

export const onRequestPost: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env); if (!user) return accessRequiredResponse()
  const client = await requireClient(env, request, user, params.id as string, 'clients.manage'); if (!client) return permissionRequiredResponse()
  const payload = await request.json().catch(() => null) as ContactPayload | null
  if (!payload) return Response.json({ error: 'Dados do contato inválidos' }, { status: 400 })
  let input: Record<string, string | number | null>
  try { input = contactInput(payload, true) } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Dados do contato inválidos' }, { status: 400 }) }
  const isPrimary = input.isPrimary ?? 0, isActive = input.isActive ?? 1, id = `client-contact-${crypto.randomUUID()}`, now = new Date().toISOString()
  const statements = []
  if (isPrimary === 1 && isActive === 1) statements.push(env.DB.prepare('UPDATE client_contacts SET is_primary = 0, updated_at = ? WHERE client_id = ? AND organization_id = ? AND is_primary = 1 AND is_active = 1').bind(now, client.id, user.organizationId))
  statements.push(env.DB.prepare('INSERT INTO client_contacts (id, organization_id, client_id, name, role_title, email, phone, is_primary, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, user.organizationId, client.id, input.name, input.roleTitle ?? null, input.email ?? null, input.phone ?? null, isPrimary, isActive, now, now))
  await env.DB.batch(statements)
  const contact = await env.DB.prepare(`SELECT ${contactFields} FROM client_contacts WHERE id = ? AND client_id = ? AND organization_id = ?`).bind(id, client.id, user.organizationId).first()
  return Response.json({ contact }, { status: 201 })
}
