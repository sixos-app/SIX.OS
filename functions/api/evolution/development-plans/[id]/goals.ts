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

  const goals = await env.DB.prepare(`
    SELECT id, competency_id AS competencyId, title, description, success_criteria AS successCriteria, priority, status, target_date AS targetDate, order_index AS orderIndex
    FROM development_goals
    WHERE plan_id = ? AND organization_id = ? AND deleted_at IS NULL
    ORDER BY order_index ASC, created_at ASC
  `).bind(planId, user.organizationId).all()

  return Response.json(goals.results)
}

export async function onRequestPost({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const planId = params.id as string
  const body = await request.json() as { competencyId?: string; title: string; description?: string; successCriteria?: string; priority?: string; targetDate?: string }

  if (!body.title) return Response.json({ error: 'Title is required' }, { status: 400 })

  const plan = await env.DB.prepare(`
    SELECT subject_user_id AS subjectUserId, status
    FROM development_plans
    WHERE id = ? AND organization_id = ? AND deleted_at IS NULL
  `).bind(planId, user.organizationId).first<{ subjectUserId: string, status: string }>()

  if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })
  if (plan.status === 'completed' || plan.status === 'cancelled') return Response.json({ error: 'Plan is closed' }, { status: 409 })

  const hasAccess = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.plans.edit')
  if (!hasAccess) return permissionRequiredResponse()

  const id = crypto.randomUUID()
  await env.DB.prepare(`
    INSERT INTO development_goals (
      id, organization_id, plan_id, competency_id, author_user_id, title, description, success_criteria, priority, target_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, user.organizationId, planId, body.competencyId || null, user.id, body.title, body.description || null, body.successCriteria || null, body.priority || 'medium', body.targetDate || null
  ).run()

  return Response.json({ id }, { status: 201 })
}
