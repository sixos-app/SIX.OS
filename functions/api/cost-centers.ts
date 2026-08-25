import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from './_access'
import { canManageCostCenters, canViewCostCenters } from './_costCenterAccess'

const costCenterTypes = ['general', 'department', 'project', 'mission'] as const
type CostCenterType = typeof costCenterTypes[number]
type CostCenterInput = {
  name: string
  code: string
  type: CostCenterType
  description: string | null
}

function isCostCenterType(value: unknown): value is CostCenterType {
  return typeof value === 'string' && costCenterTypes.some((type) => type === value)
}

function parseCostCenterInput(value: unknown): CostCenterInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const type = body.type
  const description = typeof body.description === 'string' ? body.description.trim() || null : null

  if (!name || !code || !isCostCenterType(type)) return null
  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') return null
  return { name, code, type, description }
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await canViewCostCenters(env, request, user))) return permissionRequiredResponse()

  const { results } = await env.DB.prepare(`
    SELECT id, name, code, type, description, created_at AS createdAt
    FROM cost_centers
    WHERE organization_id = ?
    ORDER BY name ASC
  `).bind(user.organizationId).all()

  return Response.json(results ?? [])
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await canManageCostCenters(env, request, user))) {
    return permissionRequiredResponse()
  }

  const body = parseCostCenterInput(await request.json().catch(() => null))
  if (!body) {
    return Response.json({ error: 'Nome, código e tipo são obrigatórios' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  try {
    await env.DB.prepare(`
      INSERT INTO cost_centers (id, organization_id, name, code, type, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, user.organizationId, body.name, body.code, body.type, body.description || null, now, now
    ).run()
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return Response.json({ error: 'Já existe um centro de custo com este código' }, { status: 409 })
    }
    throw error
  }

  return Response.json({ id, name: body.name, code: body.code, type: body.type, description: body.description }, { status: 201 })
}
