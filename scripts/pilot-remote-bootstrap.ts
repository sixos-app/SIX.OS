import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  PILOT_CONFIG_FILE,
  PILOT_IDENTITY,
  type PilotGitState,
  validatePilotAccount,
  validatePilotConfig,
  validatePilotGitState,
} from './pilot-targeting'
import { readPilotGitState } from './pilot-preflight'

export const REMOTE_BOOTSTRAP_CONFIRMATION = `BOOTSTRAP ${PILOT_IDENTITY.d1Name} ${PILOT_IDENTITY.d1Id}`

export const HISTORICAL_SEED_COUNTS = Object.freeze({
  d1_migrations: 50, organizations: 1, users: 1, user_credentials: 0, auth_sessions: 0,
  permissions: 67, role_definitions: 5, role_permissions: 50, access_profiles: 6, profile_permissions: 187,
  organization_settings: 1, departments: 6, work_types: 6, workflow_boards: 1, workflow_stages: 6, xp_rules: 1,
  gamification_profiles: 1, xp_events: 0, xp_awards: 0, employees: 1, clients: 0, projects: 0, missions: 0,
  mission_history: 0, time_entries: 0, calendar_events: 0, contracts: 0, invoices: 0, cost_centers: 0,
  client_library_files: 0, client_library_folders: 0, project_library_files: 0, project_library_folders: 0,
  employee_library_files: 0, employee_library_folders: 9,
})

export type HistoricalSeedCounts = Record<keyof typeof HISTORICAL_SEED_COUNTS, number>
export type HistoricalSeedIdentity = { organization: string; user: string; adminProfile: string }
export type RemoteBootstrapIntent = {
  accountId?: string
  d1Name: string
  d1Id: string
  branch: string
  expectedHead: string
  remoteHead: string
  confirmation: string
  git: PilotGitState
}

export type RemoteBootstrapPlan = {
  target: 'PILOT'
  fingerprint: 'PASS'
  wouldRemove: readonly string[]
  wouldPreserve: readonly string[]
  wouldCreate: readonly string[]
  actualWrites: 0
}

const countSql = Object.keys(HISTORICAL_SEED_COUNTS)
  .map((table) => `(SELECT COUNT(*) FROM ${table}) AS ${table}`)
  .join(', ')

const FINGERPRINT_SQL = `SELECT ${countSql},
  (SELECT id || ':' || slug FROM organizations LIMIT 1) AS organization,
  (SELECT id || ':' || organization_id || ':' || username FROM users LIMIT 1) AS user,
  (SELECT id || ':' || organization_id FROM access_profiles WHERE code = 'admin_tech' LIMIT 1) AS adminProfile`

function fullSha(value: string) {
  return /^[0-9a-f]{40}$/i.test(value)
}

export function validateRemoteBootstrapIntent(intent: RemoteBootstrapIntent) {
  const failures: string[] = []
  const account = validatePilotAccount(intent.accountId)
  failures.push(...account.failures)
  if (intent.d1Name !== PILOT_IDENTITY.d1Name) failures.push('pilot D1 name mismatch')
  if (intent.d1Id !== PILOT_IDENTITY.d1Id) failures.push('pilot D1 UUID mismatch')
  if (intent.branch !== PILOT_IDENTITY.branch) failures.push('pilot branch mismatch')
  if (!fullSha(intent.expectedHead)) failures.push('EXPECTED_HEAD must be a full Git SHA')
  else {
    failures.push(...validatePilotGitState(intent.git, intent.expectedHead).failures)
    if (intent.remoteHead !== intent.expectedHead) failures.push('remote feature HEAD must equal EXPECTED_HEAD')
  }
  if (intent.confirmation !== REMOTE_BOOTSTRAP_CONFIRMATION) failures.push('destructive pilot confirmation mismatch')
  return { ok: failures.length === 0, failures }
}

export function validateHistoricalSeedFingerprint(counts: HistoricalSeedCounts, identity: HistoricalSeedIdentity) {
  const failures: string[] = []
  for (const [table, expected] of Object.entries(HISTORICAL_SEED_COUNTS)) {
    if (counts[table as keyof typeof HISTORICAL_SEED_COUNTS] !== expected) failures.push(`${table}: expected ${expected}`)
  }
  if (identity.organization !== 'org-six:agencia-six') failures.push('historical organization identity mismatch')
  if (identity.user !== 'user-agsix-admin:org-six:agsix') failures.push('historical user identity mismatch')
  if (identity.adminProfile !== 'profile-admin:org-six') failures.push('historical admin profile identity mismatch')
  return { ok: failures.length === 0, failures }
}

