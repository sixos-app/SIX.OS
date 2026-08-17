import { accessRequiredResponse, getAccessUser, getPermissionScope, hasPermissionV2, permissionRequiredResponse, type Bindings, type PermissionScope } from './_access'

type MissionRow = {
  id: string
  title: string
  client: string
  projectId: string
  assigneeId: string | null
  deadline: string
  dueAt: string | null
  xp: number
  ideas: number
  tone: 'lime' | 'purple' | 'orange'
  urgent: number
  status: 'open' | 'in_progress' | 'completed'
  approvalStatus: 'not_requested' | 'pending' | 'approved'
  xpRecipientUserId: string | null
  xpRecipientName: string | null
  currentDepartment: string | null
  nextDepartment: string | null
  currentResponsibleUserId: string | null
  currentResponsibleName: string | null
  nextResponsibleUserId: string | null
  nextResponsibleName: string | null
  currentWorkflowPosition: number
  workflowDepartments: string | null
  workflowResponsibleNames: string | null
  boardId: string | null
  stageId: string | null
  stageName: string | null
  stageType: 'backlog' | 'ready' | 'doing' | 'review' | 'approval' | 'done' | null
  stageColor: 'lime' | 'purple' | 'orange' | 'neutral' | null
  startedAt: string | null
  activeTimerStartedAt: string | null
  workTypeId: string | null
}

type ProjectRow = {
  id: string
  code: string
  name: string
  client: string
  status: string
  progress: number
  deadline: string
  dueAt: string | null
  tone: 'lime' | 'purple' | 'orange'
  nextStep: string
  activity: string
  clientImageUrl: string | null
  workTypeIdsCsv: string | null
}

type TeamRow = {
  id: string
  name: string
  username: string | null
  role: string
  openMissions: number
  focus: string | null
  projects: string | null
  department: string | null
}

function missionScope(scope: PermissionScope, user: { id: string; teamId: string | null; departmentId: string | null }) {
  if (scope === 'own' || scope === 'participating_projects') {
    return { sql: ` AND (
      missions.id IN (SELECT mission_id FROM mission_assignees WHERE user_id = ?)
      OR missions.id IN (SELECT mission_id FROM mission_workflow_steps WHERE responsible_user_id = ?)
    )`, binds: [user.id, user.id] }
  }
  if (scope === 'department') {
    return { sql: ' AND (missions.department = ? OR missions.department IN (SELECT name FROM departments WHERE id = ?))', binds: [user.departmentId || 'none', user.departmentId || 'none'] }
  }
  if (scope === 'team') {
    return { sql: ' AND missions.id IN (SELECT scoped_assignees.mission_id FROM mission_assignees scoped_assignees JOIN users scoped_users ON scoped_users.id = scoped_assignees.user_id WHERE scoped_users.team_id = ?)', binds: [user.teamId || 'none'] }
  }
  if (scope === 'assigned_clients') {
    return { sql: ' AND clients.account_manager_id = ?', binds: [user.id] }
  }
  if (scope === 'unit') {
    return { sql: ' AND missions.id IN (SELECT scoped_assignees.mission_id FROM mission_assignees scoped_assignees JOIN users scoped_users ON scoped_users.id = scoped_assignees.user_id WHERE scoped_users.department_id = ?)', binds: [user.departmentId || 'none'] }
  }
  return scope === 'all' ? { sql: '', binds: [] } : { sql: ' AND 1 = 0', binds: [] }
}

function projectScope(scope: PermissionScope, user: { id: string; teamId: string | null; departmentId: string | null }) {
  if (scope === 'all') return { sql: '', binds: [] }
  if (scope === 'team') return { sql: ' AND projects.id IN (SELECT missions.project_id FROM missions JOIN mission_assignees ON mission_assignees.mission_id = missions.id JOIN users scoped_users ON scoped_users.id = mission_assignees.user_id WHERE scoped_users.team_id = ?)', binds: [user.teamId || 'none'] }
  if (scope === 'department' || scope === 'unit') return { sql: ' AND projects.id IN (SELECT missions.project_id FROM missions JOIN mission_assignees ON mission_assignees.mission_id = missions.id JOIN users scoped_users ON scoped_users.id = mission_assignees.user_id WHERE scoped_users.department_id = ?)', binds: [user.departmentId || 'none'] }
  if (scope === 'assigned_clients') return { sql: ' AND clients.account_manager_id = ?', binds: [user.id] }
  return { sql: ' AND projects.id IN (SELECT missions.project_id FROM missions JOIN mission_assignees ON mission_assignees.mission_id = missions.id WHERE mission_assignees.user_id = ?)', binds: [user.id] }
}

