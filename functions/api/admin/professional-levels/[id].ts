import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../_access'

type ProfessionalLevelPayload = { code?: unknown; name?: unknown; sort_order?: unknown; is_active?: unknown }

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export const onRequestPatch: PagesFunction<Bindings> = async ({ env, request, params }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'users.manage'))) return permissionRequiredResponse()

  const id = params.id
  if (typeof id !== 'string') return Response.json({ error: 'ID inválido' }, { status: 400 })

  let payload: ProfessionalLevelPayload
  try {
    payload = await request.json() as ProfessionalLevelPayload
  } catch {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const code = normalizeText(payload.code)
  const name = normalizeText(payload.name)
  const sortOrder = typeof payload.sort_order === 'number' ? payload.sort_order : undefined
  const isActive = typeof payload.is_active === 'boolean' ? (payload.is_active ? 1 : 0) : undefined

  if (!code || !name) return Response.json({ error: 'Código e nome são obrigatórios' }, { status: 400 })

  const existing = await env.DB.prepare('SELECT id FROM professional_levels WHERE id = ? AND organization_id = ?').bind(id, administrator.organizationId).first()
  if (!existing) return Response.json({ error: 'Nível profissional não encontrado' }, { status: 404 })

  try {
    let updateQuery = 'UPDATE professional_levels SET code = ?, name = ?'
    const binds: any[] = [code, name]

    if (sortOrder !== undefined) {
      updateQuery += ', sort_order = ?'
      binds.push(sortOrder)
    }

    if (isActive !== undefined) {
      updateQuery += ', is_active = ?'
      binds.push(isActive)
    }

    updateQuery += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    binds.push(id)

    await env.DB.prepare(updateQuery).bind(...binds).run()
  } catch {
    return Response.json({ error: 'Já existe um nível com este código' }, { status: 409 })
  }

  return Response.json({ success: true })
}
