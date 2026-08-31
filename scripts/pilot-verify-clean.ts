import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { LocalSqliteDatabase } from './pilot-bootstrap'
import { parseWranglerJson, readRemoteHistoricalSeed, validateRemoteMigrationState } from './pilot-remote-bootstrap'
import { validateHistoricalSeedFingerprint } from './pilot-bootstrap-operation'
import {
  PILOT_CONFIG_FILE,
  PILOT_IDENTITY,
  validatePilotAccount,
  validatePilotConfig,
  validatePilotRemoteSnapshot,
} from './pilot-targeting'
import { readPilotRemoteSnapshot } from './pilot-preflight'

export type CleanVerification = { ok: boolean; failures: string[]; counts: Record<string, number> }

export const REQUIRED_CLEAN_COUNTS = Object.freeze({
  organizations: 1,
  organization_settings: 1,
  users: 1,
  user_credentials: 1,
  auth_sessions: 0,
  employees: 0,
  clients: 0,
  client_contacts: 0,
  projects: 0,
  missions: 0,
  mission_history: 0,
  mission_stage_history: 0,
  mission_workflow_steps: 0,
  time_entries: 0,
  calendar_events: 0,
  contracts: 0,
  invoices: 0,
  cost_centers: 0,
  external_integrations: 0,
  client_library_files: 0,
  client_library_file_versions: 0,
  client_library_folders: 0,
  project_library_files: 0,
  project_library_file_versions: 0,
  project_library_folders: 0,
  employee_library_files: 0,
  employee_library_file_versions: 0,
  employee_library_folders: 0,
  gamification_profiles: 1,
  xp_events: 0,
  xp_awards: 0,
  access_profiles: 6,
  departments: 6,
  work_types: 6,
  workflow_boards: 1,
  workflow_stages: 6,
  xp_rules: 1,
  d1_migrations: 50,
})

const countColumns = Object.keys(REQUIRED_CLEAN_COUNTS)
  .map((table) => `(SELECT COUNT(*) FROM ${table}) AS ${table}`)

export const PILOT_CLEAN_VERIFY_SQL = `SELECT
  ${countColumns.join(',\n  ')},
  (SELECT GROUP_CONCAT(name, '|') FROM (SELECT name FROM d1_migrations ORDER BY id)) AS migrationNames,
  (SELECT COUNT(*) FROM permissions) AS permission_catalog,
  (SELECT COUNT(*) FROM profile_permissions pp JOIN access_profiles ap ON ap.id = pp.profile_id WHERE ap.code = 'admin_tech' AND ap.is_active = 1) AS admin_grants,
  (SELECT COUNT(*) FROM permissions p WHERE NOT EXISTS (
    SELECT 1 FROM profile_permissions pp JOIN access_profiles ap ON ap.id = pp.profile_id
    WHERE ap.code = 'admin_tech' AND ap.is_active = 1 AND pp.permission_code = p.code AND pp.scope = 'all'
  )) AS admin_missing,
  (SELECT COUNT(*) FROM profile_permissions pp JOIN access_profiles ap ON ap.id = pp.profile_id
    WHERE ap.code = 'admin_tech' AND ap.is_active = 1
      AND (pp.scope <> 'all' OR NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = pp.permission_code))) AS admin_invalid_extra,
  (SELECT COUNT(*) FROM profile_permissions pp JOIN access_profiles ap ON ap.id = pp.profile_id
    WHERE ap.code = 'admin_tech' AND ap.is_active = 1 AND pp.permission_code = 'contracts.manage' AND pp.scope = 'all') AS contracts_manage_present,
  (SELECT COUNT(*) FROM users u JOIN access_profiles ap ON ap.id = u.access_profile_id
    WHERE u.role = 'admin' AND u.status = 'active' AND ap.code = 'admin_tech' AND ap.organization_id = u.organization_id AND ap.is_active = 1) AS admin_profile_resolution,
  (SELECT COUNT(*) FROM users u JOIN user_role_assignments ura ON ura.user_id = u.id
    WHERE u.role = 'admin' AND ura.role_code = 'admin' AND ura.is_primary = 1) AS admin_role_resolution,
  (SELECT COUNT(*) FROM gamification_profiles WHERE xp = 0 AND level = 'Criador') AS initial_gamification_profile,
  (SELECT COUNT(*) FROM organizations WHERE id = 'org-six' OR slug = 'agencia-six') AS legacy_organization,
  (SELECT COUNT(*) FROM users WHERE id = 'user-agsix-admin' OR organization_id = 'org-six' OR username = 'agsix') AS legacy_user,
  (SELECT COUNT(*) FROM employees WHERE id = 'emp-user-agsix-admin' OR organization_id = 'org-six') AS legacy_employee,
  (SELECT COUNT(*) FROM employee_library_folders WHERE id LIKE 'folder-emp-user-agsix-admin-%') AS legacy_nine_folders`

export function expectedCleanMigrationNames(root = process.cwd()) {
  return readdirSync(resolve(root, PILOT_IDENTITY.migrationsDir)).filter((file) => file.endsWith('.sql')).sort()
}

