import { randomUUID } from 'node:crypto'

export type PilotBootstrapInput = {
  organizationName: string
  organizationSlug: string
  adminName: string
  adminEmail: string
  adminUsername: string
  password: string
}

export type ValidatedPilotBootstrapInput = Omit<PilotBootstrapInput, 'password'>

export type PilotCredential = {
  passwordSalt: string
  passwordHash: string
  iterations: number
}

export type PilotBootstrapIds = {
  organizationId: string
  adminUserId: string
  adminProfileId: string
}

export const HISTORICAL_SEED_COUNTS = Object.freeze({
  access_audit_log: 0,
  access_profiles: 6,
  agency_feed: 0,
  app_notifications: 0,
  approvals: 0,
  auth_login_attempts: 0,
  auth_sessions: 0,
  calendar_event_participants: 0,
  calendar_events: 0,
  client_contacts: 0,
  client_library_file_versions: 0,
  client_library_files: 0,
  client_library_folders: 0,
  clients: 0,
  competencies: 0,
  competency_categories: 0,
  contracts: 0,
  cost_centers: 0,
  d1_migrations: 50,
  demands: 0,
  departments: 6,
  development_actions: 0,
  development_checkin_entries: 0,
  development_checkins: 0,
  development_evidence: 0,
  development_goals: 0,
  development_plans: 0,
  employee_audit_logs: 0,
  employee_compensation_history: 1,
  employee_documents: 0,
  employee_library_file_versions: 0,
  employee_library_files: 0,
  employee_library_folders: 9,
  employees: 1,
  evaluation_answers: 0,
  evaluation_assignments: 0,
  evaluation_cycle_participants: 0,
  evaluation_cycles: 0,
  evaluation_debriefs: 0,
  evaluation_questions: 0,
  evaluation_responses: 0,
  evaluation_scale_options: 0,
  evaluation_scales: 0,
  evaluation_templates: 0,
  external_integrations: 0,
  gamification_profiles: 1,
  integration_connections: 0,
  invoices: 0,
  mission_assignees: 0,
  mission_attachments: 0,
  mission_checklist_items: 0,
  mission_comments: 0,
  mission_history: 0,
  mission_stage_history: 0,
  mission_workflow_steps: 0,
  missions: 0,
  organization_settings: 1,
  organizations: 1,
  permissions: 67,
  professional_levels: 0,
  professional_positions: 0,
  profile_permissions: 187,
  project_library_file_versions: 0,
  project_library_files: 0,
  project_library_folders: 0,
  project_work_types: 0,
  projects: 0,
  role_definitions: 5,
  role_permissions: 50,
  subtasks: 0,
  tasks: 0,
  teams: 1,
  time_entries: 0,
  user_credentials: 0,
  user_permission_overrides: 0,
  user_role_assignments: 1,
  users: 1,
  work_types: 6,
  workflow_boards: 1,
  workflow_stages: 6,
  xp_awards: 0,
  xp_events: 0,
  xp_rule_departments: 0,
  xp_rule_roles: 0,
  xp_rules: 1,
})

export type HistoricalSeedCounts = Record<keyof typeof HISTORICAL_SEED_COUNTS, number>
export type HistoricalSeedIdentity = { organization: string; user: string; adminProfile: string }

export const LEGACY_SEED_TABLES = Object.freeze([
  'development_checkin_entries', 'development_checkins', 'development_evidence', 'development_actions', 'development_goals', 'development_plans',
  'evaluation_debriefs', 'evaluation_answers', 'evaluation_responses', 'evaluation_assignments', 'evaluation_cycle_participants', 'evaluation_cycles',
  'employee_library_file_versions', 'employee_library_files', 'employee_library_folders', 'employee_documents', 'employee_audit_logs', 'employee_compensation_history', 'employees',
  'project_library_file_versions', 'project_library_files', 'project_library_folders', 'client_library_file_versions', 'client_library_files', 'client_library_folders',
  'calendar_event_participants', 'calendar_events', 'time_entries', 'subtasks', 'tasks', 'demands', 'invoices', 'contracts', 'client_contacts',
  'mission_stage_history', 'mission_workflow_steps', 'mission_history', 'mission_attachments', 'mission_comments', 'mission_checklist_items', 'mission_assignees', 'missions',
  'project_work_types', 'projects', 'clients', 'cost_centers', 'work_types',
  'xp_awards', 'xp_events', 'xp_rule_departments', 'xp_rule_roles', 'xp_rules', 'gamification_profiles',
  'agency_feed', 'app_notifications', 'external_integrations', 'integration_connections', 'auth_sessions', 'auth_login_attempts',
  'user_permission_overrides', 'access_audit_log', 'user_role_assignments', 'user_credentials', 'users',
  'profile_permissions', 'access_profiles', 'professional_positions', 'professional_levels', 'departments', 'teams', 'organization_settings', 'organizations',
  'evaluation_questions', 'evaluation_templates', 'evaluation_scale_options', 'evaluation_scales', 'competencies', 'competency_categories',
] as const)

