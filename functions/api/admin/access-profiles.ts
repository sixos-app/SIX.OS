import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

type AccessProfilePayload = { code?: unknown; name?: unknown; description?: unknown }

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'roles.manage'))) return permissionRequiredResponse()

  const { results } = await env.DB.prepare(`
    SELECT
      ap.id, ap.code, ap.name, ap.description, ap.is_system, ap.is_active,
      (SELECT COUNT(id) FROM users WHERE access_profile_id = ap.id AND status != 'inactive') as users_count,
      (SELECT COUNT(*) FROM profile_permissions WHERE profile_id = ap.id) as permissions_count
    FROM access_profiles ap
    WHERE ap.organization_id = ?
    ORDER BY ap.name ASC
  `).bind(administrator.organizationId).all()
  
  return Response.json(results.map((row: any) => ({
    ...row,
    is_system: row.is_system === 1,
    is_active: row.is_active === 1
  })))
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'roles.manage'))) return permissionRequiredResponse()

  let payload: AccessProfilePayload
  try {
    payload = await request.json() as AccessProfilePayload
  } catch {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const code = normalizeText(payload.code)
  const name = normalizeText(payload.name)
  const description = normalizeText(payload.description)

  if (!code || !name) return Response.json({ error: 'Código e nome são obrigatórios' }, { status: 400 })

  const id = `profile-${crypto.randomUUID()}`
  try {
    await env.DB.prepare('INSERT INTO access_profiles (id, organization_id, code, name, description, is_system, is_active) VALUES (?, ?, ?, ?, ?, 0, 1)').bind(id, administrator.organizationId, code, name, description).run()
  } catch {
    return Response.json({ error: 'Já existe um perfil de acesso com este código' }, { status: 409 })
  }

  return Response.json({ id, code, name, description, is_system: false, is_active: true, users_count: 0, permissions_count: 0 }, { status: 201 })
}
