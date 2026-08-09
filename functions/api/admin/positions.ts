import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

type PositionPayload = { code?: unknown; name?: unknown; description?: unknown; department_id?: unknown }

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'users.manage'))) return permissionRequiredResponse()

  const { results } = await env.DB.prepare('SELECT id, code, name, description, department_id, is_active FROM professional_positions WHERE organization_id = ? ORDER BY name ASC').bind(administrator.organizationId).all()
  return Response.json(results.map((row: any) => ({ ...row, is_active: row.is_active === 1 })))
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'users.manage'))) return permissionRequiredResponse()

  let payload: PositionPayload
  try {
    payload = await request.json() as PositionPayload
  } catch {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const code = normalizeText(payload.code)
  const name = normalizeText(payload.name)
  const description = normalizeText(payload.description)
  const departmentId = normalizeText(payload.department_id) || null

  if (!code || !name) return Response.json({ error: 'Código e nome são obrigatórios' }, { status: 400 })

  if (departmentId) {
    const dept = await env.DB.prepare('SELECT id FROM departments WHERE id = ? AND organization_id = ?').bind(departmentId, administrator.organizationId).first()
    if (!dept) return Response.json({ error: 'Departamento inválido' }, { status: 400 })
  }

  const id = `pos-${crypto.randomUUID()}`
  try {
    await env.DB.prepare('INSERT INTO professional_positions (id, organization_id, code, name, description, department_id) VALUES (?, ?, ?, ?, ?, ?)').bind(id, administrator.organizationId, code, name, description, departmentId).run()
  } catch {
    return Response.json({ error: 'Já existe um cargo com este código' }, { status: 409 })
  }

  return Response.json({ id, code, name, description, department_id: departmentId, is_active: true }, { status: 201 })
}