const SYSTEM_PROFILES = [
  ['admin_tech', 'Administrador Técnico', 'Acesso total ao sistema.'],
  ['operations_management', 'Gerência de Operações', 'Visão geral, projetos e aprovações.'],
  ['coordinator', 'Coordenador', 'Distribuição de missões e coordenação da equipe.'],
  ['service', 'Planejamento', 'Planejamento de clientes, projetos, briefings e acompanhamento.'],
  ['specialist', 'Especialista', 'Execução das próprias missões e envio de arquivos.'],
  ['finance', 'Financeiro / RH', 'Acesso completo a colaboradores, remuneração, documentos e finanças.'],
] as const

const DEPARTMENTS = [
  ['atendimento', 'Atendimento', 'Relacionamento e atendimento aos clientes.'],
  ['planejamento', 'Planejamento', 'Estrategia, briefing e planejamento de entregas.'],
  ['criacao', 'Criação', 'Direcao de arte, design e criacao.'],
  ['social_midia', 'Social Mídia', 'Conteudo, comunidade e canais sociais.'],
  ['audiovisual', 'Audiovisual', 'Producao, captacao e pos-producao audiovisual.'],
  ['redacao', 'Redação', 'Redação, conteúdo e revisão textual.'],
] as const

const WORK_TYPES = [
  ['design / peca', 'Design / Peça', 120, 'lime'],
  ['redacao / conteudo', 'Redação / Conteúdo', 90, 'purple'],
  ['planejamento / estrategia', 'Planejamento / Estratégia', 180, 'blue'],
  ['video / motion', 'Vídeo / Motion', 240, 'orange'],
  ['social media / post', 'Social Media / Post', 60, 'cyan'],
  ['atendimento / alinhamento', 'Atendimento / Alinhamento', 60, 'pink'],
] as const

const WORKFLOW_STAGES = [
  ['Entrada', 'backlog', 'neutral', 0, 0, 0],
  ['A Fazer', 'ready', 'purple', 1, 0, 0],
  ['Em Produção', 'doing', 'lime', 0, 0, 0],
  ['Revisão', 'review', 'orange', 0, 0, 0],
  ['Aprovação', 'approval', 'purple', 0, 0, 1],
  ['Concluído', 'done', 'lime', 0, 1, 0],
] as const

const FINANCE_PERMISSIONS = [
  'employees.view', 'employees.create', 'employees.edit', 'employees.view_sensitive', 'employees.edit_sensitive',
  'employees.salary.view', 'employees.salary.edit', 'employees.documents.view', 'employees.documents.upload',
  'employees.documents.delete', 'employees.history.view', 'finance.view', 'finance.manage', 'mission_costs.view',
  'time_entries.view', 'reports.view',
] as const

function requiredText(value: string, label: string, max: number) {
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new Error(`${label} inválido`)
  return normalized
}

export function validatePilotBootstrapInput(input: Omit<PilotBootstrapInput, 'password'>): ValidatedPilotBootstrapInput {
  const organizationName = requiredText(input.organizationName, 'organization name', 120)
  const organizationSlug = requiredText(input.organizationSlug, 'organization slug', 120).toLocaleLowerCase('en-US')
  const adminName = requiredText(input.adminName, 'admin name', 120)
  const adminEmail = requiredText(input.adminEmail, 'admin email', 180).toLocaleLowerCase('en-US')
  const adminUsername = requiredText(input.adminUsername, 'admin username', 40).toLocaleLowerCase('en-US')
  if (!/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/.test(organizationSlug)) throw new Error('organization slug inválido')
  if (!/^\S+@\S+\.\S+$/.test(adminEmail)) throw new Error('admin email inválido')
  if (!/^[a-z0-9._-]{3,40}$/.test(adminUsername)) throw new Error('admin username inválido')
  return { organizationName, organizationSlug, adminName, adminEmail, adminUsername }
}

