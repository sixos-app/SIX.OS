import { getAccessUser, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../_access'
import { validateDevelopmentScope } from '../development/_domain'

export async function onRequestGet({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const planId = params.id as string

  const plan = await env.DB.prepare(`
    SELECT id, subject_user_id AS subjectUserId, title, description, status, start_date AS startDate, end_date AS endDate
    FROM development_plans
    WHERE id = ? AND organization_id = ? AND deleted_at IS NULL
  `).bind(planId, user.organizationId).first<{ id: string, subjectUserId: string, title: string, description: string, status: string, startDate: string, endDate: string }>()

  if (!plan) return Response.json({ error: 'Not found' }, { status: 404 })

  const hasAccess = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.plans.view')
  const hasMonitor = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.monitor')

  if (!hasAccess && !hasMonitor) return permissionRequiredResponse()

  return Response.json(plan)
}

export async function onRequestPut({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const planId = params.id as string
  const body = await request.json().catch(() => null) as { title?: string; description?: string; status?: string; startDate?: string; endDate?: string } | null
  if (!body) return Response.json({ error: 'Invalid payload' }, { status: 400 })

  const plan = await env.DB.prepare(`
    SELECT subject_user_id AS subjectUserId, status
    FROM development_plans
    WHERE id = ? AND organization_id = ? AND deleted_at IS NULL
  `).bind(planId, user.organizationId).first<{ subjectUserId: string; status: string }>()

  if (!plan) return Response.json({ error: 'Not found' }, { status: 404 })

  const hasAccess = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.plans.edit')
  const canManage = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.plans.manage')
  if (!hasAccess && !canManage) return permissionRequiredResponse()

  if (plan.status === 'completed' || plan.status === 'cancelled') {
    return Response.json({ error: 'Closed plans are immutable' }, { status: 409 })
  }
  const transitions: Record<string, string[]> = {
    draft: ['draft', 'active', 'cancelled'],
    active: ['active', 'completed', 'cancelled'],
  }
  if (body.status && !transitions[plan.status]?.includes(body.status)) {
    return Response.json({ error: `Invalid status transition from ${plan.status} to ${body.status}` }, { status: 409 })
  }
  if (body.title !== undefined && !body.title.trim()) return Response.json({ error: 'Title cannot be empty' }, { status: 400 })
  if (body.startDate && Number.isNaN(Date.parse(body.startDate))) return Response.json({ error: 'Invalid start date' }, { status: 400 })
  if (body.endDate && Number.isNaN(Date.parse(body.endDate))) return Response.json({ error: 'Invalid end date' }, { status: 400 })

  // Update
  await env.DB.prepare(`
    UPDATE development_plans
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).bind(
    body.title?.trim() ?? null,
    body.description ?? null,
    body.status ?? null,
    body.startDate ?? null,
    body.endDate ?? null,
    planId,
    user.organizationId
  ).run()

  return Response.json({ success: true })
}

export async function onRequestDelete({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const planId = params.id as string

  const plan = await env.DB.prepare(`
    SELECT subject_user_id AS subjectUserId
    FROM development_plans
    WHERE id = ? AND organization_id = ? AND deleted_at IS NULL
  `).bind(planId, user.organizationId).first<{ subjectUserId: string }>()

  if (!plan) return Response.json({ error: 'Not found' }, { status: 404 })

  // Assuming you need 'manage' or 'edit' to delete (soft delete). Let's use 'edit'.
  const hasAccess = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.plans.edit')
  if (!hasAccess) return permissionRequiredResponse()

  await env.DB.prepare(`
    UPDATE development_plans
    SET deleted_at = CURRENT_TIMESTAMP, status = 'cancelled'
    WHERE id = ?
  `).bind(planId).run()

  return Response.json({ success: true })
}
