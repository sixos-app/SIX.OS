import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { verifyPassword } from '../functions/api/_access'
import { assertHistoricalSeedFingerprint, bootstrapPilot, cleanupHistoricalSeeds, type LocalSqliteDatabase } from './pilot-bootstrap'
import { PILOT_RESOURCE_NAMES, PRODUCTION_DENYLIST, validatePilotTarget } from './pilot-safety'
import { verifyPilotCleanState } from './pilot-verify-clean'

type DatabaseWithAll = LocalSqliteDatabase & { prepare(sql: string): { run(...values: unknown[]): unknown; get(...values: unknown[]): unknown; all(...values: unknown[]): unknown[] } }

function createMigratedDatabase() {
  const database = new DatabaseSync(':memory:') as unknown as DatabaseWithAll
  database.exec('PRAGMA foreign_keys = ON; CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);')
  const migrations = readdirSync('migrations').filter((file) => file.endsWith('.sql')).sort()
  assert.equal(migrations.length, 50, 'expected 50 official migrations')
  for (const [index, file] of migrations.entries()) {
    database.exec(readFileSync(join('migrations', file), 'utf8'))
    database.prepare('INSERT INTO d1_migrations (id, name) VALUES (?, ?)').run(index + 1, file)
  }
  return database
}

function count(database: DatabaseWithAll, table: string) {
  return Number((database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count)
}

function target(overrides: Partial<Parameters<typeof validatePilotTarget>[0]> = {}) {
  return {
    pagesProject: PILOT_RESOURCE_NAMES.pagesProject,
    d1Name: PILOT_RESOURCE_NAMES.d1Name,
    r2Bucket: PILOT_RESOURCE_NAMES.r2Bucket,
    branch: PILOT_RESOURCE_NAMES.branch,
    mode: 'local' as const,
    confirmed: true,
    ...overrides,
  }
}

function assertDenied(overrides: Partial<Parameters<typeof validatePilotTarget>[0]>, options?: { expectedRemoteD1Id?: string }) {
  assert.equal(validatePilotTarget(target(overrides), options).allowed, false)
}

async function main() {
  assertDenied({ pagesProject: PRODUCTION_DENYLIST.pagesProject })
  assertDenied({ d1Name: PRODUCTION_DENYLIST.d1Name })
  assertDenied({ d1Id: PRODUCTION_DENYLIST.d1Id })
  assertDenied({ r2Bucket: PRODUCTION_DENYLIST.r2Bucket })
  assertDenied({ branch: PRODUCTION_DENYLIST.branch })
  assertDenied({ mode: 'remote', d1Id: '11111111-1111-4111-8111-111111111111' }, { expectedRemoteD1Id: '22222222-2222-4222-8222-222222222222' })
  assertDenied({ mode: 'remote' })
  assertDenied({ confirmed: false })
  assert.equal(validatePilotTarget(target()).allowed, true, 'local disposable pilot contract should be allowed')

  const database = createMigratedDatabase()
  assert.ok(count(database, 'organizations') > 0, 'historical organization seed must be reproduced')
  assert.ok(count(database, 'users') > 0, 'historical users seed must be reproduced')
  assert.ok(count(database, 'access_profiles') > 0, 'historical access profiles must be reproduced')
  assert.ok(count(database, 'departments') > 0, 'historical departments seed must be reproduced')
  assert.ok(count(database, 'work_types') > 0, 'historical work types must be reproduced')
  assert.ok(count(database, 'workflow_boards') > 0, 'historical workflow seed must be reproduced')

  assertHistoricalSeedFingerprint(database)
  cleanupHistoricalSeeds(database)
  for (const table of ['organizations', 'users', 'access_profiles', 'departments', 'work_types', 'workflow_boards', 'gamification_profiles']) assert.equal(count(database, table), 0, `${table} must be cleaned`)
  assert.equal(count(database, 'permissions'), 67, 'global permission catalog must survive cleanup')
  assert.equal(count(database, 'role_definitions'), 5, 'global role catalog must survive cleanup')
  assert.equal(count(database, 'role_permissions'), 50, 'global role permissions must survive cleanup')
  assert.equal(count(database, 'd1_migrations'), 50, 'migration ledger must survive cleanup')

  const input = { organizationName: 'Pilot Agency', organizationSlug: 'pilot-agency', adminName: 'Pilot Admin', adminEmail: 'pilot.admin@example.test', adminUsername: 'pilot.admin', password: 'local-pilot-password-123' }
  const created = await bootstrapPilot(database, input)
  assert.ok(created.organizationId.startsWith('org-pilot-'))
  const verified = verifyPilotCleanState(database)
  assert.equal(verified.ok, true, verified.failures.join('; '))

  const credential = database.prepare('SELECT password_salt AS passwordSalt, password_hash AS passwordHash, iterations FROM user_credentials WHERE user_id = ?').get(created.adminUserId) as { passwordSalt: string; passwordHash: string; iterations: number }
  const authEnvironment = {
    DB: {
      prepare: () => ({ bind: () => ({ first: async () => credential }) }),
    },
  }
  assert.equal(await verifyPassword(authEnvironment as any, input.adminUsername, input.password), true, 'login verifier must accept bootstrap credential')
  assert.equal(await verifyPassword(authEnvironment as any, input.adminUsername, 'wrong-password-123'), false, 'login verifier must reject wrong password')

  const beforeSecondRun = JSON.stringify(verified.counts)
  await assert.rejects(() => bootstrapPilot(database, input), /target is not an empty tenant state/)
  assert.equal(JSON.stringify(verifyPilotCleanState(database).counts), beforeSecondRun, 'second execution must not write')
  assert.throws(() => cleanupHistoricalSeeds(database), /historical seed fingerprint mismatch/)
  assert.equal(JSON.stringify(verifyPilotCleanState(database).counts), beforeSecondRun, 'cleanup must not write against an initialized tenant')

  const failureDatabase = createMigratedDatabase()
  cleanupHistoricalSeeds(failureDatabase)
  await assert.rejects(() => bootstrapPilot(failureDatabase, input, { injectFailure: true }), /injected pilot bootstrap failure/)
  for (const table of ['organizations', 'users', 'user_credentials', 'access_profiles', 'workflow_boards', 'xp_rules']) assert.equal(count(failureDatabase, table), 0, `${table} must roll back after injected failure`)
  assert.equal(count(failureDatabase, 'permissions'), 67, 'failure rollback must preserve global catalog')
  assert.equal(count(failureDatabase, 'd1_migrations'), 50, 'failure rollback must preserve migrations')

  const divergentLegacyDatabase = createMigratedDatabase()
  divergentLegacyDatabase.prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)').run('unexpected', 'Unexpected', 'unexpected')
  assert.throws(() => cleanupHistoricalSeeds(divergentLegacyDatabase), /historical seed fingerprint mismatch/)
  assert.equal(count(divergentLegacyDatabase, 'organizations'), 2, 'fingerprint rejection must not delete unexpected tenants')

  console.log('Pilot tooling: PASS')
}

await main()
