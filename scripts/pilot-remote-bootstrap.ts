import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { hashPassword } from '../functions/api/_access'
import {
  HISTORICAL_SEED_COUNTS,
  buildPilotBootstrapSql,
  validateHistoricalSeedFingerprint,
  validatePilotBootstrapInput,
  validatePilotPassword,
  type HistoricalSeedCounts,
  type HistoricalSeedIdentity,
  type PilotCredential,
  type ValidatedPilotBootstrapInput,
} from './pilot-bootstrap-operation'
import { assertPilotTarget, PILOT_RESOURCE_NAMES } from './pilot-safety'
import { assertPilotInteractiveTerminal, readHiddenLine, type PilotTerminalState } from './pilot-tty'
import {
  PILOT_CONFIG_FILE,
  PILOT_IDENTITY,
  type PilotGitState,
  validatePilotAccount,
  validatePilotConfig,
  validatePilotGitState,
  validatePilotRemoteSnapshot,
} from './pilot-targeting'
import { readPilotGitState, readPilotRemoteSnapshot } from './pilot-preflight'

export { HISTORICAL_SEED_COUNTS, validateHistoricalSeedFingerprint }
export type { HistoricalSeedCounts, HistoricalSeedIdentity }

export const REMOTE_BOOTSTRAP_CONFIRMATION = `BOOTSTRAP ${PILOT_IDENTITY.d1Name} ${PILOT_IDENTITY.d1Id}`

export type RemoteBootstrapIntent = {
  accountId?: string
  pagesName: string
  pagesId: string
  d1Name: string
  d1Id: string
  r2Bucket: string
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

export type RemoteD1Command = { executable: 'pnpm'; args: string[] }

const countSql = Object.keys(HISTORICAL_SEED_COUNTS)
  .map((table) => `(SELECT COUNT(*) FROM ${table}) AS ${table}`)
  .join(', ')

export const FINGERPRINT_SQL = `SELECT ${countSql},
  (SELECT id || ':' || slug FROM organizations LIMIT 1) AS organization,
  (SELECT id || ':' || organization_id || ':' || username FROM users LIMIT 1) AS user,
  (SELECT id || ':' || organization_id FROM access_profiles WHERE code = 'admin_tech' LIMIT 1) AS adminProfile,
  (SELECT GROUP_CONCAT(name, '|') FROM (SELECT name FROM d1_migrations ORDER BY id)) AS migrationNames`

function fullSha(value: string) {
  return /^[0-9a-f]{40}$/i.test(value)
}

export function validateRemoteBootstrapIntent(intent: RemoteBootstrapIntent, options: { requireConfirmation?: boolean } = {}) {
  const failures: string[] = []
  failures.push(...validatePilotAccount(intent.accountId).failures)
  if (intent.pagesName !== PILOT_IDENTITY.pagesProject) failures.push('pilot Pages name mismatch')
  if (intent.pagesId !== PILOT_IDENTITY.pagesProjectId) failures.push('pilot Pages ID mismatch')
  if (intent.d1Name !== PILOT_IDENTITY.d1Name) failures.push('pilot D1 name mismatch')
  if (intent.d1Id !== PILOT_IDENTITY.d1Id) failures.push('pilot D1 UUID mismatch')
  if (intent.r2Bucket !== PILOT_IDENTITY.r2Bucket) failures.push('pilot R2 bucket mismatch')
  if (intent.branch !== PILOT_IDENTITY.branch) failures.push('pilot branch mismatch')
  if (!fullSha(intent.expectedHead)) failures.push('EXPECTED_HEAD must be a full Git SHA')
  else {
    failures.push(...validatePilotGitState(intent.git, intent.expectedHead).failures)
    if (intent.remoteHead !== intent.expectedHead) failures.push('remote feature HEAD must equal EXPECTED_HEAD')
  }
  if (options.requireConfirmation !== false && intent.confirmation !== REMOTE_BOOTSTRAP_CONFIRMATION) failures.push('destructive pilot confirmation mismatch')
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

export function remoteFeatureHead(root: string) {
  return execFileSync('git', ['ls-remote', '--heads', 'origin', PILOT_IDENTITY.branch], { cwd: root, encoding: 'utf8' }).trim().split(/\s+/)[0] ?? ''
}

export function parseWranglerJson(output: string) {
  const start = output.indexOf('[')
  const end = output.lastIndexOf(']')
  if (start < 0 || end < start) throw new Error('PILOT REMOTE ABORT: D1 read-only output was not JSON')
  return JSON.parse(output.slice(start, end + 1)) as Array<{ results?: Array<Record<string, unknown>>; meta?: { rows_written?: number; changed_db?: boolean } }>
}

export function expectedMigrationNames(root: string) {
  return readdirSync(resolve(root, PILOT_IDENTITY.migrationsDir)).filter((file) => file.endsWith('.sql')).sort()
}

export function validateRemoteMigrationState(root: string, migrationNames: string) {
  const expected = expectedMigrationNames(root)
  const applied = migrationNames ? migrationNames.split('|') : []
  const failures: string[] = []
  if (expected.length !== 50) failures.push(`local migrations: expected 50, got ${expected.length}`)
  if (applied.length !== 50) failures.push(`remote migrations: expected 50, got ${applied.length}`)
  if (expected.join('|') !== applied.join('|')) failures.push('remote migrations do not exactly match local migrations; pending or divergent migration detected')
  return { ok: failures.length === 0, failures, count: applied.length, pending: failures.length ? 'UNKNOWN_OR_NONZERO' : 0 }
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
  return { counts, identity, migrationNames: String(row.migrationNames ?? '') }
}

export function assertInteractiveWriteTerminal(terminal: PilotTerminalState = {}) {
  assertPilotInteractiveTerminal('PILOT REMOTE ABORT: write mode requires a real interactive TTY', terminal)
}

export function buildRemoteD1WriteCommand(sqlFile: string): RemoteD1Command {
  const relativeToTemp = relative(resolve(tmpdir()), resolve(sqlFile))
  if (!sqlFile || !relativeToTemp || relativeToTemp.startsWith('..') || isAbsolute(relativeToTemp)) throw new Error('PILOT REMOTE ABORT: SQL file must be in the system temporary directory')
  // Wrangler/D1 remote --file ingestion supplies the single transaction. The
  // generated file intentionally has no BEGIN/COMMIT because D1 rejects nested
  // transactions and restores the original database if ingestion fails.
  return {
    executable: 'pnpm',
    args: ['exec', 'wrangler', 'd1', 'execute', PILOT_IDENTITY.d1Name, '--remote', '--config', PILOT_CONFIG_FILE, '--file', sqlFile, '--yes'],
  }
}

export function withTemporarySqlFile<T>(sql: string, execute: (path: string) => T, options: { installSignalHandler?: boolean } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'six-os-pilot-bootstrap-'))
  chmodSync(directory, 0o700)
  const path = join(directory, `${randomUUID()}.sql`)
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    rmSync(directory, { recursive: true, force: true })
  }
  const onSignal = () => {
    cleanup()
    process.exitCode = 130
  }
  if (options.installSignalHandler !== false) process.once('SIGINT', onSignal)
  try {
    writeFileSync(path, sql, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    chmodSync(path, 0o600)
    return execute(path)
  } finally {
    if (options.installSignalHandler !== false) process.off('SIGINT', onSignal)
    cleanup()
  }
}

