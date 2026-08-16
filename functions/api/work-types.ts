import {
  accessRequiredResponse,
  getAccessUser,
  hasPermissionV2,
  permissionRequiredResponse,
  type Bindings,
} from './_access'

const ALLOWED_COLORS = new Set([
  'lime',
  'purple',
  'orange',
  'blue',
  'cyan',
  'turquoise',
  'yellow',
  'pink',
  'coral',
  'magenta',
])

function normalizeWorkTypeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'work_types.view'))) {
    return permissionRequiredResponse()
  }

  const url = new URL(request.url)
  const includeInactive = url.searchParams.get('include_inactive') === 'true'

  const query = includeInactive
    ? `
      SELECT
        wt.id,
        wt.organization_id AS organizationId,
        wt.name,
        wt.default_minutes AS defaultMinutes,
        wt.color_key AS colorKey,
        wt.is_active AS isActive,
        wt.created_at AS createdAt,
        wt.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM project_work_types pwt WHERE pwt.work_type_id = wt.id) AS projectCount,
        (SELECT COUNT(*) FROM missions m WHERE m.work_type_id = wt.id) AS missionCount
      FROM work_types wt
      WHERE wt.organization_id = ?
      ORDER BY wt.is_active DESC, wt.name ASC
    `
    : `
      SELECT
        wt.id,
        wt.organization_id AS organizationId,
        wt.name,
        wt.default_minutes AS defaultMinutes,
        wt.color_key AS colorKey,
        wt.is_active AS isActive,
        wt.created_at AS createdAt,
        wt.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM project_work_types pwt WHERE pwt.work_type_id = wt.id) AS projectCount,
        (SELECT COUNT(*) FROM missions m WHERE m.work_type_id = wt.id) AS missionCount
      FROM work_types wt
      WHERE wt.organization_id = ? AND wt.is_active = 1
      ORDER BY wt.name ASC
    `

  const result = await env.DB.prepare(query).bind(user.organizationId).all()

  return Response.json({
    workTypes: (result.results ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      defaultMinutes: Number(row.defaultMinutes ?? 60),
      colorKey: row.colorKey ?? 'lime',
      isActive: row.isActive === 1,
      projectCount: Number(row.projectCount ?? 0),
      missionCount: Number(row.missionCount ?? 0),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  })
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  
  // Can be created by users with work_types.manage or users allowed to create projects/missions
  const canManage = await hasPermissionV2(env, request, user, 'work_types.manage')
  const canCreateContent = (await hasPermissionV2(env, request, user, 'projects.create')) ||
                          (await hasPermissionV2(env, request, user, 'missions.assign'))
  
  if (!canManage && !canCreateContent) {
    return permissionRequiredResponse()
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!name) {
    return Response.json({ error: 'O nome do tipo de trabalho é obrigatório.' }, { status: 400 })
  }

  const rawMinutes = Number(body?.defaultMinutes)
  const defaultMinutes = !Number.isNaN(rawMinutes) && rawMinutes >= 5 && rawMinutes <= 10080
    ? Math.round(rawMinutes)
    : 60

  const colorKey = typeof body?.colorKey === 'string' && ALLOWED_COLORS.has(body.colorKey)
    ? body.colorKey
    : 'lime'

  const normalized = normalizeWorkTypeName(name)
  if (!normalized) {
    return Response.json({ error: 'Nome de tipo de trabalho inválido.' }, { status: 400 })
  }

  // Check if existing
  const existing = await env.DB.prepare(`
    SELECT id, name, default_minutes AS defaultMinutes, color_key AS colorKey, is_active AS isActive
    FROM work_types
    WHERE organization_id = ? AND normalized_name = ?
    LIMIT 1
  `).bind(user.organizationId, normalized).first<{
    id: string
    name: string
    defaultMinutes: number
    colorKey: string
    isActive: number
  }>()

  if (existing) {
    if (existing.isActive === 0) {
      // Reativar tipo existente
      const now = new Date().toISOString()
      await env.DB.prepare(`
        UPDATE work_types
        SET is_active = 1, default_minutes = ?, color_key = ?, updated_at = ?
        WHERE id = ? AND organization_id = ?
      `).bind(defaultMinutes, colorKey, now, existing.id, user.organizationId).run()

      return Response.json({
        workType: {
          id: existing.id,
          name: existing.name,
          defaultMinutes,
          colorKey,
          isActive: true,
          projectCount: 0,
          missionCount: 0,
        },
        reactivated: true,
      }, { status: 200 })
    }

    return Response.json({ error: `O tipo de trabalho "${name}" já existe nesta organização.` }, { status: 409 })
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO work_types (id, organization_id, name, normalized_name, default_minutes, color_key, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(id, user.organizationId, name, normalized, defaultMinutes, colorKey, now, now).run()

  return Response.json({
    workType: {
      id,
      name,
      defaultMinutes,
      colorKey,
      isActive: true,
      projectCount: 0,
      missionCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  }, { status: 201 })
}