export function validatePilotPassword(password: string) {
  if (password.length < 12 || password.length > 256) throw new Error('password inválida')
}

export function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

export function createPilotBootstrapIds(): PilotBootstrapIds {
  return {
    organizationId: `org-pilot-${randomUUID()}`,
    adminUserId: `user-pilot-${randomUUID()}`,
    adminProfileId: `profile-pilot-admin-${randomUUID()}`,
  }
}

export function validateHistoricalSeedFingerprint(counts: HistoricalSeedCounts, identity: HistoricalSeedIdentity) {
  const failures: string[] = []
  for (const [table, expected] of Object.entries(HISTORICAL_SEED_COUNTS)) {
    if (counts[table as keyof HistoricalSeedCounts] !== expected) failures.push(`${table}: expected ${expected}`)
  }
  if (identity.organization !== 'org-six:agencia-six') failures.push('historical organization identity mismatch')
  if (identity.user !== 'user-agsix-admin:org-six:agsix') failures.push('historical user identity mismatch')
  if (identity.adminProfile !== 'profile-admin:org-six') failures.push('historical admin profile identity mismatch')
  return { ok: failures.length === 0, failures }
}

function historicalGuardSql() {
  const counts = Object.entries(HISTORICAL_SEED_COUNTS)
    .map(([table, expected]) => `(SELECT COUNT(*) FROM ${table}) = ${expected}`)
  counts.push("(SELECT COUNT(*) FROM organizations WHERE id = 'org-six' AND slug = 'agencia-six') = 1")
  counts.push("(SELECT COUNT(*) FROM users WHERE id = 'user-agsix-admin' AND organization_id = 'org-six' AND username = 'agsix') = 1")
  counts.push("(SELECT COUNT(*) FROM access_profiles WHERE id = 'profile-admin' AND organization_id = 'org-six' AND code = 'admin_tech') = 1")
  return `SELECT CASE WHEN ${counts.join(' AND ')} THEN 1 ELSE json_extract('PILOT_BOOTSTRAP_GUARD_FAILED', '$') END;`
}

