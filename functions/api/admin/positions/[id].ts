import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../_access'

type PositionPayload = { code?: unknown; name?: unknown; description?: unknown; department_id?: unknown; is_active?: unknown }

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export const onRequestPatch: PagesFunction<Bindings> = async ({ env, request, params }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'users.manage'))) return permissionRequiredResponse()

  const id = params.id
  if (typeof id !== 'string') return Response.json({ error: 'ID inválido' }, { status: 400 })

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
  const isActive = typeof payload.is_active === 'boolean' ? (payload.is_active ? 1 : 0) : undefined

  if (!code || !name) return Response.json({ error: 'Código e nome são obrigatórios' }, { status: 400 })

  const existing = await env.DB.prepare('SELECT id FROM professional_positions WHERE id = ? AND organization_id = ?').bind(id, administrator.organizationId).first()
  if (!existing) return Response.json({ error: 'Cargo não encontrado' }, { status: 404 })

  if (departmentId) {
    const dept = await env.DB.prepare('SELECT id FROM departments WHERE id = ? AND organization_id = ?').bind(departmentId, administrator.organizationId).first()
    if (!dept) return Response.json({ error: 'Departamento inválido' }, { status: 400 })
  }

  try {
    if (isActive !== undefined) {
      await env.DB.prepare('UPDATE professional_positions SET code = ?, name = ?, description = ?, department_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(code, name, description, departmentId, isActive, id).run()
    } else {
      await env.DB.prepare('UPDATE professional_positions SET code = ?, name = ?, description = ?, department_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(code, name, description, departmentId, id).run()
    }
  } catch {
    return Response.json({ error: 'Já existe um cargo com este código' }, { status: 409 })
  }

  return Response.json({ success: true })
}
