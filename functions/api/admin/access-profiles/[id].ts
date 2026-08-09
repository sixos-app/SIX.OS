import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../_access'

type AccessProfilePayload = { name?: unknown; description?: unknown; is_active?: unknown }

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request, params }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'roles.manage'))) return permissionRequiredResponse()

  const id = params.id
  if (typeof id !== 'string') return Response.json({ error: 'ID inválido' }, { status: 400 })

  const profile = await env.DB.prepare('SELECT id, code, name, description, is_system, is_active FROM access_profiles WHERE id = ? AND organization_id = ?').bind(id, administrator.organizationId).first<any>()
  if (!profile) return Response.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const { results: permissions } = await env.DB.prepare('SELECT permission_code, scope FROM profile_permissions WHERE profile_id = ?').bind(id).all()

  return Response.json({
    ...profile,
    is_system: profile.is_system === 1,
    is_active: profile.is_active === 1,
    permissions
  })
}

export const onRequestPatch: PagesFunction<Bindings> = async ({ env, request, params }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'roles.manage'))) return permissionRequiredResponse()

  const id = params.id
  if (typeof id !== 'string') return Response.json({ error: 'ID inválido' }, { status: 400 })

  let payload: AccessProfilePayload
  try {
    payload = await request.json() as AccessProfilePayload
  } catch {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const name = normalizeText(payload.name)
  const description = normalizeText(payload.description)
  const isActive = typeof payload.is_active === 'boolean' ? (payload.is_active ? 1 : 0) : undefined

  if (!name && isActive === undefined) return Response.json({ error: 'Nenhum dado para atualizar' }, { status: 400 })

  const existing = await env.DB.prepare('SELECT id, is_system FROM access_profiles WHERE id = ? AND organization_id = ?').bind(id, administrator.organizationId).first<any>()
  if (!existing) return Response.json({ error: 'Perfil não encontrado' }, { status: 404 })

  // Não permitir inativar o profile-admin
  if (isActive === 0 && existing.is_system && existing.id === 'profile-admin') {
    return Response.json({ error: 'Não é possível desativar o perfil de Administrador Técnico' }, { status: 409 })
  }

  try {
    if (isActive !== undefined && name) {
      await env.DB.prepare('UPDATE access_profiles SET name = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(name, description, isActive, id).run()
    } else if (isActive !== undefined) {
      await env.DB.prepare('UPDATE access_profiles SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(isActive, id).run()
    } else {
      await env.DB.prepare('UPDATE access_profiles SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(name, description, id).run()
    }
  } catch {
    return Response.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
  }

  return Response.json({ success: true })
}
