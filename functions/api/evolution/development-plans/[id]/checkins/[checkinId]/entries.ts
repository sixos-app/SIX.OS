import { getAccessUser, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../../../../_access'
import { validateDevelopmentScope } from '../../../../development/_domain'

export async function onRequestGet({ request, env, params }: { request: Request; env: Bindings; params: { id: string, checkinId: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const planId = params.id as string
  const checkinId = params.checkinId as string

  const plan = await env.DB.prepare(`
    SELECT subject_user_id AS subjectUserId
    FROM development_plans
    WHERE id = ? AND organization_id = ? AND deleted_at IS NULL
  `).bind(planId, user.organizationId).first<{ subjectUserId: string }>()

  if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })

  const hasAccess = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.plans.view')
  const hasMonitor = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.monitor')

  if (!hasAccess && !hasMonitor) return permissionRequiredResponse()

  const checkin = await env.DB.prepare('SELECT id FROM development_checkins WHERE id = ? AND plan_id = ? AND organization_id = ? AND deleted_at IS NULL')
    .bind(checkinId, planId, user.organizationId).first()
  if (!checkin) return Response.json({ error: 'Check-in not found in this plan' }, { status: 404 })

  const entries = await env.DB.prepare(`
    SELECT e.id, e.entry_text AS entryText, e.author_user_id AS authorUserId, u.name AS authorName, e.created_at AS createdAt
    FROM development_checkin_entries e
    JOIN users u ON u.id = e.author_user_id
    WHERE e.checkin_id = ? AND e.organization_id = ?
    ORDER BY e.created_at ASC
  `).bind(checkinId, user.organizationId).all()

  return Response.json(entries.results)
}

export async function onRequestPost({ request, env, params }: { request: Request; env: Bindings; params: { id: string, checkinId: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const planId = params.id as string
  const checkinId = params.checkinId as string
  const body = await request.json() as { entryText: string }

  if (!body.entryText) return Response.json({ error: 'Entry text is required' }, { status: 400 })

  const plan = await env.DB.prepare(`
    SELECT subject_user_id AS subjectUserId, status
    FROM development_plans
    WHERE id = ? AND organization_id = ? AND deleted_at IS NULL
  `).bind(planId, user.organizationId).first<{ subjectUserId: string, status: string }>()

  if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })
  if (plan.status === 'completed' || plan.status === 'cancelled') return Response.json({ error: 'Plan is closed' }, { status: 409 })

  const hasAccess = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.plans.edit')
  if (!hasAccess) return permissionRequiredResponse()

  // Ensure checkin exists
  const checkin = await env.DB.prepare(`
    SELECT status FROM development_checkins WHERE id = ? AND plan_id = ? AND deleted_at IS NULL
  `).bind(checkinId, planId).first<{ status: string }>()
  
  if (!checkin) return Response.json({ error: 'Check-in not found' }, { status: 404 })

  const entryId = crypto.randomUUID()
  
  await env.DB.prepare(`
    INSERT INTO development_checkin_entries (
      id, organization_id, checkin_id, author_user_id, entry_text
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(
    entryId, user.organizationId, checkinId, user.id, body.entryText
  ).run()

  return Response.json({ id: entryId }, { status: 201 })
}
