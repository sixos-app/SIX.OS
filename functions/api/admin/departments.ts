import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

type DepartmentPayload = { code?: unknown; name?: unknown; description?: unknown; is_active?: unknown }

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'users.manage'))) return permissionRequiredResponse()

  const { results } = await env.DB.prepare('SELECT id, code, name, description, is_active FROM departments WHERE organization_id = ? ORDER BY name ASC').bind(administrator.organizationId).all()
  return Response.json(results.map((row: any) => ({ ...row, is_active: row.is_active === 1 })))
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'users.manage'))) return permissionRequiredResponse()

  let payload: DepartmentPayload
  try {
    payload = await request.json() as DepartmentPayload
  } catch {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const code = normalizeText(payload.code)
  const name = normalizeText(payload.name)
  const description = normalizeText(payload.description)
  if (!code || !name) return Response.json({ error: 'Código e nome são obrigatórios' }, { status: 400 })

  const id = `dept-${crypto.randomUUID()}`
  try {
    await env.DB.prepare('INSERT INTO departments (id, organization_id, code, name, description) VALUES (?, ?, ?, ?, ?)').bind(id, administrator.organizationId, code, name, description).run()
  } catch {
    return Response.json({ error: 'Já existe um departamento com este código' }, { status: 409 })
  }

  return Response.json({ id, code, name, description, is_active: true }, { status: 201 })
}

