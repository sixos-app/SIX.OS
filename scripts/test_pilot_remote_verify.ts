import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { bootstrapHistoricalPilot, type LocalSqliteDatabase } from './pilot-bootstrap'
import {
  PILOT_CLEAN_VERIFY_SQL,
  expectedCleanMigrationNames,
  verifyPilotCleanSnapshot,
  verifyPilotCleanState,
} from './pilot-verify-clean'

type TestDatabase = LocalSqliteDatabase & {
  prepare(sql: string): {
    run(...values: unknown[]): unknown
    get(...values: unknown[]): unknown
    all(...values: unknown[]): unknown[]
  }
}

function createMigratedDatabase() {
  const database = new DatabaseSync(':memory:') as unknown as TestDatabase
  database.exec('PRAGMA foreign_keys = ON; CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);')
  const migrations = expectedCleanMigrationNames()
  assert.equal(migrations.length, 50)
  for (const [index, file] of migrations.entries()) {
    database.exec(readFileSync(join('migrations', file), 'utf8'))
    database.prepare('INSERT INTO d1_migrations (id, name) VALUES (?, ?)').run(index + 1, file)
  }
  return database
}

assert.doesNotMatch(PILOT_CLEAN_VERIFY_SQL, /\b(?:INSERT|UPDATE|DELETE|REPLACE|DROP|ALTER|CREATE)\b/i)
assert.match(PILOT_CLEAN_VERIFY_SQL, /contracts\.manage/)
assert.match(PILOT_CLEAN_VERIFY_SQL, /profile_permissions/)
assert.match(PILOT_CLEAN_VERIFY_SQL, /legacy_nine_folders/)

const database = createMigratedDatabase()
const historicalResult = verifyPilotCleanState(database)
assert.equal(historicalResult.ok, false, 'historical seed must not pass clean-state verification')
assert.ok(historicalResult.failures.some((failure) => failure.includes('user_credentials')))
assert.ok(historicalResult.failures.some((failure) => failure.includes('legacy')))

await bootstrapHistoricalPilot(database, {
  organizationName: 'Pilot Verify Organization',
  organizationSlug: 'pilot-verify',
  adminName: 'Pilot Verify Admin',
  adminEmail: 'pilot.verify+admin@example.test',
  adminUsername: 'pilot.verify-admin',
  password: 'pilot-verify-password-123',
})

const cleanResult = verifyPilotCleanState(database)
assert.equal(cleanResult.ok, true, cleanResult.failures.join('; '))
assert.equal(cleanResult.counts.organizations, 1)
assert.equal(cleanResult.counts.admin_permissions, cleanResult.counts.permissions)
assert.equal(cleanResult.counts.admin_missing, 0)
assert.equal(cleanResult.counts.admin_invalid_extra, 0)

const cleanRow = database.prepare(PILOT_CLEAN_VERIFY_SQL).get() as Record<string, unknown>
assert.equal(verifyPilotCleanSnapshot({ ...cleanRow, organizations: 2 }).ok, false)
assert.equal(verifyPilotCleanSnapshot({ ...cleanRow, admin_missing: 1 }).ok, false)
assert.equal(verifyPilotCleanSnapshot({ ...cleanRow, contracts_manage_present: 0 }).ok, false)
assert.equal(verifyPilotCleanSnapshot({ ...cleanRow, migrationNames: '0000_wrong.sql' }).ok, false)
assert.equal(verifyPilotCleanSnapshot({ ...cleanRow, legacy_organization: 1 }).ok, false)

assert.equal(readdirSync('migrations').filter((file) => file.endsWith('.sql')).length, 50)
console.log('Pilot remote verify read-only adapter: PASS')
