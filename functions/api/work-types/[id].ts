import {
  accessRequiredResponse,
  getAccessUser,
  hasPermissionV2,
  permissionRequiredResponse,
  type Bindings,
} from '../_access'

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

export const onRequestPatch: PagesFunction<Bindings> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'work_types.manage'))) {
    return permissionRequiredResponse()
  }

  const id = typeof params.id === 'string' ? params.id : ''
  if (!id) return Response.json({ error: 'ID do tipo de trabalho é obrigatório.' }, { status: 400 })

  const current = await env.DB.prepare(`
    SELECT id, name, default_minutes AS defaultMinutes, color_key AS colorKey, is_active AS isActive
    FROM work_types
    WHERE id = ? AND organization_id = ?
    LIMIT 1
  `).bind(id, user.organizationId).first<{
    id: string
    name: string
    defaultMinutes: number
    colorKey: string
    isActive: number
  }>()

  if (!current) {
    return Response.json({ error: 'Tipo de trabalho não encontrado.' }, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const now = new Date().toISOString()

  let nextName = current.name
  let nextNormalized: string | null = null
  if (typeof body?.name === 'string' && body.name.trim()) {
    nextName = body.name.trim().slice(0, 80)
    nextNormalized = normalizeWorkTypeName(nextName)

    // Check duplicate name within tenant
    const duplicate = await env.DB.prepare(`
      SELECT id FROM work_types
      WHERE organization_id = ? AND normalized_name = ? AND id != ?
      LIMIT 1
    `).bind(user.organizationId, nextNormalized, id).first()

    if (duplicate) {
      return Response.json({ error: `Já existe outro tipo de trabalho com o nome "${nextName}".` }, { status: 409 })
    }
  }

  const rawMinutes = body?.defaultMinutes !== undefined ? Number(body.defaultMinutes) : current.defaultMinutes
  const nextDefaultMinutes = !Number.isNaN(rawMinutes) && rawMinutes >= 5 && rawMinutes <= 10080
    ? Math.round(rawMinutes)
    : current.defaultMinutes

  const nextColorKey = typeof body?.colorKey === 'string' && ALLOWED_COLORS.has(body.colorKey)
    ? body.colorKey
    : current.colorKey

  const nextIsActive = body?.isActive !== undefined ? (body.isActive ? 1 : 0) : current.isActive

  if (nextNormalized) {
    await env.DB.prepare(`
      UPDATE work_types
      SET name = ?, normalized_name = ?, default_minutes = ?, color_key = ?, is_active = ?, updated_at = ?
      WHERE id = ? AND organization_id = ?
    `).bind(nextName, nextNormalized, nextDefaultMinutes, nextColorKey, nextIsActive, now, id, user.organizationId).run()
  } else {
    await env.DB.prepare(`
      UPDATE work_types
      SET default_minutes = ?, color_key = ?, is_active = ?, updated_at = ?
      WHERE id = ? AND organization_id = ?
    `).bind(nextDefaultMinutes, nextColorKey, nextIsActive, now, id, user.organizationId).run()
  }

  return Response.json({
    workType: {
      id,
      name: nextName,
      defaultMinutes: nextDefaultMinutes,
      colorKey: nextColorKey,
      isActive: nextIsActive === 1,
      updatedAt: now,
    },
  })
}

export const onRequestDelete: PagesFunction<Bindings> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'work_types.manage'))) {
    return permissionRequiredResponse()
  }

  const id = typeof params.id === 'string' ? params.id : ''
  if (!id) return Response.json({ error: 'ID do tipo de trabalho é obrigatório.' }, { status: 400 })

  const current = await env.DB.prepare(`
    SELECT id, name
    FROM work_types
    WHERE id = ? AND organization_id = ?
    LIMIT 1
  `).bind(id, user.organizationId).first<{ id: string; name: string }>()

  if (!current) {
    return Response.json({ error: 'Tipo de trabalho não encontrado.' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // Logical deactivation to preserve historical relational integrity
  await env.DB.prepare(`
    UPDATE work_types
    SET is_active = 0, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `).bind(now, id, user.organizationId).run()

  return Response.json({
    ok: true,
    message: `O tipo de trabalho "${current.name}" foi desativado com sucesso.`,
  })
}