export async function collectNonSensitiveInput(readLine: (label: string) => Promise<string>): Promise<ValidatedPilotBootstrapInput> {
  return validatePilotBootstrapInput({
    organizationName: await readLine('Organization name: '),
    organizationSlug: await readLine('Organization slug: '),
    adminName: await readLine('Admin full name: '),
    adminEmail: await readLine('Admin email: '),
    adminUsername: await readLine('Admin username: '),
  })
}

export async function hashConfirmedPassword(readSecret: (label: string) => Promise<string>, hasher = hashPassword): Promise<PilotCredential> {
  let password = await readSecret('Admin password: ')
  let confirmation = await readSecret('Confirm admin password: ')
  try {
    if (password !== confirmation) throw new Error('PILOT REMOTE ABORT: password confirmation mismatch')
    validatePilotPassword(password)
    return await hasher(password)
  } finally {
    password = ''
    confirmation = ''
  }
}

async function main() {
  if (process.argv.some((argument) => argument.startsWith('--password'))) throw new Error('PILOT REMOTE ABORT: password arguments are not accepted')
  if (!process.argv.includes('--remote-pilot')) throw new Error('PILOT REMOTE ABORT: explicit --remote-pilot mode is required')
  const dryRun = process.argv.includes('--dry-run')
  const write = process.argv.includes('--write')
  if (dryRun === write) throw new Error('PILOT REMOTE ABORT: choose exactly one of --dry-run or --write')
  if (write) assertInteractiveWriteTerminal()

  const root = process.cwd()
  const config = validatePilotConfig(readFileSync(resolve(root, PILOT_CONFIG_FILE), 'utf8'))
  if (!config.ok) throw new Error(`PILOT REMOTE ABORT: ${config.failures.join('; ')}`)
  const expectedHead = valueArgument('--expected-head') || process.env.EXPECTED_HEAD || ''
  const baseIntent: RemoteBootstrapIntent = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    pagesName: config.target.pagesProject,
    pagesId: PILOT_IDENTITY.pagesProjectId,
    d1Name: valueArgument('--d1-name'),
    d1Id: valueArgument('--d1-id'),
    r2Bucket: config.target.r2Bucket,
    branch: valueArgument('--branch'),
    expectedHead,
    remoteHead: remoteFeatureHead(root),
    confirmation: valueArgument('--confirm'),
    git: readPilotGitState(root),
  }

  if (dryRun) {
    const intent = validateRemoteBootstrapIntent(baseIntent)
    if (!intent.ok) throw new Error(`PILOT REMOTE ABORT: ${intent.failures.join('; ')}`)
    const historical = readRemoteHistoricalSeed(root)
    const fingerprint = validateHistoricalSeedFingerprint(historical.counts, historical.identity)
    const migrations = validateRemoteMigrationState(root, historical.migrationNames)
    if (!fingerprint.ok || !migrations.ok) throw new Error(`PILOT REMOTE ABORT: historical seed fingerprint mismatch: ${[...fingerprint.failures, ...migrations.failures].join('; ')}`)
    console.log(JSON.stringify({ ...createRemoteBootstrapPlan(), readOnly: true, migrations, counts: historical.counts, identity: historical.identity }, null, 2))
    return
  }

  const terminal = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  try {
    const input = await collectNonSensitiveInput((label) => terminal.question(label))
    const remoteSnapshot = await readPilotRemoteSnapshot(process.env.CLOUDFLARE_API_TOKEN ?? '', root)
    const remoteTarget = validatePilotRemoteSnapshot(remoteSnapshot)
    const intentBeforeConfirmation = validateRemoteBootstrapIntent({
      ...baseIntent,
      pagesName: remoteSnapshot.pages.name,
      pagesId: remoteSnapshot.pages.id,
      d1Name: remoteSnapshot.d1.name,
      d1Id: remoteSnapshot.d1.id,
      r2Bucket: remoteSnapshot.r2.name,
    }, { requireConfirmation: false })
    if (!remoteTarget.ok || !intentBeforeConfirmation.ok) {
      throw new Error(`PILOT REMOTE ABORT: ${[...remoteTarget.failures, ...intentBeforeConfirmation.failures].join('; ')}`)
    }
    const historical = readRemoteHistoricalSeed(root)
    const fingerprint = validateHistoricalSeedFingerprint(historical.counts, historical.identity)
    const migrations = validateRemoteMigrationState(root, historical.migrationNames)
    if (!fingerprint.ok || !migrations.ok) throw new Error(`PILOT REMOTE ABORT: historical seed fingerprint mismatch: ${[...fingerprint.failures, ...migrations.failures].join('; ')}`)

    console.log(JSON.stringify({
      accountId: PILOT_IDENTITY.accountId,
      pages: { name: PILOT_IDENTITY.pagesProject, id: PILOT_IDENTITY.pagesProjectId },
      d1: { name: PILOT_IDENTITY.d1Name, id: PILOT_IDENTITY.d1Id },
      r2: PILOT_IDENTITY.r2Bucket,
      historicalFingerprint: 'PASS',
      plannedCleanup: createRemoteBootstrapPlan().wouldRemove,
      plannedBaseline: createRemoteBootstrapPlan().wouldCreate,
    }, null, 2))
    const confirmation = await terminal.question(`Type ${REMOTE_BOOTSTRAP_CONFIRMATION}: `)
    const confirmedIntent = validateRemoteBootstrapIntent({ ...baseIntent, confirmation })
    if (!confirmedIntent.ok) throw new Error(`PILOT REMOTE ABORT: ${confirmedIntent.failures.join('; ')}`)

    // Close readline before raw-mode password collection so no line editor can
    // observe or echo the secret. Confirmation happens first to avoid retaining
    // plaintext while the operator reviews the destructive target.
    terminal.close()
    const credential = await hashConfirmedPassword(readHiddenLine)
    const operation = buildPilotBootstrapSql(input, credential, undefined, { includeHistoricalCleanup: true })

    const finalSnapshot = await readPilotRemoteSnapshot(process.env.CLOUDFLARE_API_TOKEN ?? '', root)
    const finalTarget = validatePilotRemoteSnapshot(finalSnapshot)
    if (!finalTarget.ok) throw new Error(`PILOT REMOTE ABORT: final target identity changed: ${finalTarget.failures.join('; ')}`)
    assertPilotTarget({ ...PILOT_RESOURCE_NAMES, mode: 'remote', confirmed: true }, {
      expectedRemoteD1Id: PILOT_IDENTITY.d1Id,
      allowRemoteWrite: true,
    })

    withTemporarySqlFile(operation.sql, (sqlFile) => {
      const command = buildRemoteD1WriteCommand(sqlFile)
      execFileSync(command.executable, command.args, {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: PILOT_IDENTITY.accountId },
      })
    })
    console.log(JSON.stringify({ result: 'PASS', target: 'PILOT', operation: 'remote bootstrap one-shot' }))
  } finally {
    terminal.close()
  }
}

if (import.meta.main) await main()
