import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../../_access'

type UpdateAccessPayload = {
  name?: unknown
  email?: unknown
  department_id?: unknown
  position_id?: unknown
  professional_level_id?: unknown
  manager_id?: unknown
  access_profile_id?: unknown
  status?: unknown
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : null
}

export const onRequestPatch: PagesFunction<Bindings> = async ({ env, request, params }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  
  const hasUsersManage = await hasPermissionV2(env, request, administrator, 'users.manage')
  const hasRolesManage = await hasPermissionV2(env, request, administrator, 'roles.manage')
  
  if (!hasUsersManage && !hasRolesManage) return permissionRequiredResponse()

  const id = params.id
  if (typeof id !== 'string') return Response.json({ error: 'ID inválido' }, { status: 400 })

  const targetUser = await env.DB.prepare('SELECT id, name, email, status, access_profile_id FROM users WHERE id = ? AND organization_id = ?').bind(id, administrator.organizationId).first<any>()
  if (!targetUser) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 })

  let payload: UpdateAccessPayload
  try {
    payload = await request.json() as UpdateAccessPayload
  } catch {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  // Se tentar atualizar access_profile_id ou status, EXIGE roles.manage
  if (('access_profile_id' in payload || 'status' in payload) && !hasRolesManage) {
    return permissionRequiredResponse()
  }

  const name = normalizeText(payload.name) || targetUser.name
  const email = (normalizeText(payload.email) || targetUser.email).toLowerCase()
  const departmentId = payload.department_id !== undefined ? normalizeText(payload.department_id) : undefined
  const positionId = payload.position_id !== undefined ? normalizeText(payload.position_id) : undefined
  const professionalLevelId = payload.professional_level_id !== undefined ? normalizeText(payload.professional_level_id) : undefined
  const managerId = payload.manager_id !== undefined ? normalizeText(payload.manager_id) : undefined
  const accessProfileId = payload.access_profile_id !== undefined ? normalizeText(payload.access_profile_id) : undefined
  const status = typeof payload.status === 'string' && ['active', 'inactive', 'blocked'].includes(payload.status) ? payload.status : undefined

  // Validações de organization
  if (departmentId) {
    const check = await env.DB.prepare('SELECT id FROM departments WHERE id = ? AND organization_id = ?').bind(departmentId, administrator.organizationId).first()
    if (!check) return Response.json({ error: 'Departamento inválido' }, { status: 400 })
  }
  if (positionId) {
    const check = await env.DB.prepare('SELECT id FROM professional_positions WHERE id = ? AND organization_id = ?').bind(positionId, administrator.organizationId).first()
    if (!check) return Response.json({ error: 'Cargo inválido' }, { status: 400 })
  }
  if (professionalLevelId) {
    const check = await env.DB.prepare('SELECT id FROM professional_levels WHERE id = ? AND organization_id = ?').bind(professionalLevelId, administrator.organizationId).first()
    if (!check) return Response.json({ error: 'Nível inválido' }, { status: 400 })
  }
  if (managerId) {
    if (managerId === id) return Response.json({ error: 'Usuário não pode ser seu próprio líder' }, { status: 400 })
    const check = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ?').bind(managerId, administrator.organizationId).first()
    if (!check) return Response.json({ error: 'Líder inválido' }, { status: 400 })
  }
  if (accessProfileId) {
    const check = await env.DB.prepare('SELECT id FROM access_profiles WHERE id = ? AND organization_id = ?').bind(accessProfileId, administrator.organizationId).first()
    if (!check) return Response.json({ error: 'Perfil de acesso inválido' }, { status: 400 })
  }

  // Prevenir Lockout
  if ((status && status !== 'active' && targetUser.status === 'active') || (accessProfileId !== undefined && accessProfileId !== targetUser.access_profile_id)) {
    // Checa se o usuário atual é um dos últimos com roles.manage
    const hasRolesManageBefore = await env.DB.prepare(`
      SELECT 1 FROM profile_permissions pp
      WHERE pp.profile_id = ? AND pp.permission_code = 'roles.manage'
    `).bind(targetUser.access_profile_id).first()

    if (hasRolesManageBefore) {
      // Se ele ia perder o acesso ou ficar inativo
      let willLose = false
      if (status && status !== 'active') willLose = true
      if (accessProfileId) {
        const hasRolesManageAfter = await env.DB.prepare(`
          SELECT 1 FROM profile_permissions pp
          WHERE pp.profile_id = ? AND pp.permission_code = 'roles.manage'
        `).bind(accessProfileId).first()
        if (!hasRolesManageAfter) willLose = true
      } else if (accessProfileId === null) {
        willLose = true
      }

      if (willLose) {
        const adminsCount = await env.DB.prepare(`
          SELECT COUNT(users.id) as total 
          FROM users 
          JOIN profile_permissions pp ON pp.profile_id = users.access_profile_id
          WHERE users.organization_id = ? AND users.status = 'active' AND pp.permission_code = 'roles.manage'
        `).bind(administrator.organizationId).first<{ total: number }>()

        if (adminsCount && adminsCount.total <= 1) {
          return Response.json({ error: 'Não é possível remover privilégios do último administrador ativo.' }, { status: 409 })
        }
      }
    }
  }

  // Update
  const updates: string[] = []
  const binds: any[] = []

  updates.push('name = ?', 'email = ?')
  binds.push(name, email)

  if (departmentId !== undefined) { updates.push('department_id = ?'); binds.push(departmentId) }
  if (positionId !== undefined) { updates.push('position_id = ?'); binds.push(positionId) }
  if (professionalLevelId !== undefined) { updates.push('professional_level_id = ?'); binds.push(professionalLevelId) }
  if (managerId !== undefined) { updates.push('manager_id = ?'); binds.push(managerId) }
  if (accessProfileId !== undefined) { updates.push('access_profile_id = ?'); binds.push(accessProfileId) }
  if (status !== undefined) { updates.push('status = ?'); binds.push(status) }

  binds.push(id)

  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`

  try {
    await env.DB.prepare(query).bind(...binds).run()

    // Audit changes to access profile or status
    if (accessProfileId !== undefined && accessProfileId !== targetUser.access_profile_id) {
      await env.DB.prepare('INSERT INTO access_audit_log (id, organization_id, actor_user_id, target_user_id, action, resource_type, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
        `audit-${crypto.randomUUID()}`, administrator.organizationId, administrator.id, id, 'UPDATE_USER_PROFILE', 'user',
        JSON.stringify({ access_profile_id: targetUser.access_profile_id }), JSON.stringify({ access_profile_id: accessProfileId })
      ).run()
    }
    if (status !== undefined && status !== targetUser.status) {
      await env.DB.prepare('INSERT INTO access_audit_log (id, organization_id, actor_user_id, target_user_id, action, resource_type, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
        `audit-${crypto.randomUUID()}`, administrator.organizationId, administrator.id, id, 'UPDATE_USER_STATUS', 'user',
        JSON.stringify({ status: targetUser.status }), JSON.stringify({ status })
      ).run()
    }

  } catch (err) {
    return Response.json({ error: 'Erro ao atualizar dados do usuário' }, { status: 500 })
  }

  return Response.json({ success: true })
}
