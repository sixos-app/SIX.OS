import { accessRequiredResponse, getAccessUser, type Bindings } from './_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const { results: entries } = await env.DB.prepare(`
    SELECT 
      t.id, t.demand_id AS demandId, t.task_id AS taskId, t.client_id AS clientId,
      t.user_id AS userId, t.hours, t.minutes, t.date, t.description,
      t.entry_type AS entryType, t.created_at AS createdAt,
      u.name AS userName, c.name AS clientName
    FROM time_entries t
    JOIN users u ON t.user_id = u.id
    JOIN clients c ON t.client_id = c.id
    WHERE t.organization_id = ?
    ORDER BY t.created_at DESC
  `).bind(user.organizationId).all()

  return Response.json(entries ?? [])
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const body = await request.json().catch(() => null) as any
  if (!body || !body.clientId || (body.hours === undefined && body.minutes === undefined)) {
    return Response.json({ error: 'Cliente e horas/minutos são obrigatórios' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const dateStr = body.date || now.slice(0, 10)

  await env.DB.prepare(`
    INSERT INTO time_entries (
      id, organization_id, demand_id, task_id, client_id, user_id,
      hours, minutes, date, description, entry_type, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    user.organizationId,
    body.demandId || null,
    body.taskId || null,
    body.clientId,
    user.id,
    body.hours || 0,
    body.minutes || 0,
    dateStr,
    body.description || null,
    body.entryType || 'manual',
    now
  ).run()

  return Response.json({ id, ...body, userId: user.id, date: dateStr }, { status: 201 })
}
