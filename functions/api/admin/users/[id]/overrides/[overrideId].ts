import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../../../_access'

export const onRequestDelete: PagesFunction<Bindings> = async ({ env, request, params }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  
  if (!(await hasPermissionV2(env, request, administrator, 'roles.manage'))) return permissionRequiredResponse()

  const id = params.id
  const overrideId = params.overrideId
  if (typeof id !== 'string' || typeof overrideId !== 'string') return Response.json({ error: 'IDs inválidos' }, { status: 400 })

  const targetUser = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ?').bind(id, administrator.organizationId).first()
  if (!targetUser) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const override = await env.DB.prepare('SELECT id, permission_code FROM user_permission_overrides WHERE id = ? AND user_id = ?').bind(overrideId, id).first()
  if (!override) return Response.json({ error: 'Override não encontrado' }, { status: 404 })

  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM user_permission_overrides WHERE id = ? AND user_id = ?').bind(overrideId, id),
      env.DB.prepare('INSERT INTO access_audit_log (id, organization_id, actor_user_id, target_user_id, action, resource_type, resource_id, before_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
        `audit-${crypto.randomUUID()}`, administrator.organizationId, administrator.id, id, 'DELETE_OVERRIDE', 'user_override', overrideId,
        JSON.stringify(override)
      )
    ])
  } catch {
    return Response.json({ error: 'Erro ao remover override' }, { status: 500 })
  }

  return Response.json({ success: true })
}
