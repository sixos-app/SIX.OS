import type { LocalSqliteDatabase } from './pilot-bootstrap'

export type CleanVerification = { ok: boolean; failures: string[]; counts: Record<string, number> }

const REQUIRED_COUNTS: Record<string, number> = {
  organizations: 1, organization_settings: 1, users: 1, user_credentials: 1, auth_sessions: 0, employees: 0,
  clients: 0, client_contacts: 0, contracts: 0, projects: 0, missions: 0, mission_history: 0, time_entries: 0,
  calendar_events: 0, invoices: 0, cost_centers: 0, external_integrations: 0, xp_events: 0, xp_awards: 0,
  gamification_profiles: 1, access_profiles: 6, departments: 6, work_types: 6, workflow_boards: 1, workflow_stages: 6, xp_rules: 1,
}

function count(database: LocalSqliteDatabase, table: string) {
  return Number((database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count)
}

export function verifyPilotCleanState(database: LocalSqliteDatabase): CleanVerification {
  const failures: string[] = []
  const counts: Record<string, number> = {}
  for (const [table, expected] of Object.entries(REQUIRED_COUNTS)) {
    counts[table] = count(database, table)
    if (counts[table] !== expected) failures.push(`${table}: expected ${expected}, got ${counts[table]}`)
  }
  const migrationCount = count(database, 'd1_migrations')
  counts.d1_migrations = migrationCount
  if (migrationCount !== 50) failures.push(`d1_migrations: expected 50, got ${migrationCount}`)
  const profile = database.prepare('SELECT xp, level FROM gamification_profiles LIMIT 1').get() as { xp: number; level: string } | undefined
  if (!profile || profile.xp !== 0 || profile.level !== 'Criador') failures.push('gamification profile is not initial Criador / XP 0')
  const admin = database.prepare("SELECT id FROM access_profiles WHERE code = 'admin_tech' AND is_active = 1 LIMIT 1").get() as { id: string } | undefined
  const catalog = count(database, 'permissions')
  const adminPermissionCount = admin ? Number((database.prepare('SELECT COUNT(*) AS count FROM profile_permissions WHERE profile_id = ? AND scope = ?').get(admin.id, 'all') as { count: number }).count) : 0
  counts.permissions = catalog
  counts.admin_permissions = adminPermissionCount
  if (!admin || adminPermissionCount !== catalog) failures.push(`admin permissions: expected ${catalog}, got ${adminPermissionCount}`)
  const contractsManage = admin ? database.prepare("SELECT 1 AS present FROM profile_permissions WHERE profile_id = ? AND permission_code = 'contracts.manage' AND scope = 'all'").get(admin.id) : undefined
  if (!contractsManage) failures.push('contracts.manage missing from admin_tech')
  const legacyChecks = [
    ['organizations', "SELECT COUNT(*) AS count FROM organizations WHERE id = 'org-six'"],
    ['users', "SELECT COUNT(*) AS count FROM users WHERE organization_id = 'org-six'"],
    ['clients', "SELECT COUNT(*) AS count FROM clients WHERE organization_id = 'org-six'"],
    ['projects', "SELECT COUNT(*) AS count FROM projects WHERE organization_id = 'org-six'"],
    ['missions', "SELECT COUNT(*) AS count FROM missions JOIN projects ON projects.id = missions.project_id WHERE projects.organization_id = 'org-six'"],
  ] as const
  for (const [table, sql] of legacyChecks) {
    const legacy = Number((database.prepare(sql).get() as { count: number }).count)
    if (legacy !== 0) failures.push(`${table}: legacy org-six reference remains`)
  }
  return { ok: failures.length === 0, failures, counts }
}
