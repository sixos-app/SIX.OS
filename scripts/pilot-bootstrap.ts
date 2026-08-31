import { DatabaseSync } from 'node:sqlite'
import { hashPassword } from '../functions/api/_access'
import { assertPilotTarget, PILOT_RESOURCE_NAMES } from './pilot-safety'
import { assertPilotInteractiveTerminal, readHiddenLine } from './pilot-tty'
import {
  HISTORICAL_SEED_COUNTS,
  LEGACY_SEED_TABLES,
  buildPilotBootstrapSql,
  validateHistoricalSeedFingerprint,
  validatePilotBootstrapInput,
  validatePilotPassword,
  type HistoricalSeedCounts,
  type HistoricalSeedIdentity,
  type PilotBootstrapInput,
} from './pilot-bootstrap-operation'

export {
  HISTORICAL_SEED_COUNTS,
  LEGACY_SEED_TABLES,
  buildPilotBootstrapSql,
  validateHistoricalSeedFingerprint,
  validatePilotBootstrapInput,
  validatePilotPassword,
}
export type { HistoricalSeedCounts, HistoricalSeedIdentity, PilotBootstrapInput }

export type LocalSqliteDatabase = {
  exec(sql: string): void
  prepare(sql: string): {
    run(...values: unknown[]): unknown
    get(...values: unknown[]): unknown
    all?(...values: unknown[]): unknown[]
  }
}

function count(database: LocalSqliteDatabase, table: string) {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }
  return Number(row.count)
}

export function readHistoricalSeedFingerprint(database: LocalSqliteDatabase) {
  const counts = Object.fromEntries(
    Object.keys(HISTORICAL_SEED_COUNTS).map((table) => [table, count(database, table)]),
  ) as HistoricalSeedCounts
  const organization = database.prepare('SELECT id || ? || slug AS value FROM organizations LIMIT 1').get(':') as { value: string } | undefined
  const user = database.prepare('SELECT id || ? || organization_id || ? || username AS value FROM users LIMIT 1').get(':', ':') as { value: string } | undefined
  const adminProfile = database.prepare("SELECT id || ? || organization_id AS value FROM access_profiles WHERE code = 'admin_tech' LIMIT 1").get(':') as { value: string } | undefined
  const identity: HistoricalSeedIdentity = {
    organization: organization?.value ?? '',
    user: user?.value ?? '',
    adminProfile: adminProfile?.value ?? '',
  }
  return { counts, identity }
}

export function assertHistoricalSeedFingerprint(database: LocalSqliteDatabase) {
  const fingerprint = readHistoricalSeedFingerprint(database)
  const result = validateHistoricalSeedFingerprint(fingerprint.counts, fingerprint.identity)
  if (!result.ok) throw new Error(`PILOT CLEANUP ABORT: historical seed fingerprint mismatch: ${result.failures.join('; ')}`)
}

export function assertBootstrapAvailable(database: LocalSqliteDatabase) {
  const state = ['organizations', 'users', 'user_credentials', 'auth_sessions'].map((table) => [table, count(database, table)] as const)
  if (state.some(([, value]) => value !== 0)) throw new Error('PILOT BOOTSTRAP ABORT: target is not an empty tenant state')
}

function executeAtomicSql(database: LocalSqliteDatabase, sql: string) {
  database.exec('BEGIN IMMEDIATE')
  try {
    database.exec(sql)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export function cleanupHistoricalSeeds(database: LocalSqliteDatabase) {
  assertHistoricalSeedFingerprint(database)
  executeAtomicSql(database, LEGACY_SEED_TABLES.map((table) => `DELETE FROM ${table};`).join('\n'))
}

export async function bootstrapPilot(database: LocalSqliteDatabase, input: PilotBootstrapInput, options: { injectFailure?: boolean } = {}) {
  const validated = validatePilotBootstrapInput(input)
  validatePilotPassword(input.password)
  assertBootstrapAvailable(database)
  const credential = await hashPassword(input.password)
  const operation = buildPilotBootstrapSql(validated, credential, undefined, { injectFailure: options.injectFailure })
  executeAtomicSql(database, operation.sql)
  return operation.ids
}

export async function bootstrapHistoricalPilot(database: LocalSqliteDatabase, input: PilotBootstrapInput, options: { injectFailure?: boolean } = {}) {
  const validated = validatePilotBootstrapInput(input)
  validatePilotPassword(input.password)
  assertHistoricalSeedFingerprint(database)
  const credential = await hashPassword(input.password)
  const operation = buildPilotBootstrapSql(validated, credential, undefined, {
    includeHistoricalCleanup: true,
    injectFailure: options.injectFailure,
  })
  executeAtomicSql(database, operation.sql)
  return operation.ids
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
  } else {
    try {
      assertPilotInteractiveTerminal('PILOT SAFETY ABORT: an interactive terminal is required for password input')
      assertPilotTarget({ ...PILOT_RESOURCE_NAMES, mode: 'local', confirmed: true })
      let password = await readHiddenLine('Pilot administrator password: ')
      let confirmation = await readHiddenLine('Confirm pilot administrator password: ')
      if (password !== confirmation) throw new Error('password confirmation mismatch')
      const database = new DatabaseSync(localDatabasePath) as unknown as LocalSqliteDatabase
      await bootstrapHistoricalPilot(database, {
        organizationName: values.get('--organization-name')!,
        organizationSlug: values.get('--organization-slug')!,
        adminName: values.get('--admin-name')!,
        adminEmail: values.get('--admin-email')!,
        adminUsername: values.get('--admin-username')!,
        password,
      })
      password = ''
      confirmation = ''
      console.log('Pilot local bootstrap complete.')
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'PILOT BOOTSTRAP ABORT')
      process.exitCode = 1
    }
  }
}