export function createRemoteBootstrapPlan(): RemoteBootstrapPlan {
  return {
    target: 'PILOT',
    fingerprint: 'PASS',
    wouldRemove: ['historical tenant org-six and exact LEGACY_SEED_TABLES allowlist, including 1 employee and 9 employee-library folders'],
    wouldPreserve: ['d1_migrations', 'permissions', 'role_definitions', 'role_permissions', 'D1 internal infrastructure'],
    wouldCreate: ['1 supplied pilot organization', '1 supplied first admin', 'credential via hashPassword', 'dynamic admin grants from current permission catalog', '1 gamification profile at XP 0 / Criador'],
    actualWrites: 0,
  }
}

function valueArgument(name: string) {
  const prefix = `${name}=`
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ''
}

function remoteFeatureHead(root: string) {
  return execFileSync('git', ['ls-remote', '--heads', 'origin', PILOT_IDENTITY.branch], { cwd: root, encoding: 'utf8' }).trim().split(/\s+/)[0] ?? ''
}

function parseWranglerJson(output: string) {
  const start = output.indexOf('[')
  const end = output.lastIndexOf(']')
  if (start < 0 || end < start) throw new Error('PILOT REMOTE ABORT: D1 read-only output was not JSON')
  return JSON.parse(output.slice(start, end + 1)) as Array<{ results?: Array<Record<string, unknown>>; meta?: { rows_written?: number; changed_db?: boolean } }>
}

export function readRemoteHistoricalSeed(root: string) {
  const output = execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', PILOT_IDENTITY.d1Name, '--remote', '--config', PILOT_CONFIG_FILE, '--command', FINGERPRINT_SQL, '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: PILOT_IDENTITY.accountId },
  })
  const parsed = parseWranglerJson(output)
  const response = parsed[0]
  const row = response?.results?.[0]
  if (!row || response.meta?.rows_written !== 0 || response.meta?.changed_db) throw new Error('PILOT REMOTE ABORT: fingerprint query was not read-only')
  const counts = Object.fromEntries(Object.keys(HISTORICAL_SEED_COUNTS).map((key) => [key, Number(row[key])])) as HistoricalSeedCounts
  const identity = {
    organization: String(row.organization ?? ''),
    user: String(row.user ?? ''),
    adminProfile: String(row.adminProfile ?? ''),
  }
  return { counts, identity }
}

async function main() {
  if (process.argv.some((argument) => argument.startsWith('--password'))) throw new Error('PILOT REMOTE ABORT: password arguments are not accepted')
  if (!process.argv.includes('--remote-pilot') || !process.argv.includes('--dry-run')) {
    throw new Error('PILOT REMOTE ABORT: only --remote-pilot --dry-run is enabled in PILOT-1D-B0')
  }
  const root = process.cwd()
  const config = validatePilotConfig(readFileSync(resolve(root, PILOT_CONFIG_FILE), 'utf8'))
  if (!config.ok) throw new Error(`PILOT REMOTE ABORT: ${config.failures.join('; ')}`)
  const intent = validateRemoteBootstrapIntent({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    d1Name: valueArgument('--d1-name'),
    d1Id: valueArgument('--d1-id'),
    branch: valueArgument('--branch'),
    expectedHead: valueArgument('--expected-head') || process.env.EXPECTED_HEAD || '',
    remoteHead: remoteFeatureHead(root),
    confirmation: valueArgument('--confirm'),
    git: readPilotGitState(root),
  })
  if (!intent.ok) throw new Error(`PILOT REMOTE ABORT: ${intent.failures.join('; ')}`)
  const historical = readRemoteHistoricalSeed(root)
  const fingerprint = validateHistoricalSeedFingerprint(historical.counts, historical.identity)
  if (!fingerprint.ok) throw new Error(`PILOT REMOTE ABORT: historical seed fingerprint mismatch: ${fingerprint.failures.join('; ')}`)
  console.log(JSON.stringify({ ...createRemoteBootstrapPlan(), readOnly: true, counts: historical.counts, identity: historical.identity }, null, 2))
}

if (import.meta.main) await main()
