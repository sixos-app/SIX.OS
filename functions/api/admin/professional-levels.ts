import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

type ProfessionalLevelPayload = { code?: unknown; name?: unknown; sort_order?: unknown }

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'users.manage'))) return permissionRequiredResponse()

  const { results } = await env.DB.prepare('SELECT id, code, name, sort_order, is_active FROM professional_levels WHERE organization_id = ? ORDER BY sort_order ASC, name ASC').bind(administrator.organizationId).all()
  return Response.json(results.map((row: any) => ({ ...row, is_active: row.is_active === 1 })))
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'users.manage'))) return permissionRequiredResponse()

  let payload: ProfessionalLevelPayload
  try {
    payload = await request.json() as ProfessionalLevelPayload
  } catch {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const code = normalizeText(payload.code)
  const name = normalizeText(payload.name)
  const sortOrder = typeof payload.sort_order === 'number' ? payload.sort_order : 0

  if (!code || !name) return Response.json({ error: 'Código e nome são obrigatórios' }, { status: 400 })

  const id = `level-${crypto.randomUUID()}`
  try {
    await env.DB.prepare('INSERT INTO professional_levels (id, organization_id, code, name, sort_order) VALUES (?, ?, ?, ?, ?)').bind(id, administrator.organizationId, code, name, sortOrder).run()
  } catch {
    return Response.json({ error: 'Já existe um nível com este código' }, { status: 409 })
  }

  return Response.json({ id, code, name, sort_order: sortOrder, is_active: true }, { status: 201 })
}
