import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../../_access'

type PermissionInput = {
  permission_code: string
  scope: 'own' | 'team' | 'department' | 'assigned_clients' | 'participating_projects' | 'unit' | 'all'
}

type PermissionsPayload = {
  permissions: PermissionInput[]
}

export const onRequestPut: PagesFunction<Bindings> = async ({ env, request, params }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, administrator, 'roles.manage'))) return permissionRequiredResponse()

  const id = params.id
  if (typeof id !== 'string') return Response.json({ error: 'ID inválido' }, { status: 400 })

  const existing = await env.DB.prepare('SELECT id FROM access_profiles WHERE id = ? AND organization_id = ?').bind(id, administrator.organizationId).first()
  if (!existing) return Response.json({ error: 'Perfil não encontrado' }, { status: 404 })

  let payload: PermissionsPayload
  try {
    payload = await request.json() as PermissionsPayload
    if (!Array.isArray(payload.permissions)) throw new Error('invalid')
  } catch {
    return Response.json({ error: 'Formato de permissões inválido' }, { status: 400 })
  }

  const validScopes = ['own', 'team', 'department', 'assigned_clients', 'participating_projects', 'unit', 'all']

  // Buscar permissoes existentes para garantir que os códigos são válidos
  const { results: validPermissions } = await env.DB.prepare('SELECT code FROM permissions').all()
  const validCodes = new Set(validPermissions.map((p: any) => p.code))

  const invalidPermissions = payload.permissions.filter(p => !p || !validCodes.has(p.permission_code) || !validScopes.includes(p.scope))
  if (invalidPermissions.length > 0) {
    return Response.json({ error: 'A matriz contém códigos ou escopos de permissão inválidos', invalidPermissions }, { status: 400 })
  }
  const cleanPermissions = payload.permissions

  const batch = []
  
  // 1. Delete todas as permissões existentes para o profile
  batch.push(env.DB.prepare('DELETE FROM profile_permissions WHERE profile_id = ?').bind(id))

  // 2. Insere as novas
  for (const perm of cleanPermissions) {
    batch.push(env.DB.prepare('INSERT INTO profile_permissions (profile_id, permission_code, scope) VALUES (?, ?, ?)').bind(id, perm.permission_code, perm.scope))
  }

  try {
    await env.DB.batch(batch)
    // Auditar
    await env.DB.prepare('INSERT INTO access_audit_log (id, organization_id, actor_user_id, action, resource_type, resource_id, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
      `audit-${crypto.randomUUID()}`,
      administrator.organizationId,
      administrator.id,
      'UPDATE_PROFILE_PERMISSIONS',
      'access_profile',
      id,
      JSON.stringify(cleanPermissions)
    ).run()
  } catch {
    return Response.json({ error: 'Erro ao salvar matriz de permissões' }, { status: 500 })
  }

  return Response.json({ success: true, permissions: cleanPermissions })
}
