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

  const actions = await env.DB.prepare(`
    SELECT a.id, a.goal_id AS goalId, a.title, a.description, a.status, a.target_date AS targetDate, a.order_index AS orderIndex
    FROM development_actions a
    JOIN development_goals g ON g.id = a.goal_id
    WHERE g.plan_id = ? AND a.organization_id = ? AND a.deleted_at IS NULL AND g.deleted_at IS NULL
    ORDER BY a.order_index ASC, a.created_at ASC
  `).bind(planId, user.organizationId).all()

  return Response.json(actions.results)
}

export async function onRequestPost({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const planId = params.id as string
  const body = await request.json() as { goalId: string; title: string; description?: string; targetDate?: string }

  if (!body.title || !body.goalId) return Response.json({ error: 'Title and Goal ID are required' }, { status: 400 })

  const goal = await env.DB.prepare(`
    SELECT g.id, p.subject_user_id AS subjectUserId, p.status AS planStatus
    FROM development_goals g
    JOIN development_plans p ON p.id = g.plan_id
    WHERE g.id = ? AND p.id = ? AND g.organization_id = ? AND g.deleted_at IS NULL AND p.deleted_at IS NULL
  `).bind(body.goalId, planId, user.organizationId).first<{ subjectUserId: string, planStatus: string }>()

  if (!goal) return Response.json({ error: 'Goal not found in this plan' }, { status: 404 })
  if (goal.planStatus === 'completed' || goal.planStatus === 'cancelled') return Response.json({ error: 'Plan is closed' }, { status: 409 })

  const hasAccess = await validateDevelopmentScope(env, request, user, goal.subjectUserId, 'development.plans.edit')
  if (!hasAccess) return permissionRequiredResponse()

  const id = crypto.randomUUID()
  await env.DB.prepare(`
    INSERT INTO development_actions (
      id, organization_id, goal_id, author_user_id, title, description, target_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, user.organizationId, body.goalId, user.id, body.title, body.description || null, body.targetDate || null
  ).run()

  return Response.json({ id }, { status: 201 })
}