export function buildPilotBootstrapSql(
  input: ValidatedPilotBootstrapInput,
  credential: PilotCredential,
  ids: PilotBootstrapIds = createPilotBootstrapIds(),
  options: { includeHistoricalCleanup?: boolean; injectFailure?: boolean } = {},
) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(credential.passwordSalt) || !/^[A-Za-z0-9+/]+={0,2}$/.test(credential.passwordHash) || credential.iterations < 100000) {
    throw new Error('credential inválida')
  }
  const profileIds = new Map<string, string>()
  for (const [code] of SYSTEM_PROFILES) profileIds.set(code, code === 'admin_tech' ? ids.adminProfileId : `profile-pilot-${code}-${randomUUID()}`)
  const boardId = `workflow-board-pilot-${randomUUID()}`
  const statements: string[] = []

  if (options.includeHistoricalCleanup) {
    statements.push(historicalGuardSql())
    for (const table of LEGACY_SEED_TABLES) statements.push(`DELETE FROM ${table};`)
  }

  statements.push(`INSERT INTO organizations (id, name, slug) VALUES (${sqlString(ids.organizationId)}, ${sqlString(input.organizationName)}, ${sqlString(input.organizationSlug)});`)
  statements.push(`INSERT INTO organization_settings (organization_id, xp_multiplier, level_config, rewards_config) VALUES (${sqlString(ids.organizationId)}, 1, NULL, NULL);`)

  for (const [code, name, description] of SYSTEM_PROFILES) {
    statements.push(`INSERT INTO access_profiles (id, organization_id, code, name, description, is_system, is_active) VALUES (${sqlString(profileIds.get(code)!)}, ${sqlString(ids.organizationId)}, ${sqlString(code)}, ${sqlString(name)}, ${sqlString(description)}, 1, 1);`)
  }
  statements.push(`INSERT INTO profile_permissions (profile_id, permission_code, scope) SELECT ${sqlString(ids.adminProfileId)}, code, 'all' FROM permissions;`)
  const roleToProfile = { management: 'operations_management', coordinator: 'coordinator', service: 'service', specialist: 'specialist' } as const
  for (const [role, profileCode] of Object.entries(roleToProfile)) {
    statements.push(`INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope) SELECT ${sqlString(profileIds.get(profileCode)!)}, permission, 'all' FROM role_permissions WHERE role_code = ${sqlString(role)};`)
  }
  statements.push(`INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope) SELECT ${sqlString(profileIds.get('finance')!)}, code, 'all' FROM permissions WHERE code IN (${FINANCE_PERMISSIONS.map(sqlString).join(', ')});`)

  for (const [code, name, description] of DEPARTMENTS) {
    statements.push(`INSERT INTO departments (id, organization_id, code, name, description, is_active) VALUES (${sqlString(`dept-pilot-${code}-${randomUUID()}`)}, ${sqlString(ids.organizationId)}, ${sqlString(code)}, ${sqlString(name)}, ${sqlString(description)}, 1);`)
  }
  for (const [normalizedName, name, minutes, color] of WORK_TYPES) {
    statements.push(`INSERT INTO work_types (id, organization_id, name, normalized_name, default_minutes, color_key, is_active) VALUES (${sqlString(`work-type-pilot-${randomUUID()}`)}, ${sqlString(ids.organizationId)}, ${sqlString(name)}, ${sqlString(normalizedName)}, ${minutes}, ${sqlString(color)}, 1);`)
  }
  statements.push(`INSERT INTO workflow_boards (id, organization_id, name, slug, is_default) VALUES (${sqlString(boardId)}, ${sqlString(ids.organizationId)}, 'Fluxo de Missões', 'missoes', 1);`)
  for (const [position, [name, type, color, initial, final, approval]] of WORKFLOW_STAGES.entries()) {
    statements.push(`INSERT INTO workflow_stages (id, board_id, name, position, type, color, is_initial, is_final, requires_approval) VALUES (${sqlString(`workflow-stage-pilot-${randomUUID()}`)}, ${sqlString(boardId)}, ${sqlString(name)}, ${position}, ${sqlString(type)}, ${sqlString(color)}, ${initial}, ${final}, ${approval});`)
  }
  statements.push(`INSERT INTO xp_rules (id, organization_id, name, description, base_xp, recipient_mode, on_time_bonus_percent, is_active, version, created_by_user_id) VALUES (${sqlString(`xp-rule-pilot-${randomUUID()}`)}, ${sqlString(ids.organizationId)}, 'Entrega de missão', 'Regra padrão para missões aprovadas.', 80, 'responsible', 20, 1, 1, NULL);`)
  if (options.injectFailure) statements.push('SELECT * FROM "injected pilot bootstrap failure";')
  statements.push(`INSERT INTO users (id, organization_id, name, email, username, role, access_profile_id, status) VALUES (${sqlString(ids.adminUserId)}, ${sqlString(ids.organizationId)}, ${sqlString(input.adminName)}, ${sqlString(input.adminEmail)}, ${sqlString(input.adminUsername)}, 'admin', ${sqlString(ids.adminProfileId)}, 'active');`)
  statements.push(`INSERT INTO user_credentials (user_id, password_salt, password_hash, iterations) VALUES (${sqlString(ids.adminUserId)}, ${sqlString(credential.passwordSalt)}, ${sqlString(credential.passwordHash)}, ${credential.iterations});`)
  statements.push(`INSERT INTO user_role_assignments (user_id, role_code, is_primary) VALUES (${sqlString(ids.adminUserId)}, 'admin', 1);`)
  statements.push(`INSERT INTO gamification_profiles (user_id, xp, ideas, level, streak_days) VALUES (${sqlString(ids.adminUserId)}, 0, 0, 'Criador', 0);`)
  return { sql: `${statements.join('\n')}\n`, ids }
}
