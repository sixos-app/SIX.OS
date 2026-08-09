import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../../_access'

type OverridePayload = {
  permission_code?: unknown
  scope?: unknown
  is_granted?: unknown
  reason?: unknown
  starts_at?: unknown
  expires_at?: unknown
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : null
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request, params }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  
  const hasUsersManage = await hasPermissionV2(env, request, administrator, 'users.manage')
  const hasRolesManage = await hasPermissionV2(env, request, administrator, 'roles.manage')
  if (!hasUsersManage && !hasRolesManage) return permissionRequiredResponse()

  const id = params.id
  if (typeof id !== 'string') return Response.json({ error: 'ID inválido' }, { status: 400 })

  const targetUser = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ?').bind(id, administrator.organizationId).first()
  if (!targetUser) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const { results } = await env.DB.prepare(`
    SELECT id, permission_code, scope, is_granted, reason, granted_by, starts_at, expires_at, created_at
    FROM user_permission_overrides
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(id).all()

  return Response.json(results.map((r: any) => ({ ...r, is_granted: r.is_granted === 1 })))
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request, params }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  
  if (!(await hasPermissionV2(env, request, administrator, 'roles.manage'))) return permissionRequiredResponse()

  const id = params.id
  if (typeof id !== 'string') return Response.json({ error: 'ID inválido' }, { status: 400 })

  const targetUser = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ?').bind(id, administrator.organizationId).first()
  if (!targetUser) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 })

  let payload: OverridePayload
  try {
    payload = await request.json() as OverridePayload
  } catch {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const permissionCode = normalizeText(payload.permission_code)
  const scope = normalizeText(payload.scope)
  const isGranted = typeof payload.is_granted === 'boolean' ? (payload.is_granted ? 1 : 0) : null
  const reason = normalizeText(payload.reason)
  const startsAt = normalizeText(payload.starts_at)
  const expiresAt = normalizeText(payload.expires_at)

  if (!permissionCode || !scope || isGranted === null) {
    return Response.json({ error: 'Permissão, escopo e tipo (conceder/restringir) são obrigatórios' }, { status: 400 })
  }

  const validScopes = ['own', 'team', 'department', 'assigned_clients', 'participating_projects', 'unit', 'all']
  if (!validScopes.includes(scope)) return Response.json({ error: 'Escopo inválido' }, { status: 400 })

  // Validar se a permissão existe
  const permissionExists = await env.DB.prepare('SELECT code FROM permissions WHERE code = ?').bind(permissionCode).first()
  if (!permissionExists) return Response.json({ error: 'Permissão inválida' }, { status: 400 })

  if (startsAt && expiresAt && new Date(startsAt) > new Date(expiresAt)) {
    return Response.json({ error: 'Data de expiração não pode ser anterior à data de início' }, { status: 400 })
  }

  const overrideId = `override-${crypto.randomUUID()}`

  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO user_permission_overrides (id, user_id, permission_code, scope, is_granted, reason, granted_by, starts_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(overrideId, id, permissionCode, scope, isGranted, reason, administrator.id, startsAt, expiresAt),
      env.DB.prepare('INSERT INTO access_audit_log (id, organization_id, actor_user_id, target_user_id, action, resource_type, resource_id, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
        `audit-${crypto.randomUUID()}`, administrator.organizationId, administrator.id, id, 'CREATE_OVERRIDE', 'user_override', overrideId,
        JSON.stringify({ permission_code: permissionCode, scope, is_granted: isGranted, reason, starts_at: startsAt, expires_at: expiresAt })
      )
    ])
  } catch {
    return Response.json({ error: 'Erro ao criar override' }, { status: 500 })
  }

  return Response.json({ id: overrideId, permission_code: permissionCode, scope, is_granted: isGranted === 1, reason, starts_at: startsAt, expires_at: expiresAt }, { status: 201 })
}
