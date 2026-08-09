import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../_access'

type DepartmentPayload = { code?: unknown; name?: unknown; description?: unknown; is_active?: unknown }

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export const onRequestPatch: PagesFunction<Bindings> = async ({ env, request, params }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'users.manage'))) return permissionRequiredResponse()

  const id = params.id
  if (typeof id !== 'string') return Response.json({ error: 'ID inválido' }, { status: 400 })

  let payload: DepartmentPayload
  try {
    payload = await request.json() as DepartmentPayload
  } catch {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const code = normalizeText(payload.code)
  const name = normalizeText(payload.name)
  const description = normalizeText(payload.description)
  const isActive = typeof payload.is_active === 'boolean' ? (payload.is_active ? 1 : 0) : undefined

  if (!code || !name) return Response.json({ error: 'Código e nome são obrigatórios' }, { status: 400 })

  const existing = await env.DB.prepare('SELECT id FROM departments WHERE id = ? AND organization_id = ?').bind(id, administrator.organizationId).first()
  if (!existing) return Response.json({ error: 'Departamento não encontrado' }, { status: 404 })

  try {
    if (isActive !== undefined) {
      await env.DB.prepare('UPDATE departments SET code = ?, name = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(code, name, description, isActive, id).run()
    } else {
      await env.DB.prepare('UPDATE departments SET code = ?, name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(code, name, description, id).run()
    }
  } catch {
    return Response.json({ error: 'Já existe um departamento com este código' }, { status: 409 })
  }

  return Response.json({ success: true })
}
