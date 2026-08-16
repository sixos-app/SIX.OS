import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from './_access'
import { ensureDefaultMissionWorkflow } from './missions/_missionWorkflow'

type CreateMissionInput = {
  title?: unknown
  projectId?: unknown
  assigneeId?: unknown
  dueAt?: unknown
  expectedMinutes?: unknown
  priority?: unknown
  description?: unknown
  xpReward?: unknown
  rewardLabel?: unknown
  xpRuleId?: unknown
  workTypeId?: unknown
  workflowDepartments?: unknown
  workflowSteps?: unknown
}

const priorities = new Set(['low', 'normal', 'high', 'urgent'])

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'missions.assign'))) return permissionRequiredResponse()

  const body = await request.json().catch(() => null) as CreateMissionInput | null
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : ''
  const projectId = typeof body?.projectId === 'string' ? body.projectId : ''
  const assigneeId = typeof body?.assigneeId === 'string' ? body.assigneeId : ''
  const dueAt = typeof body?.dueAt === 'string' && !Number.isNaN(Date.parse(body.dueAt)) ? new Date(body.dueAt).toISOString() : ''
  const expectedMinutes = typeof body?.expectedMinutes === 'number' && Number.isInteger(body.expectedMinutes) && body.expectedMinutes >= 0 ? body.expectedMinutes : null
  const priority = typeof body?.priority === 'string' && priorities.has(body.priority) ? body.priority : 'normal'
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 4000) : ''
  const xpReward = typeof body?.xpReward === 'number' && Number.isInteger(body.xpReward) && body.xpReward >= 0 && body.xpReward <= 10000 ? body.xpReward : 0
  const rewardLabel = typeof body?.rewardLabel === 'string' ? body.rewardLabel.trim().slice(0, 120) : null
  const xpRuleId = typeof body?.xpRuleId === 'string' && body.xpRuleId ? body.xpRuleId : null
  const workTypeId = typeof body?.workTypeId === 'string' && body.workTypeId ? body.workTypeId : null

  const workflowSteps = Array.isArray(body?.workflowSteps)
    ? body.workflowSteps.map((value) => {
        if (!value || typeof value !== 'object') return null
        const step = value as { departmentName?: unknown; responsibleUserId?: unknown; stepType?: unknown; expectedMinutes?: unknown }
        const departmentName = typeof step.departmentName === 'string' ? step.departmentName.trim().slice(0, 80) : ''
        const responsibleUserId = typeof step.responsibleUserId === 'string' ? step.responsibleUserId : ''
        const stepType = typeof step.stepType === 'string' ? step.stepType.trim().slice(0, 40) : 'production'
        const stepExpectedMinutes = typeof step.expectedMinutes === 'number' && Number.isInteger(step.expectedMinutes) && step.expectedMinutes >= 0 ? step.expectedMinutes : null
        return departmentName && responsibleUserId ? { departmentName, responsibleUserId, stepType, expectedMinutes: stepExpectedMinutes } : null
      }).filter((value): value is { departmentName: string; responsibleUserId: string; stepType: string; expectedMinutes: number | null } => Boolean(value)).slice(0, 12)
    : []

  if (!title || !projectId || (!assigneeId && !workflowSteps[0]?.responsibleUserId) || !dueAt) {
    return Response.json({ error: 'Título, projeto, responsável e prazo são obrigatórios' }, { status: 400 })
  }

  const initialResponsibleId = workflowSteps[0]?.responsibleUserId ?? assigneeId

  const project = await env.DB.prepare('SELECT id, client_id AS clientId FROM projects WHERE id = ? AND organization_id = ? LIMIT 1').bind(projectId, user.organizationId).first<{ id: string; clientId: string }>()
  if (!project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })
  const assignee = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ? LIMIT 1').bind(initialResponsibleId, user.organizationId).first<{ id: string }>()
  if (!assignee) return Response.json({ error: 'Responsável não encontrado' }, { status: 404 })
  const xpRule = xpRuleId ? await env.DB.prepare('SELECT id, base_xp AS baseXp FROM xp_rules WHERE id = ? AND organization_id = ? AND is_active = 1').bind(xpRuleId, user.organizationId).first<{ id: string; baseXp: number }>() : null
  if (xpRuleId && !xpRule) return Response.json({ error: 'Regra de XP não encontrada ou inativa' }, { status: 404 })

  let validWorkType: { id: string; colorKey: string; defaultMinutes: number } | null = null
  if (workTypeId) {
    validWorkType = await env.DB.prepare(`
      SELECT id, color_key AS colorKey, default_minutes AS defaultMinutes
      FROM work_types
      WHERE id = ? AND organization_id = ?
      LIMIT 1
    `).bind(workTypeId, user.organizationId).first<{ id: string; colorKey: string; defaultMinutes: number }>()
  }

  if (workflowSteps.length) {
    const uniqueDepartments = [...new Set(workflowSteps.map((step) => step.departmentName))]
    const { results } = await env.DB.prepare(`SELECT name FROM departments WHERE organization_id = ? AND is_active = 1 AND name IN (${uniqueDepartments.map(() => '?').join(',')})`).bind(user.organizationId, ...uniqueDepartments).all<{ name: string }>()
    if (results.length !== uniqueDepartments.length) return Response.json({ error: 'A sequência contém um setor inválido' }, { status: 400 })
    const uniqueUsers = [...new Set(workflowSteps.map((step) => step.responsibleUserId))]
    const users = await env.DB.prepare(`SELECT id FROM users WHERE organization_id = ? AND status = 'active' AND id IN (${uniqueUsers.map(() => '?').join(',')})`).bind(user.organizationId, ...uniqueUsers).all<{ id: string }>()
    if (users.results.length !== uniqueUsers.length) return Response.json({ error: 'A sequência contém um responsável inválido' }, { status: 400 })
  }

  const workflow = await ensureDefaultMissionWorkflow(env, user.organizationId)
  const initialStage = workflow.stages.find((stage) => stage.isInitial === 1) ?? workflow.stages.find((stage) => stage.type === 'ready')
  if (!initialStage) return Response.json({ error: 'O fluxo padrão não possui uma etapa inicial' }, { status: 409 })

  const missionId = crypto.randomUUID(), now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO missions (id, project_id, client_id, title, description, status, priority, expected_minutes, xp_reward, reward_label, xp_rule_id, xp_recipient_user_id, current_workflow_position, board_id, stage_id, due_at, created_by_user_id, work_type_id, color_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(missionId, project.id, project.clientId, title, description, priority, expectedMinutes, xpRule?.baseXp ?? xpReward, rewardLabel, xpRule?.id ?? null, assignee.id, workflow.board.id, initialStage.id, dueAt, user.id, validWorkType?.id ?? null, validWorkType?.colorKey ?? 'lime', now, now),
    env.DB.prepare('INSERT INTO mission_assignees (mission_id, user_id) VALUES (?, ?)').bind(missionId, assignee.id),
    env.DB.prepare('INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), missionId, user.id, 'created', 'Missão criada e atribuída.', now),
    env.DB.prepare('INSERT INTO mission_stage_history (id, mission_id, board_id, to_stage_id, actor_user_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), missionId, workflow.board.id, initialStage.id, user.id, 'Missão criada na etapa inicial.', now),
  ])

  if (workflowSteps.length) {
    await env.DB.batch(workflowSteps.map((step, position) => env.DB.prepare('INSERT INTO mission_workflow_steps (id, mission_id, position, department_name, responsible_user_id, step_type, expected_minutes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), missionId, position, step.departmentName, step.responsibleUserId, step.stepType, step.expectedMinutes, position === 0 ? 'active' : 'pending', now)))
  }

  return Response.json({
    id: missionId,
    title,
    projectId: project.id,
    assigneeId: assignee.id,
    boardId: workflow.board.id,
    stageId: initialStage.id,
    stageName: initialStage.name,
    stageType: initialStage.type,
    workTypeId: validWorkType?.id ?? null,
    currentDepartment: workflowSteps[0]?.departmentName ?? null,
    nextDepartment: workflowSteps[1]?.departmentName ?? null,
    currentResponsibleUserId: workflowSteps[0]?.responsibleUserId ?? null,
    nextResponsibleUserId: workflowSteps[1]?.responsibleUserId ?? null,
    dueAt,
    expectedMinutes,
    priority,
    xpReward: xpRule?.baseXp ?? xpReward,
    xpRuleId: xpRule?.id ?? null,
    description,
  }, { status: 201 })
}
