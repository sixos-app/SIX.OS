import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { hashPassword } from '../functions/api/_access'
import { getLevelFromXp } from '../shared/gamificationLevels'
import { assertPilotTarget, PILOT_RESOURCE_NAMES } from './pilot-safety'

export type LocalSqliteDatabase = {
  exec(sql: string): void
  prepare(sql: string): { run(...values: unknown[]): unknown; get(...values: unknown[]): unknown }
}

export type PilotBootstrapInput = {
  organizationName: string
  organizationSlug: string
  adminName: string
  adminEmail: string
  adminUsername: string
  password: string
}

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
  ['design / peca', 'Design / Peça', 120, 'lime'], ['redacao / conteudo', 'Redação / Conteúdo', 90, 'purple'],
  ['planejamento / estrategia', 'Planejamento / Estratégia', 180, 'blue'], ['video / motion', 'Vídeo / Motion', 240, 'orange'],
  ['social media / post', 'Social Media / Post', 60, 'cyan'], ['atendimento / alinhamento', 'Atendimento / Alinhamento', 60, 'pink'],
] as const

const WORKFLOW_STAGES = [
  ['Entrada', 'backlog', 'neutral', 0, 0, 0], ['A Fazer', 'ready', 'purple', 1, 0, 0], ['Em Produção', 'doing', 'lime', 0, 0, 0],
  ['Revisão', 'review', 'orange', 0, 0, 0], ['Aprovação', 'approval', 'purple', 0, 0, 1], ['Concluído', 'done', 'lime', 0, 1, 0],
] as const

function text(value: string, label: string, max: number) {
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new Error(`${label} inválido`)
  return normalized
}

function slug(value: string) {
  const normalized = text(value, 'organization slug', 120).toLocaleLowerCase('en-US')
  if (!/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)) throw new Error('organization slug inválido')
  return normalized
}

function email(value: string) {
  const normalized = text(value, 'admin email', 180).toLocaleLowerCase('en-US')
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error('admin email inválido')
  return normalized
}

function username(value: string) {
  const normalized = text(value, 'admin username', 40).toLocaleLowerCase('en-US')
  if (!/^[a-z0-9._-]{3,40}$/.test(normalized)) throw new Error('admin username inválido')
  return normalized
}

function count(database: LocalSqliteDatabase, table: string) {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }
  return Number(row.count)
}

const HISTORICAL_SEED_COUNTS = Object.freeze({
  d1_migrations: 50, organizations: 1, teams: 1, users: 1, user_credentials: 0, auth_sessions: 0,
  clients: 0, projects: 0, missions: 0, employees: 1, gamification_profiles: 1,
  access_profiles: 6, profile_permissions: 187, departments: 6, work_types: 6,
  workflow_boards: 1, workflow_stages: 6, xp_rules: 1,
})

/**
 * Cleanup is intentionally limited to the exact known output of migrations
 * 0001–0049. It is not a generic tenant reset and must reject real tenant data.
 */
export function assertHistoricalSeedFingerprint(database: LocalSqliteDatabase) {
  for (const [table, expected] of Object.entries(HISTORICAL_SEED_COUNTS)) {
    if (count(database, table) !== expected) throw new Error(`PILOT CLEANUP ABORT: historical seed fingerprint mismatch at ${table}`)
  }
  const organization = database.prepare('SELECT id, slug FROM organizations LIMIT 2').get() as { id: string; slug: string } | undefined
  const user = database.prepare('SELECT id, organization_id AS organizationId, username FROM users LIMIT 2').get() as { id: string; organizationId: string; username: string | null } | undefined
  const adminProfile = database.prepare("SELECT id, organization_id AS organizationId FROM access_profiles WHERE code = 'admin_tech' LIMIT 2").get() as { id: string; organizationId: string } | undefined
  if (organization?.id !== 'org-six' || organization.slug !== 'agencia-six'
    || user?.id !== 'user-agsix-admin' || user.organizationId !== 'org-six' || user.username !== 'agsix'
    || adminProfile?.id !== 'profile-admin' || adminProfile.organizationId !== 'org-six') {
    throw new Error('PILOT CLEANUP ABORT: historical seed identity mismatch')
  }
}

export function assertBootstrapAvailable(database: LocalSqliteDatabase) {
  const state = ['organizations', 'users', 'user_credentials', 'auth_sessions'].map((table) => [table, count(database, table)] as const)
  if (state.some(([, value]) => value !== 0)) throw new Error('PILOT BOOTSTRAP ABORT: target is not an empty tenant state')
}

