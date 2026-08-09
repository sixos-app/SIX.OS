import { getAccessUser, accessRequiredResponse, permissionRequiredResponse, type Bindings } from '../../../_access'
import { validateDevelopmentScope } from '../../development/_domain'

export async function onRequestGet({ request, env, params }: { request: Request; env: Bindings; params: { id: string } }) {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const planId = params.id as string

  const plan = await env.DB.prepare(`
    SELECT subject_user_id AS subjectUserId, created_by AS createdBy, created_at AS createdAt, status
    FROM development_plans
    WHERE id = ? AND organization_id = ? AND deleted_at IS NULL
  `).bind(planId, user.organizationId).first<{ subjectUserId: string, createdBy: string | null, createdAt: string, status: string }>()

  if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })

  const hasAccess = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.plans.view')
  const hasMonitor = await validateDevelopmentScope(env, request, user, plan.subjectUserId, 'development.monitor')

  if (!hasAccess && !hasMonitor) return permissionRequiredResponse()

  // Collect all timeline events
  const events: any[] = []

  // 1. Plan created
  if (plan.createdBy) {
    const creator = await env.DB.prepare(`SELECT name FROM users WHERE id = ?`).bind(plan.createdBy).first<{ name: string }>()
    events.push({
      type: 'plan_created',
      timestamp: plan.createdAt,
      authorName: creator?.name || 'System',
      description: 'Development Plan created'
    })
  }

  // 2. Goals created/completed
  const goals = await env.DB.prepare(`
    SELECT g.id, g.title, g.status, g.created_at, g.updated_at, u.name AS authorName
    FROM development_goals g
    JOIN users u ON u.id = g.author_user_id
    WHERE g.plan_id = ? AND g.deleted_at IS NULL
  `).bind(planId).all()

  goals.results.forEach((g: any) => {
    events.push({
      type: 'goal_created',
      timestamp: g.created_at,
      authorName: g.authorName,
      description: `Goal added: ${g.title}`
    })
    if (g.status === 'completed') {
      events.push({
        type: 'goal_completed',
        timestamp: g.updated_at,
        authorName: g.authorName, // Best effort (we don't track completed_by separately yet)
        description: `Goal completed: ${g.title}`
      })
    }
  })

  // 3. Actions created
  const actions = await env.DB.prepare(`
    SELECT a.title, a.status, a.created_at, u.name AS authorName
    FROM development_actions a
    JOIN development_goals g ON g.id = a.goal_id
    JOIN users u ON u.id = a.author_user_id
    WHERE g.plan_id = ? AND a.deleted_at IS NULL
  `).bind(planId).all()

  actions.results.forEach((a: any) => {
    events.push({
      type: 'action_created',
      timestamp: a.created_at,
      authorName: a.authorName,
      description: `Action added: ${a.title}`
    })
  })

  // 4. Evidence added
  const evidence = await env.DB.prepare(`
    SELECT e.title, e.created_at, u.name AS authorName
    FROM development_evidence e
    LEFT JOIN development_goals g ON g.id = e.goal_id
    LEFT JOIN development_actions a ON a.id = e.action_id
    LEFT JOIN development_goals ga ON ga.id = a.goal_id
    JOIN users u ON u.id = e.author_user_id
    WHERE (g.plan_id = ? OR ga.plan_id = ?) AND e.deleted_at IS NULL
  `).bind(planId, planId).all()

  evidence.results.forEach((e: any) => {
    events.push({
      type: 'evidence_added',
      timestamp: e.created_at,
      authorName: e.authorName,
      description: `Evidence uploaded: ${e.title}`
    })
  })

  // 5. Check-ins
  const checkins = await env.DB.prepare(`
    SELECT c.meeting_date, c.created_at, u.name AS authorName
    FROM development_checkins c
    JOIN users u ON u.id = c.author_user_id
    WHERE c.plan_id = ? AND c.deleted_at IS NULL
  `).bind(planId).all()

  checkins.results.forEach((c: any) => {
    events.push({
      type: 'checkin_scheduled',
      timestamp: c.created_at,
      authorName: c.authorName,
      description: `Check-in scheduled for ${c.meeting_date}`
    })
  })

  // Sort events chronologically
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return Response.json(events)
}
