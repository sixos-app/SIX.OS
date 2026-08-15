import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type AccessUser, type Bindings } from '../../_access'

type RuleInput = {
  id?: unknown
  name?: unknown
  description?: unknown
  baseXp?: unknown
  recipientMode?: unknown
  onTimeBonusPercent?: unknown
  roleCodes?: unknown
  departmentIds?: unknown
  isActive?: unknown
}

async function requireManager(env: Bindings, request: Request): Promise<{ user: AccessUser; response?: never } | { response: Response; user?: never }> {
  const user = await getAccessUser(request, env)
  if (!user) return { response: accessRequiredResponse() }
  if (!(await hasPermissionV2(env, request, user, 'gamification.manage'))) return { response: permissionRequiredResponse() }
  return { user }
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const access = await requireManager(env, request)
  if (!access.user) return access.response!
  const user = access.user
  const [rules, roles, departments] = await Promise.all([
    env.DB.prepare(`
      SELECT rules.id, rules.name, rules.description, rules.base_xp AS baseXp,
        rules.recipient_mode AS recipientMode, rules.on_time_bonus_percent AS onTimeBonusPercent,
        rules.is_active AS isActive, rules.version, rules.updated_at AS updatedAt,
        GROUP_CONCAT(DISTINCT rule_roles.role_code) AS roleCodes,
        GROUP_CONCAT(DISTINCT rule_departments.department_id) AS departmentIds
      FROM xp_rules rules
      LEFT JOIN xp_rule_roles rule_roles ON rule_roles.rule_id = rules.id
      LEFT JOIN xp_rule_departments rule_departments ON rule_departments.rule_id = rules.id
      WHERE rules.organization_id = ?
      GROUP BY rules.id
      ORDER BY rules.is_active DESC, rules.updated_at DESC
    `).bind(user.organizationId).all(),
    env.DB.prepare("SELECT code, name FROM role_definitions ORDER BY CASE code WHEN 'admin' THEN 1 WHEN 'management' THEN 2 WHEN 'coordinator' THEN 3 WHEN 'service' THEN 4 ELSE 5 END, name").all(),
    env.DB.prepare('SELECT id, name FROM departments WHERE organization_id = ? AND is_active = 1 ORDER BY name').bind(user.organizationId).all(),
  ])
  return Response.json({
    rules: rules.results.map((rule: any) => ({ ...rule, roleCodes: rule.roleCodes ? String(rule.roleCodes).split(',') : [], departmentIds: rule.departmentIds ? String(rule.departmentIds).split(',') : [], isActive: Boolean(rule.isActive) })),
    roles: roles.results,
    departments: departments.results,
  })
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const access = await requireManager(env, request)
  if (!access.user) return access.response!
  const user = access.user
  const input = await request.json().catch(() => null) as RuleInput | null
  const id = typeof input?.id === 'string' && input.id ? input.id : crypto.randomUUID()
  const name = typeof input?.name === 'string' ? input.name.trim().slice(0, 120) : ''
  const description = typeof input?.description === 'string' ? input.description.trim().slice(0, 500) : ''
  const baseXp = typeof input?.baseXp === 'number' && Number.isInteger(input.baseXp) ? input.baseXp : -1
  const recipientMode = 'participants_each'
  const onTimeBonusPercent = typeof input?.onTimeBonusPercent === 'number' && Number.isInteger(input.onTimeBonusPercent) ? input.onTimeBonusPercent : 0
  const roleCodes = Array.isArray(input?.roleCodes) ? [...new Set(input.roleCodes.filter((value): value is string => typeof value === 'string'))].slice(0, 5) : []
  const departmentIds = Array.isArray(input?.departmentIds) ? [...new Set(input.departmentIds.filter((value): value is string => typeof value === 'string'))].slice(0, 20) : []
  const isActive = input?.isActive === false ? 0 : 1
  if (!name || baseXp < 0 || baseXp > 10000 || onTimeBonusPercent < 0 || onTimeBonusPercent > 100) return Response.json({ error: 'Regra de XP inválida' }, { status: 400 })

  const existing = await env.DB.prepare('SELECT id, version FROM xp_rules WHERE id = ? AND organization_id = ?').bind(id, user.organizationId).first<{ id: string; version: number }>()
  const validRoles = roleCodes.length ? await env.DB.prepare(`SELECT code FROM role_definitions WHERE code IN (${roleCodes.map(() => '?').join(',')})`).bind(...roleCodes).all<{ code: string }>() : { results: [] }
  const validDepartments = departmentIds.length ? await env.DB.prepare(`SELECT id FROM departments WHERE organization_id = ? AND id IN (${departmentIds.map(() => '?').join(',')})`).bind(user.organizationId, ...departmentIds).all<{ id: string }>() : { results: [] }
  if (validRoles.results.length !== roleCodes.length || validDepartments.results.length !== departmentIds.length) return Response.json({ error: 'Cargo ou departamento inválido' }, { status: 400 })

  const now = new Date().toISOString()
  const statements = existing ? [
    env.DB.prepare('UPDATE xp_rules SET name = ?, description = ?, base_xp = ?, recipient_mode = ?, on_time_bonus_percent = ?, is_active = ?, version = version + 1, updated_at = ? WHERE id = ? AND organization_id = ?').bind(name, description, baseXp, recipientMode, onTimeBonusPercent, isActive, now, id, user.organizationId),
    env.DB.prepare('DELETE FROM xp_rule_roles WHERE rule_id = ?').bind(id),
    env.DB.prepare('DELETE FROM xp_rule_departments WHERE rule_id = ?').bind(id),
  ] : [
    env.DB.prepare('INSERT INTO xp_rules (id, organization_id, name, description, base_xp, recipient_mode, on_time_bonus_percent, is_active, version, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)').bind(id, user.organizationId, name, description, baseXp, recipientMode, onTimeBonusPercent, isActive, user.id, now, now),
  ]
  for (const code of roleCodes) statements.push(env.DB.prepare('INSERT INTO xp_rule_roles (rule_id, role_code) VALUES (?, ?)').bind(id, code))
  for (const departmentId of departmentIds) statements.push(env.DB.prepare('INSERT INTO xp_rule_departments (rule_id, department_id) VALUES (?, ?)').bind(id, departmentId))
  await env.DB.batch(statements)
  return Response.json({ id, version: (existing?.version ?? 0) + 1 }, { status: existing ? 200 : 201 })
}

export const onRequestDelete: PagesFunction<Bindings> = async ({ env, request }) => {
  const access = await requireManager(env, request)
  if (!access.user) return access.response!
  const id = new URL(request.url).searchParams.get('id') ?? ''
  const rule = await env.DB.prepare('SELECT id FROM xp_rules WHERE id = ? AND organization_id = ?').bind(id, access.user.organizationId).first()
  if (!rule) return Response.json({ error: 'Regra não encontrada' }, { status: 404 })
  await env.DB.prepare('UPDATE xp_rules SET is_active = 0, version = version + 1, updated_at = ? WHERE id = ?').bind(new Date().toISOString(), id).run()
  return new Response(null, { status: 204 })
}