export function cleanupHistoricalSeeds(database: LocalSqliteDatabase) {
  assertHistoricalSeedFingerprint(database)
  database.exec('BEGIN')
  try {
    for (const table of LEGACY_SEED_TABLES) database.exec(`DELETE FROM ${table}`)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export async function bootstrapPilot(database: LocalSqliteDatabase, input: PilotBootstrapInput, options: { injectFailure?: boolean } = {}) {
  const organizationName = text(input.organizationName, 'organization name', 120)
  const organizationSlug = slug(input.organizationSlug)
  const adminName = text(input.adminName, 'admin name', 120)
  const adminEmail = email(input.adminEmail)
  const adminUsername = username(input.adminUsername)
  if (input.password.length < 12 || input.password.length > 256) throw new Error('password inválida')
  assertBootstrapAvailable(database)
  const credential = await hashPassword(input.password)
  const organizationId = `org-pilot-${randomUUID()}`
  const adminProfileId = `profile-pilot-admin-${randomUUID()}`
  const adminUserId = `user-pilot-${randomUUID()}`

  database.exec('BEGIN')
  try {
    database.prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)').run(organizationId, organizationName, organizationSlug)
    database.prepare('INSERT INTO organization_settings (organization_id, xp_multiplier, level_config, rewards_config) VALUES (?, 1, NULL, NULL)').run(organizationId)

    const profileIds = new Map<string, string>()
    for (const [code, name, description] of SYSTEM_PROFILES) {
      const id = code === 'admin_tech' ? adminProfileId : `profile-pilot-${code}-${randomUUID()}`
      profileIds.set(code, id)
      database.prepare('INSERT INTO access_profiles (id, organization_id, code, name, description, is_system, is_active) VALUES (?, ?, ?, ?, ?, 1, 1)').run(id, organizationId, code, name, description)
    }

    const permissions = (database.prepare('SELECT code FROM permissions ORDER BY code') as unknown as { all(): Array<{ code: string }> }).all()
    for (const permission of permissions) database.prepare('INSERT INTO profile_permissions (profile_id, permission_code, scope) VALUES (?, ?, ?)').run(adminProfileId, permission.code, 'all')

    const rolePermissions = (database.prepare('SELECT role_code AS roleCode, permission FROM role_permissions') as unknown as { all(): Array<{ roleCode: string; permission: string }> }).all()
    const profileCodeByRole: Record<string, string> = { management: 'operations_management', coordinator: 'coordinator', service: 'service', specialist: 'specialist' }
    for (const permission of rolePermissions) {
      const profileId = profileIds.get(profileCodeByRole[permission.roleCode] ?? '')
      if (profileId) database.prepare('INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope) VALUES (?, ?, ?)').run(profileId, permission.permission, 'all')
    }
    const financePermissions = ['employees.view', 'employees.create', 'employees.edit', 'employees.view_sensitive', 'employees.edit_sensitive', 'employees.salary.view', 'employees.salary.edit', 'employees.documents.view', 'employees.documents.upload', 'employees.documents.delete', 'employees.history.view', 'finance.view', 'finance.manage', 'mission_costs.view', 'time_entries.view', 'reports.view']
    for (const permission of financePermissions) database.prepare('INSERT OR IGNORE INTO profile_permissions (profile_id, permission_code, scope) SELECT ?, code, ? FROM permissions WHERE code = ?').run(profileIds.get('finance'), 'all', permission)

    for (const [code, name, description] of DEPARTMENTS) database.prepare('INSERT INTO departments (id, organization_id, code, name, description, is_active) VALUES (?, ?, ?, ?, ?, 1)').run(`dept-pilot-${code}-${randomUUID()}`, organizationId, code, name, description)
    for (const [normalizedName, name, minutes, color] of WORK_TYPES) database.prepare('INSERT INTO work_types (id, organization_id, name, normalized_name, default_minutes, color_key, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)').run(`work-type-pilot-${randomUUID()}`, organizationId, name, normalizedName, minutes, color)

    const boardId = `workflow-board-pilot-${randomUUID()}`
    database.prepare('INSERT INTO workflow_boards (id, organization_id, name, slug, is_default) VALUES (?, ?, ?, ?, 1)').run(boardId, organizationId, 'Fluxo de Missões', 'missoes')
    for (const [name, type, color, initial, final, approval] of WORKFLOW_STAGES) database.prepare('INSERT INTO workflow_stages (id, board_id, name, position, type, color, is_initial, is_final, requires_approval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`workflow-stage-pilot-${randomUUID()}`, boardId, name, WORKFLOW_STAGES.findIndex((stage) => stage[0] === name), type, color, initial, final, approval)

    const ruleId = `xp-rule-pilot-${randomUUID()}`
    database.prepare('INSERT INTO xp_rules (id, organization_id, name, description, base_xp, recipient_mode, on_time_bonus_percent, is_active, version, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, NULL)').run(ruleId, organizationId, 'Entrega de missão', 'Regra padrão para missões aprovadas.', 80, 'responsible', 20)

    if (options.injectFailure) throw new Error('injected pilot bootstrap failure')
    database.prepare('INSERT INTO users (id, organization_id, name, email, username, role, access_profile_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(adminUserId, organizationId, adminName, adminEmail, adminUsername, 'admin', adminProfileId, 'active')
    database.prepare('INSERT INTO user_credentials (user_id, password_salt, password_hash, iterations) VALUES (?, ?, ?, ?)').run(adminUserId, credential.passwordSalt, credential.passwordHash, credential.iterations)
    database.prepare('INSERT INTO user_role_assignments (user_id, role_code, is_primary) VALUES (?, ?, 1)').run(adminUserId, 'admin')
    database.prepare('INSERT INTO gamification_profiles (user_id, xp, ideas, level, streak_days) VALUES (?, 0, 0, ?, 0)').run(adminUserId, getLevelFromXp(0).name)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return { organizationId, adminUserId, adminProfileId }
}

if (import.meta.main) {
  const values = new Map(process.argv.slice(2).map((argument) => {
    const [key, ...rest] = argument.split('=')
    return [key, rest.join('=')]
  }))
  const localDatabasePath = values.get('--local-db')
  const required = ['--organization-name', '--organization-slug', '--admin-name', '--admin-email', '--admin-username']
  if (!localDatabasePath || !values.has('--confirm-local') || required.some((key) => !values.get(key))) {
    console.error('Usage: tsx scripts/pilot-bootstrap.ts --local-db=/absolute/disposable.sqlite --confirm-local --organization-name=... --organization-slug=... --admin-name=... --admin-email=... --admin-username=...')
    process.exitCode = 1
  } else if (process.argv.some((argument) => argument.startsWith('--password'))) {
    console.error('PILOT SAFETY ABORT: password arguments are not accepted')
    process.exitCode = 1
  } else if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('PILOT SAFETY ABORT: an interactive terminal is required for password input')
    process.exitCode = 1
  } else {
    const readPassword = () => new Promise<string>((resolve, reject) => {
      let password = ''
      const stdin = process.stdin
      stdin.setRawMode(true)
      stdin.resume()
      process.stdout.write('Pilot administrator password: ')
      const onData = (chunk: Buffer) => {
        const value = new TextDecoder().decode(chunk)
        if (value === '\u0003') {
          finish(new Error('password input cancelled'))
        } else if (value === '\r' || value === '\n') {
          finish(null, password)
        } else if (value === '\u007f') {
          password = password.slice(0, -1)
        } else if (!value.includes('\u001b')) {
          password += value
        }
      }
      const finish = (error: Error | null, value?: string) => {
        stdin.off('data', onData)
        stdin.setRawMode(false)
        stdin.pause()
        process.stdout.write('\n')
        if (error) reject(error)
        else resolve(value ?? '')
      }
      stdin.on('data', onData)
    })

    try {
      assertPilotTarget({ ...PILOT_RESOURCE_NAMES, mode: 'local', confirmed: true })
      const password = await readPassword()
      const database = new DatabaseSync(localDatabasePath) as unknown as LocalSqliteDatabase
      cleanupHistoricalSeeds(database)
      await bootstrapPilot(database, {
        organizationName: values.get('--organization-name')!,
        organizationSlug: values.get('--organization-slug')!,
        adminName: values.get('--admin-name')!,
        adminEmail: values.get('--admin-email')!,
        adminUsername: values.get('--admin-username')!,
        password,
      })
      console.log('Pilot local bootstrap complete.')
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'PILOT BOOTSTRAP ABORT')
      process.exitCode = 1
    }
  }
}
