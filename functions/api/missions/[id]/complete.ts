import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../_access'
import { closeActiveTimers } from '../_missionWorkflow'

type MissionReward = {
  id: string
  title: string
  xpReward: number
  ideasReward: number
  status: string
  dueAt: string | null
  xpRuleId: string | null
  assigneeId: string | null
  xpRecipientId: string | null
  currentPosition: number
  currentDepartment: string | null
  nextDepartment: string | null
  currentResponsibleId: string | null
  currentResponsibleName: string | null
  nextResponsibleId: string | null
  nextResponsibleName: string | null
}

type Rule = { id: string; name: string; baseXp: number; bonusPercent: number; version: number }
type Recipient = { id: string; name: string }
type WorkflowParticipant = Recipient & { completedAt: string | null }

export const onRequestPost: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const mission = await env.DB.prepare(`
    SELECT missions.id, missions.title, missions.xp_reward AS xpReward, missions.ideas_reward AS ideasReward,
      missions.status, missions.due_at AS dueAt, missions.xp_rule_id AS xpRuleId,
      MIN(mission_assignees.user_id) AS assigneeId,
      COALESCE(missions.xp_recipient_user_id, MIN(mission_assignees.user_id)) AS xpRecipientId,
      missions.current_workflow_position AS currentPosition,
      (SELECT step.department_name FROM mission_workflow_steps step WHERE step.mission_id = missions.id AND step.position = missions.current_workflow_position) AS currentDepartment,
      (SELECT step.department_name FROM mission_workflow_steps step WHERE step.mission_id = missions.id AND step.position = missions.current_workflow_position + 1) AS nextDepartment,
      (SELECT step.responsible_user_id FROM mission_workflow_steps step WHERE step.mission_id = missions.id AND step.position = missions.current_workflow_position) AS currentResponsibleId,
      (SELECT responsible.name FROM mission_workflow_steps step LEFT JOIN users responsible ON responsible.id = step.responsible_user_id WHERE step.mission_id = missions.id AND step.position = missions.current_workflow_position) AS currentResponsibleName,
      (SELECT step.responsible_user_id FROM mission_workflow_steps step WHERE step.mission_id = missions.id AND step.position = missions.current_workflow_position + 1) AS nextResponsibleId,
      (SELECT responsible.name FROM mission_workflow_steps step LEFT JOIN users responsible ON responsible.id = step.responsible_user_id WHERE step.mission_id = missions.id AND step.position = missions.current_workflow_position + 1) AS nextResponsibleName
    FROM missions JOIN projects ON projects.id = missions.project_id
    LEFT JOIN mission_assignees ON mission_assignees.mission_id = missions.id
    WHERE missions.id = ? AND projects.organization_id = ?
    GROUP BY missions.id
  `).bind(params.id, user.organizationId).first<MissionReward>()
  if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (mission.status === 'completed') return Response.json({ error: 'Missão já concluída' }, { status: 409 })
  if (mission.status === 'cancelled') return Response.json({ error: 'Missão cancelada' }, { status: 409 })

  const [canApprove, canManageWorkflow, canUpdateOwn, userDepartment] = await Promise.all([
    hasPermissionV2(env, request, user, 'missions.approve'),
    hasPermissionV2(env, request, user, 'missions.workflow.manage'),
    hasPermissionV2(env, request, user, 'missions.update_own'),
    user.departmentId ? env.DB.prepare('SELECT name FROM departments WHERE id = ? AND organization_id = ?').bind(user.departmentId, user.organizationId).first<{ name: string }>() : null,
  ])
  const isAssignee = mission.assigneeId === user.id
  const isCurrentResponsible = mission.currentResponsibleId === user.id
  const belongsToCurrentDepartment = Boolean(mission.currentDepartment && userDepartment?.name === mission.currentDepartment)
  const isFinalDecisionDepartment = mission.currentDepartment === 'Atendimento' || mission.currentDepartment === 'Planejamento'
  const nowDate = new Date()
  const now = nowDate.toISOString()

  if (mission.currentDepartment && mission.nextDepartment) {
    if (!canManageWorkflow && !belongsToCurrentDepartment && !isCurrentResponsible && !isAssignee && !canUpdateOwn) return permissionRequiredResponse()
    const completedById = mission.currentResponsibleId ?? user.id
    const { statements: timerStatements } = await closeActiveTimers(env.DB, mission.id, user.organizationId, nowDate)
    const statements = [
      env.DB.prepare(`UPDATE mission_workflow_steps SET status = 'completed', completed_by_user_id = ?, completed_at = ? WHERE mission_id = ? AND position = ?`).bind(completedById, now, mission.id, mission.currentPosition),
      env.DB.prepare(`UPDATE mission_workflow_steps SET status = 'active' WHERE mission_id = ? AND position = ?`).bind(mission.id, mission.currentPosition + 1),
      env.DB.prepare(`UPDATE missions SET status = 'in_progress', approval_status = 'not_requested', current_workflow_position = current_workflow_position + 1, updated_at = ? WHERE id = ?`).bind(now, mission.id),
      env.DB.prepare(`INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, 'workflow_advanced', ?, ?)`).bind(crypto.randomUUID(), mission.id, user.id, `${mission.currentDepartment} concluiu sua etapa. Próximo setor: ${mission.nextDepartment}.`, now),
      ...timerStatements,
    ]

    if (mission.nextResponsibleId) {
      statements.push(
        env.DB.prepare(`DELETE FROM mission_assignees WHERE mission_id = ?`).bind(mission.id),
        env.DB.prepare(`INSERT OR IGNORE INTO mission_assignees (mission_id, user_id) VALUES (?, ?)`).bind(mission.id, mission.nextResponsibleId),
      )
    }

    await env.DB.batch(statements)
    const following = await env.DB.prepare('SELECT department_name AS name FROM mission_workflow_steps WHERE mission_id = ? AND position = ?').bind(mission.id, mission.currentPosition + 2).first<{ name: string }>()
    return Response.json({ missionId: mission.id, status: 'workflow_advanced', currentDepartment: mission.nextDepartment, currentResponsibleName: mission.nextResponsibleName, nextDepartment: following?.name ?? null })
  }

  if (mission.currentDepartment) {
    if (!canApprove && !canManageWorkflow && !isCurrentResponsible && !(isFinalDecisionDepartment && belongsToCurrentDepartment) && !isAssignee && !canUpdateOwn) return permissionRequiredResponse()
  } else if (!canApprove && !canManageWorkflow && !isAssignee && !canUpdateOwn) {
    return permissionRequiredResponse()
  }

  if (!mission.currentDepartment && !canApprove) {
    const { statements: timerStatements } = await closeActiveTimers(env.DB, mission.id, user.organizationId, nowDate)
    await env.DB.batch([
      env.DB.prepare(`UPDATE missions SET status = 'in_progress', approval_status = 'pending', approval_requested_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, mission.id),
      env.DB.prepare(`INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, 'approval_requested', 'Entrega enviada para aprovação.', ?)`).bind(crypto.randomUUID(), mission.id, user.id, now),
      ...timerStatements,
    ])
    return Response.json({ missionId: mission.id, status: 'pending_approval' })
  }

  const completion = await env.DB.prepare(`UPDATE missions SET status = 'completed', approval_status = 'approved', completed_at = ?, approved_at = ?, approved_by_user_id = ?, updated_at = ? WHERE id = ? AND status <> 'completed'`).bind(now, now, user.id, now, mission.id).run()
  if (!completion.meta.changes) return Response.json({ error: 'Missão já concluída' }, { status: 409 })

  const configuredRule = mission.xpRuleId ? await env.DB.prepare(`SELECT id, name, base_xp AS baseXp, on_time_bonus_percent AS bonusPercent, version FROM xp_rules WHERE id = ? AND organization_id = ?`).bind(mission.xpRuleId, user.organizationId).first<Rule>() : null
  const rule: Rule = configuredRule ?? { id: '', name: 'Recompensa definida na missão', baseXp: mission.xpReward, bonusPercent: 0, version: 1 }
  const roleFilter = configuredRule ? `AND (NOT EXISTS (SELECT 1 FROM xp_rule_roles WHERE rule_id = ?) OR EXISTS (SELECT 1 FROM user_role_assignments roles WHERE roles.user_id = users.id AND roles.role_code IN (SELECT role_code FROM xp_rule_roles WHERE rule_id = ?)))` : ''
  const departmentFilter = configuredRule ? `AND (NOT EXISTS (SELECT 1 FROM xp_rule_departments WHERE rule_id = ?) OR users.department_id IN (SELECT department_id FROM xp_rule_departments WHERE rule_id = ?))` : ''
  const { results: completedParticipants } = mission.currentDepartment
    ? await env.DB.prepare(`
        SELECT users.id, users.name, MAX(steps.completed_at) AS completedAt
        FROM mission_workflow_steps steps
        JOIN users ON users.id = steps.completed_by_user_id
        WHERE steps.mission_id = ? AND steps.status = 'completed' AND users.organization_id = ?
        GROUP BY users.id, users.name
      `).bind(mission.id, user.organizationId).all<WorkflowParticipant>()
    : { results: [] as WorkflowParticipant[] }
  const participantCompletion = new Map<string, WorkflowParticipant>()
  for (const participant of completedParticipants) participantCompletion.set(participant.id, participant)
  if (mission.currentDepartment) {
    const finalResponsibleId = mission.currentResponsibleId ?? user.id
    const finalResponsibleName = mission.currentResponsibleName ?? user.name
    const previous = participantCompletion.get(finalResponsibleId)
    participantCompletion.set(finalResponsibleId, { id: finalResponsibleId, name: finalResponsibleName, completedAt: previous?.completedAt && previous.completedAt > now ? previous.completedAt : now })
  } else if (mission.xpRecipientId) {
    const legacyRecipient = await env.DB.prepare('SELECT id, name FROM users WHERE id = ? AND organization_id = ?').bind(mission.xpRecipientId, user.organizationId).first<Recipient>()
    if (legacyRecipient) participantCompletion.set(legacyRecipient.id, { ...legacyRecipient, completedAt: now })
  }
  const eligibleParticipants: WorkflowParticipant[] = []
  for (const participant of participantCompletion.values()) {
    const eligible = await env.DB.prepare(`SELECT users.id, users.name FROM users WHERE users.id = ? AND users.organization_id = ? ${roleFilter} ${departmentFilter}`).bind(...(configuredRule ? [participant.id, user.organizationId, rule.id, rule.id, rule.id, rule.id] : [participant.id, user.organizationId])).first<Recipient>()
    if (eligible) eligibleParticipants.push({ ...eligible, completedAt: participant.completedAt })
  }
  const multiplierRow = await env.DB.prepare('SELECT xp_multiplier AS multiplier FROM organization_settings WHERE organization_id = ?').bind(user.organizationId).first<{ multiplier: number }>()
  const multiplier = Math.max(0.1, Number(multiplierRow?.multiplier ?? 1))
  const baseXp = Math.round(rule.baseXp * multiplier)
  const { statements: timerStatements } = await closeActiveTimers(env.DB, mission.id, user.organizationId, nowDate)
  const statements = [
    ...timerStatements,
  ]
  const awards: Array<{ userId: string; userName: string; xp: number; bonusXp: number }> = []

  for (const recipient of eligibleParticipants) {
    const onTime = Boolean(mission.dueAt && recipient.completedAt && Date.parse(recipient.completedAt) <= Date.parse(mission.dueAt))
    const bonusXp = onTime ? Math.round(rule.baseXp * rule.bonusPercent / 100 * multiplier) : 0
    const finalXp = baseXp + bonusXp
    awards.push({ userId: recipient.id, userName: recipient.name, xp: finalXp, bonusXp })
    statements.push(
      env.DB.prepare(`INSERT OR IGNORE INTO gamification_profiles (user_id, xp, ideas, level, streak_days, updated_at) VALUES (?, 0, 0, 'Criador', 0, ?)`).bind(recipient.id, now),
      env.DB.prepare('UPDATE gamification_profiles SET xp = xp + ?, ideas = ideas + ?, updated_at = ? WHERE user_id = ?').bind(finalXp, mission.ideasReward, now, recipient.id),
      env.DB.prepare(`INSERT INTO xp_awards (id, organization_id, mission_id, user_id, rule_id, rule_version, rule_name, base_xp, bonus_xp, final_xp, recipient_mode, awarded_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'participants_each', ?, ?)`).bind(crypto.randomUUID(), user.organizationId, mission.id, recipient.id, rule.id || null, rule.version, rule.name, baseXp, bonusXp, finalXp, user.id, now),
      env.DB.prepare(`INSERT INTO xp_events (id, user_id, mission_id, xp, ideas, event_type, created_at) VALUES (?, ?, ?, ?, ?, 'mission_completed', ?)`).bind(crypto.randomUUID(), recipient.id, mission.id, finalXp, mission.ideasReward, now),
      env.DB.prepare(`INSERT INTO agency_feed (id, user_id, type, title, target_name, xp_amount, link, organization_id) VALUES (?, ?, 'mission_completed', 'concluiu a missão', ?, ?, '/?section=projects', ?)`).bind(crypto.randomUUID(), recipient.id, mission.title, finalXp, user.organizationId),
    )
  }
  if (mission.currentDepartment) statements.push(env.DB.prepare(`UPDATE mission_workflow_steps SET status = 'completed', completed_by_user_id = ?, completed_at = ? WHERE mission_id = ? AND position = ?`).bind(mission.currentResponsibleId ?? user.id, now, mission.id, mission.currentPosition))
  const awardNames = awards.map((award) => award.userName).join(', ')
  statements.push(env.DB.prepare(`INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, 'approved', ?, ?)`).bind(crypto.randomUUID(), mission.id, user.id, awards.length ? `Missão concluída. XP creditado aos participantes do fluxo: ${awardNames}.` : 'Missão concluída sem XP: nenhum participante do fluxo atende à regra.', now))
  await env.DB.batch(statements)
  return Response.json({ missionId: mission.id, status: 'completed', rule: rule.name, awards })
}