export function verifyPilotCleanSnapshot(row: Record<string, unknown>, migrationNames = expectedCleanMigrationNames()): CleanVerification {
  const failures: string[] = []
  const counts: Record<string, number> = {}
  for (const [table, expected] of Object.entries(REQUIRED_CLEAN_COUNTS)) {
    counts[table] = Number(row[table])
    if (counts[table] !== expected) failures.push(`${table}: expected ${expected}, got ${counts[table]}`)
  }
  const migrationState = String(row.migrationNames ?? '').split('|').filter(Boolean)
  if (migrationState.join('|') !== migrationNames.join('|')) failures.push('d1_migrations: pending or divergent migration names')

  const permissionCatalog = Number(row.permission_catalog)
  const adminGrants = Number(row.admin_grants)
  const adminMissing = Number(row.admin_missing)
  const adminInvalidExtra = Number(row.admin_invalid_extra)
  counts.permissions = permissionCatalog
  counts.admin_permissions = adminGrants
  counts.admin_missing = adminMissing
  counts.admin_invalid_extra = adminInvalidExtra
  if (permissionCatalog < 1 || adminGrants !== permissionCatalog || adminMissing !== 0 || adminInvalidExtra !== 0) {
    failures.push(`admin permissions: catalog ${permissionCatalog}, grants ${adminGrants}, missing ${adminMissing}, invalid extra ${adminInvalidExtra}`)
  }
  if (Number(row.contracts_manage_present) !== 1) failures.push('contracts.manage missing from admin_tech with all scope')
  if (Number(row.admin_profile_resolution) !== 1 || Number(row.admin_role_resolution) !== 1) failures.push('admin does not resolve through normal profile_permissions / role scopes')
  if (Number(row.initial_gamification_profile) !== 1) failures.push('gamification profile is not initial Criador / XP 0')
  if (Number(row.legacy_organization) !== 0) failures.push('legacy org-six / agencia-six organization remains')
  if (Number(row.legacy_user) !== 0) failures.push('legacy or demo user remains')
  if (Number(row.legacy_employee) !== 0) failures.push('historical employee remains')
  if (Number(row.legacy_nine_folders) !== 0) failures.push('historical 9 employee-library folders remain')
  return { ok: failures.length === 0, failures, counts }
}

export function verifyPilotCleanState(database: LocalSqliteDatabase, migrationNames = expectedCleanMigrationNames()): CleanVerification {
  const row = database.prepare(PILOT_CLEAN_VERIFY_SQL).get() as Record<string, unknown> | undefined
  if (!row) return { ok: false, failures: ['clean verification query returned no row'], counts: {} }
  return verifyPilotCleanSnapshot(row, migrationNames)
}

export function readRemotePilotCleanSnapshot(root: string) {
  const output = execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', PILOT_IDENTITY.d1Name, '--remote', '--config', PILOT_CONFIG_FILE, '--command', PILOT_CLEAN_VERIFY_SQL, '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: PILOT_IDENTITY.accountId },
  })
  const response = parseWranglerJson(output)[0]
  const row = response?.results?.[0]
  if (!row || response.meta?.rows_written !== 0 || response.meta?.changed_db) throw new Error('PILOT VERIFY ABORT: remote clean verification was not read-only')
  return row
}

export async function assertRemoteVerifyTarget(root: string, token: string) {
  const account = validatePilotAccount(process.env.CLOUDFLARE_ACCOUNT_ID)
  const config = validatePilotConfig(readFileSync(resolve(root, PILOT_CONFIG_FILE), 'utf8'))
  if (!account.ok || !config.ok) throw new Error(`PILOT VERIFY ABORT: ${[...account.failures, ...config.failures].join('; ')}`)
  const snapshot = await readPilotRemoteSnapshot(token, root)
  const target = validatePilotRemoteSnapshot(snapshot)
  if (!target.ok) throw new Error(`PILOT VERIFY ABORT: ${target.failures.join('; ')}`)
  return snapshot
}

export async function verifyRemotePilotClean(root: string, token: string) {
  await assertRemoteVerifyTarget(root, token)
  const row = readRemotePilotCleanSnapshot(root)
  return verifyPilotCleanSnapshot(row, expectedCleanMigrationNames(root))
}

async function main() {
  if (!process.argv.includes('--remote-pilot')) throw new Error('PILOT VERIFY ABORT: explicit --remote-pilot is required')
  const expectHistorical = process.argv.includes('--expect-historical')
  const expectClean = process.argv.includes('--expect-clean')
  if (expectHistorical === expectClean) throw new Error('PILOT VERIFY ABORT: choose exactly one of --expect-historical or --expect-clean')
  const root = process.cwd()
  if (expectHistorical) {
    await assertRemoteVerifyTarget(root, process.env.CLOUDFLARE_API_TOKEN ?? '')
    const historical = readRemoteHistoricalSeed(root)
    const fingerprint = validateHistoricalSeedFingerprint(historical.counts, historical.identity)
    const migrations = validateRemoteMigrationState(root, historical.migrationNames)
    console.log(JSON.stringify({ mode: 'historical fingerprint', readOnly: true, fingerprint, migrations, counts: historical.counts, identity: historical.identity }, null, 2))
    if (!fingerprint.ok || !migrations.ok) process.exitCode = 1
    return
  }
  const result = await verifyRemotePilotClean(root, process.env.CLOUDFLARE_API_TOKEN ?? '')
  console.log(JSON.stringify({ mode: 'clean pilot verification', readOnly: true, ...result }, null, 2))
  if (!result.ok) process.exitCode = 1
}

if (import.meta.main) await main()
