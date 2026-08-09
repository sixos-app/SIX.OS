import { getAccessUser, hasPermissionV2, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../../../_access'

export async function onRequestGet({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.assign_reviewers')
  if (!hasAccess) return permissionRequiredResponse()

  const cycle = await env.DB.prepare('SELECT id FROM evaluation_cycles WHERE id = ? AND organization_id = ?').bind(params.id, user.organizationId).first()
  if (!cycle) return Response.json({ error: 'Ciclo não encontrado' }, { status: 404 })

  const participants = await env.DB.prepare(`
    SELECT p.id, p.user_id AS userId, u.name, u.email, u.department_id AS departmentId, u.status
    FROM evaluation_cycle_participants p
    JOIN users u ON u.id = p.user_id
    WHERE p.cycle_id = ?
    ORDER BY u.name ASC
  `).bind(params.id).all()

  return Response.json(participants.results)
}

export async function onRequestPut({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const hasAccess = await hasPermissionV2(env, request, user, 'evaluations.assign_reviewers')
  if (!hasAccess) return permissionRequiredResponse()

  const cycle = await env.DB.prepare('SELECT id, status FROM evaluation_cycles WHERE id = ? AND organization_id = ?').bind(params.id, user.organizationId).first<{ id: string, status: string }>()
  if (!cycle) return Response.json({ error: 'Ciclo não encontrado' }, { status: 404 })
  if (cycle.status !== 'draft') return Response.json({ error: 'Ciclo não está em rascunho' }, { status: 403 })

  const payload = await request.json() as { userIds: string[] }
  if (!Array.isArray(payload.userIds)) return Response.json({ error: 'Formato inválido' }, { status: 400 })

  // Verify all userIds belong to the same organization and are active
  let validUserIds: string[] = []
  if (payload.userIds.length > 0) {
    const placeholders = payload.userIds.map(() => '?').join(',')
    const stmt = await env.DB.prepare(`
      SELECT id FROM users 
      WHERE organization_id = ? AND status = 'active' AND id IN (${placeholders})
    `).bind(user.organizationId, ...payload.userIds).all<{ id: string }>()
    validUserIds = stmt.results.map(r => r.id)
  }

  // Transaction-like approach to replace participants
  await env.DB.prepare('DELETE FROM evaluation_cycle_participants WHERE cycle_id = ?').bind(params.id).run()

  if (validUserIds.length > 0) {
    // Insert valid participants
    // SQLite allows bulk insert, but for simplicity and safety, loop
    for (const uId of validUserIds) {
      await env.DB.prepare(`
        INSERT INTO evaluation_cycle_participants (id, cycle_id, user_id, status)
        VALUES (?, ?, ?, 'active')
      `).bind(crypto.randomUUID(), params.id, uId).run()
    }
  }

  return Response.json({ success: true, count: validUserIds.length })
}