function teamScope(scope: PermissionScope, user: { id: string; teamId: string | null; departmentId: string | null }) {
  if (scope === 'all') return { sql: '', binds: [] }
  if (scope === 'team') return { sql: ' AND users.team_id = ?', binds: [user.teamId || 'none'] }
  if (scope === 'department' || scope === 'unit') return { sql: ' AND users.department_id = ?', binds: [user.departmentId || 'none'] }
  return { sql: ' AND users.id = ?', binds: [user.id] }
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const scope = await getPermissionScope(env, request, user, 'missions.view')
  if (!scope) return permissionRequiredResponse()
  const scoped = missionScope(scope, user)
  const scopedProjects = projectScope(scope, user)
  const scopedTeam = teamScope(scope, user)

  try {
    const [profile, missionsResult, projectsResult, teamResult, xpResult, eventResult, activeTimer, workTypesResult, departmentsResult, notificationsResult] = await Promise.all([
      env.DB.prepare(`
        SELECT COALESCE(xp, 0) AS xp, COALESCE(ideas, 0) AS ideas,
          COALESCE(level, 'Criador') AS level, COALESCE(streak_days, 0) AS streak
        FROM gamification_profiles WHERE user_id = ? LIMIT 1
      `).bind(user.id).first<{ xp: number; ideas: number; level: string; streak: number }>(),
    env.DB.prepare(`
      SELECT missions.id, missions.title, clients.name AS client, missions.project_id AS projectId,
        MIN(mission_assignees.user_id) AS assigneeId,
        missions.due_at AS dueAt,
        CASE
          WHEN date(missions.due_at) = date('now', 'localtime') THEN 'Hoje · ' || time(missions.due_at, 'localtime')
          WHEN date(missions.due_at) = date('now', 'localtime', '+1 day') THEN 'Amanhã · ' || time(missions.due_at, 'localtime')
          ELSE strftime('%d/%m · %H:%M', missions.due_at, 'localtime')
        END AS deadline,
        missions.xp_reward AS xp, missions.ideas_reward AS ideas, missions.visual_tone AS tone,
        CASE WHEN missions.priority = 'urgent' THEN 1 ELSE 0 END AS urgent,
        missions.status, missions.approval_status AS approvalStatus,
        missions.realized_cost AS realizedCost,
        missions.xp_recipient_user_id AS xpRecipientUserId,
        (SELECT recipient.name FROM users recipient WHERE recipient.id = missions.xp_recipient_user_id) AS xpRecipientName,
        (SELECT steps.department_name FROM mission_workflow_steps steps WHERE steps.mission_id = missions.id AND steps.position = missions.current_workflow_position LIMIT 1) AS currentDepartment,
        (SELECT steps.department_name FROM mission_workflow_steps steps WHERE steps.mission_id = missions.id AND steps.position = missions.current_workflow_position + 1 LIMIT 1) AS nextDepartment,
        (SELECT steps.responsible_user_id FROM mission_workflow_steps steps WHERE steps.mission_id = missions.id AND steps.position = missions.current_workflow_position LIMIT 1) AS currentResponsibleUserId,
        (SELECT responsible.name FROM mission_workflow_steps steps LEFT JOIN users responsible ON responsible.id = steps.responsible_user_id WHERE steps.mission_id = missions.id AND steps.position = missions.current_workflow_position LIMIT 1) AS currentResponsibleName,
        (SELECT steps.responsible_user_id FROM mission_workflow_steps steps WHERE steps.mission_id = missions.id AND steps.position = missions.current_workflow_position + 1 LIMIT 1) AS nextResponsibleUserId,
        (SELECT responsible.name FROM mission_workflow_steps steps LEFT JOIN users responsible ON responsible.id = steps.responsible_user_id WHERE steps.mission_id = missions.id AND steps.position = missions.current_workflow_position + 1 LIMIT 1) AS nextResponsibleName,
        missions.current_workflow_position AS currentWorkflowPosition,
        (SELECT GROUP_CONCAT(ordered_steps.department_name, '||') FROM (SELECT department_name FROM mission_workflow_steps WHERE mission_id = missions.id ORDER BY position) ordered_steps) AS workflowDepartments,
        (SELECT GROUP_CONCAT(COALESCE(ordered_steps.responsible_name, 'A definir'), '||') FROM (SELECT responsible.name AS responsible_name FROM mission_workflow_steps steps LEFT JOIN users responsible ON responsible.id = steps.responsible_user_id WHERE steps.mission_id = missions.id ORDER BY steps.position) ordered_steps) AS workflowResponsibleNames,
        missions.board_id AS boardId, missions.stage_id AS stageId,
        workflow_stages.name AS stageName, workflow_stages.type AS stageType,
        workflow_stages.color AS stageColor, missions.started_at AS startedAt,
        (SELECT entries.started_at FROM time_entries entries
         WHERE entries.mission_id = missions.id AND entries.user_id = ?
           AND entries.entry_type = 'timer' AND entries.started_at IS NOT NULL AND entries.ended_at IS NULL
         LIMIT 1) AS activeTimerStartedAt,
        missions.work_type_id AS workTypeId
      FROM missions
      JOIN clients ON clients.id = missions.client_id
      JOIN projects ON projects.id = missions.project_id
      LEFT JOIN workflow_stages ON workflow_stages.id = missions.stage_id
      LEFT JOIN mission_assignees ON mission_assignees.mission_id = missions.id
      WHERE projects.organization_id = ? AND missions.status IN ('open', 'in_progress', 'completed')${scoped.sql}
      GROUP BY missions.id
      ORDER BY CASE WHEN missions.status = 'completed' THEN 1 ELSE 0 END, missions.due_at ASC
      LIMIT 100
    `).bind(user.id, user.organizationId, ...scoped.binds).all<MissionRow>(),
    env.DB.prepare(`
      SELECT projects.id, COALESCE(clients.short_code, substr(upper(clients.name), 1, 3)) AS code,
        projects.name, clients.name AS client,
        CASE projects.status WHEN 'planning' THEN 'EM CONCEPÇÃO' WHEN 'active' THEN 'EM PRODUÇÃO'
          WHEN 'approval' THEN 'EM APROVAÇÃO' WHEN 'delivered' THEN 'CONCLUÍDO' ELSE 'ARQUIVADO' END AS status,
        projects.progress, projects.due_at AS dueAt,
        CASE WHEN projects.due_at IS NULL THEN 'Próximo marco · em definição'
          ELSE strftime('%d/%m/%Y · %H:%M', projects.due_at, 'localtime') END AS deadline,
        COALESCE(projects.color_key, projects.visual_tone) AS tone, projects.next_step AS nextStep,
        projects.activity, clients.image_url AS clientImageUrl,
        (SELECT GROUP_CONCAT(pwt.work_type_id, ',') FROM project_work_types pwt WHERE pwt.project_id = projects.id) AS workTypeIdsCsv
      FROM projects
      JOIN clients ON clients.id = projects.client_id
      WHERE projects.organization_id = ?${scopedProjects.sql}
      ORDER BY projects.updated_at DESC
      LIMIT 100
    `).bind(user.organizationId, ...scopedProjects.binds).all<ProjectRow>(),
    env.DB.prepare(`
      SELECT users.id, users.name, users.username, COALESCE(positions.name, access_profiles.name, users.role) AS role,
        departments.name AS department,
        COUNT(DISTINCT CASE WHEN missions.status IN ('open', 'in_progress') THEN missions.id END) AS openMissions,
        MIN(CASE WHEN missions.status IN ('open', 'in_progress') THEN missions.title END) AS focus,
        GROUP_CONCAT(DISTINCT projects.name) AS projects
      FROM users
      LEFT JOIN professional_positions positions ON positions.id = users.position_id
      LEFT JOIN access_profiles ON access_profiles.id = users.access_profile_id
      LEFT JOIN departments ON departments.id = users.department_id
      LEFT JOIN mission_assignees ON mission_assignees.user_id = users.id
      LEFT JOIN missions ON missions.id = mission_assignees.mission_id
      LEFT JOIN projects ON projects.id = missions.project_id AND projects.organization_id = users.organization_id
      WHERE users.organization_id = ? AND users.status = 'active'${scopedTeam.sql}
      GROUP BY users.id
      ORDER BY users.name
    `).bind(user.organizationId, ...scopedTeam.binds).all<TeamRow>(),
    env.DB.prepare(`
      SELECT date(created_at, 'localtime') AS day, SUM(xp) AS xp
      FROM xp_events
      WHERE user_id = ? AND created_at >= datetime('now', '-6 days')
      GROUP BY date(created_at, 'localtime')
    `).bind(user.id).all<{ day: string; xp: number }>(),
    env.DB.prepare(`
      SELECT calendar_events.id, calendar_events.title, calendar_events.starts_at AS startsAt,
        calendar_events.ends_at AS endsAt, calendar_events.event_type AS eventType,
        calendar_events.description, COALESCE(projects.name, calendar_events.location, 'Agenda') AS subtitle,
        users.name AS ownerName
      FROM calendar_events
      LEFT JOIN projects ON projects.id = calendar_events.project_id
      LEFT JOIN users ON users.id = calendar_events.owner_user_id
      WHERE calendar_events.organization_id = ?
        AND (calendar_events.owner_user_id = ? OR calendar_events.visibility = 'team')
        AND date(calendar_events.starts_at, 'localtime') BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+1 day')
      ORDER BY calendar_events.starts_at
      LIMIT 20
    `).bind(user.organizationId, user.id).all<{ id: string; title: string; startsAt: string; endsAt: string | null; eventType: string; description: string; subtitle: string; ownerName: string | null }>(),
    env.DB.prepare(`
      SELECT entries.id, entries.mission_id AS missionId, missions.title AS missionTitle,
        entries.started_at AS startedAt
      FROM time_entries entries
      JOIN missions ON missions.id = entries.mission_id
      JOIN projects ON projects.id = missions.project_id
      WHERE entries.organization_id = ? AND entries.user_id = ?
        AND projects.organization_id = ? AND entries.entry_type = 'timer'
        AND entries.started_at IS NOT NULL AND entries.ended_at IS NULL
      LIMIT 1
    `).bind(user.organizationId, user.id, user.organizationId).first<{ id: string; missionId: string; missionTitle: string; startedAt: string }>(),
    env.DB.prepare(`
      SELECT id, name, default_minutes AS defaultMinutes, color_key AS colorKey, is_active AS isActive
      FROM work_types
      WHERE organization_id = ? AND is_active = 1
      ORDER BY name ASC
    `).bind(user.organizationId).all<{ id: string; name: string; defaultMinutes: number; colorKey: string; isActive: number }>(),
    env.DB.prepare(`
      SELECT id, name
      FROM departments
      WHERE organization_id = ? AND is_active = 1
      ORDER BY name ASC
    `).bind(user.organizationId).all<{ id: string; name: string }>(),
    env.DB.prepare(`
      SELECT id, title, description, created_at AS createdAt, entity_type AS entityType, entity_id AS entityId, type, is_read AS isRead, metadata
      FROM app_notifications
      WHERE recipient_user_id = ? AND organization_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(user.id, user.organizationId).all<{ id: string; title: string; description: string; createdAt: string; entityType: string; entityId: string; type: string; isRead: number; metadata: string | null }>(),
  ])

  const xpByDay = new Map(xpResult.results.map(row => [row.day, Number(row.xp) || 0]))
  const labels = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
  const weekly = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return { label: labels[date.getDay()], xp: xpByDay.get(key) ?? 0, focus: 0 }
  })

  const [canManageWorkflow, userDepartment] = await Promise.all([
    hasPermissionV2(env, request, user, 'missions.workflow.manage'),
    user.departmentId ? env.DB.prepare('SELECT name FROM departments WHERE id = ? AND organization_id = ?').bind(user.departmentId, user.organizationId).first<{ name: string }>() : null,
  ])
  const missions = missionsResult.results.map(mission => ({
    ...mission,
    urgent: mission.urgent === 1,
    workflowDepartments: mission.workflowDepartments ? mission.workflowDepartments.split('||') : [],
    workflowResponsibleNames: mission.workflowResponsibleNames ? mission.workflowResponsibleNames.split('||') : [],
    canAdvanceWorkflow: Boolean(mission.currentDepartment && (canManageWorkflow || mission.currentResponsibleUserId === user.id || mission.currentDepartment === userDepartment?.name || mission.assigneeId === user.id)),
    canReturnWorkflow: Boolean(mission.currentDepartment && mission.currentWorkflowPosition > 0 && (canManageWorkflow || ((mission.currentDepartment === 'Atendimento' || mission.currentDepartment === 'Planejamento') && mission.currentDepartment === userDepartment?.name))),
  }))
  const completedCount = missions.filter(mission => mission.status === 'completed').length
  const deliveryRate = missions.length ? Math.round((completedCount / missions.length) * 100) : 0

  return Response.json({
    profile: profile ?? { xp: 0, ideas: 0, level: 'Criador', streak: 0 },
    missions,
    projects: projectsResult.results.map(project => ({
      ...project,
      members: [],
      workTypeIds: project.workTypeIdsCsv ? project.workTypeIdsCsv.split(',').filter(Boolean) : [],
    })),
    departments: departmentsResult.results,
    workTypes: (workTypesResult?.results ?? []).map(wt => ({
      id: wt.id,
      name: wt.name,
      defaultMinutes: Number(wt.defaultMinutes ?? 60),
      colorKey: wt.colorKey ?? 'lime',
      isActive: wt.isActive === 1,
    })),
    team: teamResult.results.map((member, index) => {
      const capacity = Math.min(100, Number(member.openMissions) * 20)
      return {
        id: member.id,
        name: member.name,
        username: member.username ?? null,
        initials: member.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toLocaleUpperCase('pt-BR'),
        role: member.role,
        department: member.department,
        availability: capacity >= 90 ? 'No limite' : capacity >= 50 ? 'Em foco' : 'Disponível',
        capacity,
        focus: member.focus ?? 'Sem missão em aberto',
        projects: member.projects ? member.projects.split(',') : [],
        tone: index % 3 === 1 ? 'lime' : index % 3 === 2 ? 'purple' : 'dark',
        note: member.openMissions ? `${member.openMissions} missão(ões) em aberto.` : 'Sem carga operacional registrada.',
      }
    }),
    agenda: eventResult.results.map(event => {
      const starts = new Date(event.startsAt)
      const ends = event.endsAt ? new Date(event.endsAt) : null
      const durationMinutes = ends ? Math.max(0, Math.round((ends.getTime() - starts.getTime()) / 60000)) : 0
      return {
        id: event.id,
        time: starts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
        title: event.title,
        subtitle: event.subtitle,
        day: starts.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) === new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) ? 'Hoje' : 'Amanhã',
        category: event.eventType === 'meeting' ? 'Reunião' : event.eventType === 'deadline' ? 'Entrega' : 'Criação',
        tone: event.eventType === 'deadline' ? 'orange' : event.eventType === 'meeting' ? 'purple' : 'lime',
        duration: durationMinutes ? `${durationMinutes} min` : 'Sem duração',
        attendees: event.ownerName ? [event.ownerName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toLocaleUpperCase('pt-BR')] : [],
        description: event.description,
      }
    }),
    analytics: { weekly, streak: profile?.streak ?? 0, deliveryRate },
    library: [],
    notifications: (notificationsResult?.results ?? []).map(notif => {
      const created = new Date(notif.createdAt)
      const diffMinutes = Math.round((Date.now() - created.getTime()) / 60000)
      const timeLabel = diffMinutes < 1 ? 'agora' : diffMinutes < 60 ? `há ${diffMinutes} min` : diffMinutes < 1440 ? `há ${Math.floor(diffMinutes / 60)}h` : created.toLocaleDateString('pt-BR', { dateStyle: 'short' })
      return {
        id: notif.id,
        title: notif.title,
        description: notif.description,
        time: timeLabel,
        category: (notif.entityType === 'mission' ? 'Projeto' : notif.entityType === 'project' ? 'Projeto' : notif.entityType === 'agenda_event' ? 'Agenda' : 'Equipe') as 'Projeto' | 'Agenda' | 'Equipe',
        tone: 'lime' as const,
        isRead: notif.isRead === 1,
        destination: notif.entityType === 'mission'
          ? { section: 'missions' as const, missionId: notif.entityId }
          : notif.entityType === 'project'
          ? { section: 'projects' as const, projectId: notif.entityId }
          : notif.entityType === 'agenda_event'
          ? { section: 'agenda' as const }
          : undefined,
      }
    }),
    activeTimer: activeTimer ?? null,
  })
  } catch (err) {
    console.error('Erro ao processar dashboard operacional:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Falha interna ao carregar o dashboard' },
      { status: 500 }
    )
  }
}
