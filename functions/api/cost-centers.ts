import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from './_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const canView = await hasPermissionV2(env, request, user, 'finance.view')
  const canManage = await hasPermissionV2(env, request, user, 'finance.manage')
  if (!canView && !canManage) return permissionRequiredResponse()

  const { results } = await env.DB.prepare(`
    SELECT id, name, code, type, description, created_at AS createdAt
    FROM cost_centers
    WHERE organization_id = ?
    ORDER BY name ASC
  `).bind(user.organizationId).all()

  return Response.json(results ?? [])
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'finance.manage'))) {
    return permissionRequiredResponse()
  }

  const body = await request.json().catch(() => null) as any
  if (!body || !body.name || !body.code || !body.type) {
    return Response.json({ error: 'Nome, código e tipo são obrigatórios' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  try {
    await env.DB.prepare(`
      INSERT INTO cost_centers (id, organization_id, name, code, type, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, user.organizationId, body.name, body.code, body.type, body.description || null, now, now
    ).run()
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) {
      return Response.json({ error: 'Já existe um centro de custo com este código' }, { status: 409 })
    }
    throw e
  }

  return Response.json({ id, name: body.name, code: body.code, type: body.type, description: body.description }, { status: 201 })
}
