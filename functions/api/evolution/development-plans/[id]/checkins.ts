import { getAccessUser, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../../_access'
import { validateDevelopmentScope } from '../development/_domain'

export async function onRequestGet({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const planId = params.id as string

  const plan = await env.DB.prepare(`
    SELECT subject_user_id AS subjectUserId
    FROM development_plans
    WHERE id = ? AND organization_id = ? AND deleted_at IS NULL
  `).bind(planId, user.organizationId).first<{ subjectUserId: string }>()

  if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })

  const hasAccess = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.plans.view')
  const hasMonitor = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.monitor')

  if (!hasAccess && !hasMonitor) return permissionRequiredResponse()

  const checkins = await env.DB.prepare(`
    SELECT id, meeting_date AS meetingDate, status, author_user_id AS authorUserId, created_at AS createdAt
    FROM development_checkins
    WHERE plan_id = ? AND organization_id = ? AND deleted_at IS NULL
    ORDER BY meeting_date DESC
  `).bind(planId, user.organizationId).all()

  return Response.json(checkins.results)
}

export async function onRequestPost({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const planId = params.id as string
  const body = await request.json() as { meetingDate: string; notes?: string }

  if (!body.meetingDate) return Response.json({ error: 'Meeting date is required' }, { status: 400 })

  const plan = await env.DB.prepare(`
    SELECT subject_user_id AS subjectUserId
    FROM development_plans
    WHERE id = ? AND organization_id = ? AND deleted_at IS NULL
  `).bind(planId, user.organizationId).first<{ subjectUserId: string }>()

  if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })

  const hasAccess = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.plans.edit')
  if (!hasAccess) return permissionRequiredResponse()

  const checkinId = crypto.randomUUID()
  
  // Note: Checkins have their own entries table. The `notes` here might be an initial entry.
  await env.DB.prepare(`
    INSERT INTO development_checkins (
      id, organization_id, plan_id, author_user_id, meeting_date
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(
    checkinId, user.organizationId, planId, user.id, body.meetingDate
  ).run()

  if (body.notes) {
    const entryId = crypto.randomUUID()
    await env.DB.prepare(`
      INSERT INTO development_checkin_entries (
        id, organization_id, checkin_id, author_user_id, entry_text
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      entryId, user.organizationId, checkinId, user.id, body.notes
    ).run()
  }

  return Response.json({ id: checkinId }, { status: 201 })
}
