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
  const body = await request.json() as { title?: string; description?: string; status?: string; startDate?: string; endDate?: string }

  const plan = await env.DB.prepare(`
    SELECT subject_user_id AS subjectUserId
    FROM development_plans
    WHERE id = ? AND organization_id = ? AND deleted_at IS NULL
  `).bind(planId, user.organizationId).first<{ subjectUserId: string }>()

  if (!plan) return Response.json({ error: 'Not found' }, { status: 404 })

  const hasAccess = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.plans.edit')
  if (!hasAccess) return permissionRequiredResponse()

  // Update
  await env.DB.prepare(`
    UPDATE development_plans
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    body.title ?? null,
    body.description ?? null,
    body.status ?? null,
    body.startDate ?? null,
    body.endDate ?? null,
    planId
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
