import { accessRequiredResponse, getAccessUser, type Bindings } from './_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const { results: contracts } = await env.DB.prepare(`
    SELECT 
      ctr.id, ctr.client_id AS clientId, ctr.monthly_deliverables AS monthlyDeliverables,
      ctr.hour_limit AS hourLimit, ctr.agreed_deadline_days AS agreedDeadlineDays,
      ctr.revision_rounds AS revisionRounds, ctr.monthly_balance AS monthlyBalance,
      ctr.contract_value AS contractValue, ctr.start_date AS startDate, ctr.end_date AS endDate,
      ctr.status, c.name AS clientName
    FROM contracts ctr
    JOIN clients c ON ctr.client_id = c.id
    WHERE ctr.organization_id = ?
    ORDER BY ctr.created_at DESC
  `).bind(user.organizationId).all()

  return Response.json(contracts ?? [])
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const body = await request.json().catch(() => null) as any
  if (!body || !body.clientId) {
    return Response.json({ error: 'Cliente é obrigatório' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await env.DB.prepare(`
    INSERT INTO contracts (
      id, organization_id, client_id, monthly_deliverables, hour_limit,
      agreed_deadline_days, revision_rounds, monthly_balance, contract_value,
      start_date, end_date, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).bind(
    id,
    user.organizationId,
    body.clientId,
    body.monthlyDeliverables || 0,
    body.hourLimit || 0,
    body.agreedDeadlineDays || 3,
    body.revisionRounds || 2,
    body.hourLimit || 0,
    body.contractValue || 0,
    body.startDate || now.slice(0, 10),
    body.endDate || null,
    now,
    now
  ).run()

  return Response.json({ id, ...body, status: 'active' }, { status: 201 })
}
