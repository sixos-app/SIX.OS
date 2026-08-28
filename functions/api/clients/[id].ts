import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../_access'
import { canAccessClient } from './_clientAccess'
import { normalizeCnpj, normalizeCountry, normalizeOptionalString, normalizeWebsite } from './_clientMaster'

type ClientRow = {
  id: string; name: string; shortCode: string | null; imageUrl: string | null; corporateName: string | null; tradeName: string | null
  cnpj: string | null; stateRegistration: string | null; municipalRegistration: string | null; segment: string | null; units: string | null
  accountManagerId: string | null; status: string; brandbookUrl: string | null; description: string | null; website: string | null
  zipCode: string | null; street: string | null; number: string | null; complement: string | null; district: string | null; city: string | null; state: string | null; country: string | null; createdAt: string
}
type UpdateClientPayload = Record<string, unknown>

const selectClient = `SELECT id, name, short_code AS shortCode, image_url AS imageUrl, corporate_name AS corporateName, trade_name AS tradeName, cnpj, state_registration AS stateRegistration, municipal_registration AS municipalRegistration, segment, units, account_manager_id AS accountManagerId, status, brandbook_url AS brandbookUrl, description, website, address_zip_code AS zipCode, address_street AS street, address_number AS number, address_complement AS complement, address_district AS district, address_city AS city, address_state AS state, address_country AS country, created_at AS createdAt FROM clients WHERE id = ? AND organization_id = ? LIMIT 1`

function responseClient(client: ClientRow) {
  return { ...client, address: { zipCode: client.zipCode, street: client.street, number: client.number, complement: client.complement, district: client.district, city: client.city, state: client.state, country: client.country } }
}
function hasOwn(payload: UpdateClientPayload, key: string) { return Object.prototype.hasOwnProperty.call(payload, key) }
function normalizeImage(value: unknown) {
  if (value === null) return null
  if (typeof value !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || value.length > 350000) throw new Error('Imagem inválida')
  return value
}

export const onRequestGet: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!await canAccessClient(env, request, user, params.id as string, 'clients.view')) return permissionRequiredResponse()
  const client = await env.DB.prepare(selectClient).bind(params.id, user.organizationId).first<ClientRow>()
  if (!client) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  return Response.json({ client: responseClient(client) })
}

export const onRequestPatch: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const existing = await env.DB.prepare(selectClient).bind(params.id, user.organizationId).first<ClientRow>()
  if (!existing) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  if (!await canAccessClient(env, request, user, existing.id, 'clients.manage')) return permissionRequiredResponse()
  const payload = await request.json().catch(() => null) as UpdateClientPayload | null
  if (!payload || Array.isArray(payload)) return Response.json({ error: 'Dados do cliente inválidos' }, { status: 400 })

  const values: Array<string | null> = [], assignments: string[] = []
  const set = (column: string, value: string | null) => { assignments.push(`${column} = ?`); values.push(value) }
  try {
    if (hasOwn(payload, 'name')) { const value = normalizeOptionalString(payload.name, 120, 'Nome'); if (!value) throw new Error('Nome é obrigatório'); set('name', value) }
    if (hasOwn(payload, 'shortCode')) { const value = payload.shortCode === null ? null : normalizeOptionalString(payload.shortCode, 6, 'Sigla')?.toUpperCase() ?? null; if (value !== null && !/^[A-Z0-9]{2,6}$/.test(value)) throw new Error('Sigla deve ter de 2 a 6 caracteres'); set('short_code', value) }
    if (hasOwn(payload, 'imageUrl')) set('image_url', normalizeImage(payload.imageUrl))
    if (hasOwn(payload, 'corporateName')) set('corporate_name', normalizeOptionalString(payload.corporateName, 160, 'Razão social'))
    if (hasOwn(payload, 'tradeName')) set('trade_name', normalizeOptionalString(payload.tradeName, 160, 'Nome fantasia'))
    if (hasOwn(payload, 'cnpj')) set('cnpj', normalizeCnpj(payload.cnpj))
    if (hasOwn(payload, 'stateRegistration')) set('state_registration', normalizeOptionalString(payload.stateRegistration, 32, 'Inscrição estadual'))
    if (hasOwn(payload, 'municipalRegistration')) set('municipal_registration', normalizeOptionalString(payload.municipalRegistration, 32, 'Inscrição municipal'))
    if (hasOwn(payload, 'segment')) set('segment', normalizeOptionalString(payload.segment, 160, 'Segmento'))
    if (hasOwn(payload, 'units')) set('units', normalizeOptionalString(payload.units, 500, 'Unidades'))
    if (hasOwn(payload, 'brandbookUrl')) set('brandbook_url', normalizeOptionalString(payload.brandbookUrl, 2048, 'Brandbook'))
    if (hasOwn(payload, 'description')) set('description', normalizeOptionalString(payload.description, 1200, 'Descrição'))
    if (hasOwn(payload, 'website')) set('website', normalizeWebsite(payload.website))
    if (hasOwn(payload, 'addressZipCode')) set('address_zip_code', normalizeOptionalString(payload.addressZipCode, 16, 'CEP'))
    if (hasOwn(payload, 'addressStreet')) set('address_street', normalizeOptionalString(payload.addressStreet, 160, 'Logradouro'))
    if (hasOwn(payload, 'addressNumber')) set('address_number', normalizeOptionalString(payload.addressNumber, 32, 'Número'))
    if (hasOwn(payload, 'addressComplement')) set('address_complement', normalizeOptionalString(payload.addressComplement, 120, 'Complemento'))
    if (hasOwn(payload, 'addressDistrict')) set('address_district', normalizeOptionalString(payload.addressDistrict, 120, 'Bairro'))
    if (hasOwn(payload, 'addressCity')) set('address_city', normalizeOptionalString(payload.addressCity, 120, 'Cidade'))
    if (hasOwn(payload, 'addressState')) set('address_state', normalizeOptionalString(payload.addressState, 64, 'Estado')?.toUpperCase() ?? null)
    if (hasOwn(payload, 'addressCountry')) set('address_country', normalizeCountry(payload.addressCountry))
    if (hasOwn(payload, 'status')) { if (typeof payload.status !== 'string' || !['active', 'paused', 'archived'].includes(payload.status)) throw new Error('Status inválido'); set('status', payload.status) }
    if (hasOwn(payload, 'accountManagerId')) {
      if (payload.accountManagerId === null) set('account_manager_id', null)
      else {
        if (typeof payload.accountManagerId !== 'string' || !payload.accountManagerId) throw new Error('Responsável inválido')
        const manager = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? LIMIT 1').bind(payload.accountManagerId, user.organizationId).first()
        if (!manager) return Response.json({ error: 'Responsável inválido' }, { status: 400 })
        set('account_manager_id', payload.accountManagerId)
      }
    }
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Dados do cliente inválidos' }, { status: 400 }) }
  if (!assignments.length) return Response.json({ error: 'Nenhum campo atualizável foi informado' }, { status: 400 })
  try { await env.DB.prepare(`UPDATE clients SET ${assignments.join(', ')} WHERE id = ? AND organization_id = ?`).bind(...values, existing.id, user.organizationId).run() }
  catch { return Response.json({ error: 'Conflito ao atualizar cliente' }, { status: 409 }) }
  const client = await env.DB.prepare(selectClient).bind(existing.id, user.organizationId).first<ClientRow>()
  if (!client) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  return Response.json({ description: client.description, client: responseClient(client) })
}
