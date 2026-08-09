import { getAccessUser, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../../_access'
import { validateDevelopmentScope } from '../../development/_domain'

export async function onRequestPost({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const planId = params.id as string
  const body = await request.json() as { goalId?: string; actionId?: string; title: string; textContent?: string; linkUrl?: string }

  if (!body.title || (!body.goalId && !body.actionId)) {
    return Response.json({ error: 'Title and either Goal ID or Action ID are required' }, { status: 400 })
  }

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
    INSERT INTO development_evidence (
      id, organization_id, goal_id, action_id, author_user_id, title, text_content, link_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, user.organizationId, body.goalId || null, body.actionId || null, user.id, body.title, body.textContent || null, body.linkUrl || null
  ).run()

  return Response.json({ id }, { status: 201 })
}
