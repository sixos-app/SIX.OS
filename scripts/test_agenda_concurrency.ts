import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

type PatchInput = {
  expectedRevision: number
  title?: string
  participants?: string[]
  mention?: string
}

type PatchResult = { status: 200 | 409; revision?: number }

const database = new DatabaseSync(':memory:')

function requiredRow<T>(row: T | undefined): T {
  assert.ok(row, 'expected database row')
  return row
}

database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE calendar_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    title TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  INSERT INTO calendar_events (id, organization_id, title, updated_at)
  VALUES ('existing', 'org', 'Evento existente', '2026-08-22T00:00:00.000Z');
`)
database.exec(readFileSync('migrations/0048_calendar_event_revision.sql', 'utf8'))

const revisionColumn = requiredRow((database.prepare('PRAGMA table_info(calendar_events)').all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>).find((column) => column.name === 'revision'))
assert.equal(revisionColumn.type, 'INTEGER')
assert.equal(revisionColumn.notnull, 1)
assert.equal(revisionColumn.dflt_value, '0')
assert.equal(requiredRow(database.prepare('SELECT revision FROM calendar_events WHERE id = ?').get('existing')).revision, 0)

database.exec(`
  CREATE TABLE calendar_event_participants (
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (event_id, user_id)
  );
  INSERT INTO calendar_event_participants VALUES ('existing', 'U0', 'org', '2026-08-22T00:00:00.000Z');
`)

const notifications: string[] = []

function patch(input: PatchInput): PatchResult {
  const now = new Date().toISOString()
  const update = database.prepare(`
    UPDATE calendar_events
    SET title = COALESCE(?, title), updated_at = ?, revision = revision + 1
    WHERE id = ? AND organization_id = ? AND revision = ?
  `).run(input.title ?? null, now, 'existing', 'org', input.expectedRevision)
  if (!update.changes) return { status: 409 }

  if (input.participants) {
    const insert = database.prepare(`
      INSERT OR REPLACE INTO calendar_event_participants (event_id, user_id, organization_id, created_at)
      SELECT ?, ?, ?, ? WHERE changes() = 1
    `)
    for (const participant of input.participants) insert.run('existing', participant, 'org', now)
    const placeholders = input.participants.map(() => '?').join(', ')
    database.prepare(`
      DELETE FROM calendar_event_participants
      WHERE event_id = ? AND user_id NOT IN (${placeholders}) AND changes() = 1
    `).run('existing', ...input.participants)
  }
  if (input.mention) notifications.push(input.mention)
  return { status: 200, revision: input.expectedRevision + 1 }
}

async function concurrentPatch(input: PatchInput) {
  await Promise.resolve()
  return patch(input)
}

const [first, second] = await Promise.all([
  concurrentPatch({ expectedRevision: 0, title: 'Evento A', participants: ['U1'], mention: 'ana' }),
  concurrentPatch({ expectedRevision: 0, title: 'Evento B', participants: ['U2'], mention: 'bruno' }),
])

assert.deepEqual([first.status, second.status].sort(), [200, 409])
assert.equal(requiredRow(database.prepare('SELECT revision FROM calendar_events WHERE id = ?').get('existing')).revision, 1)
assert.equal(requiredRow(database.prepare('SELECT title FROM calendar_events WHERE id = ?').get('existing')).title, 'Evento A')
assert.deepEqual(database.prepare('SELECT user_id FROM calendar_event_participants WHERE event_id = ? ORDER BY user_id').all('existing').map((row) => row.user_id), ['U1'])
assert.deepEqual(notifications, ['ana'])

const retry = patch({ expectedRevision: 1, title: 'Evento C', participants: ['U2'] })
assert.equal(retry.status, 200)
assert.equal(retry.revision, 2)
assert.deepEqual(database.prepare('SELECT user_id FROM calendar_event_participants WHERE event_id = ? ORDER BY user_id').all('existing').map((row) => row.user_id), ['U2'])

const thirdPatch = patch({ expectedRevision: 2, title: 'Evento D' })
assert.equal(thirdPatch.status, 200)
assert.equal(thirdPatch.revision, 3)
assert.equal(requiredRow(database.prepare('SELECT revision FROM calendar_events WHERE id = ?').get('existing')).revision, 3)

for (let cycle = 0; cycle < 10; cycle += 1) {
  const raceDatabase = new DatabaseSync(':memory:')
  raceDatabase.exec(`
    CREATE TABLE calendar_events (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
    INSERT INTO calendar_events (id, organization_id) VALUES ('event', 'org');
  `)
  const attempt = async () => {
    await Promise.resolve()
    return raceDatabase.prepare('UPDATE calendar_events SET revision = revision + 1 WHERE id = ? AND organization_id = ? AND revision = ?').run('event', 'org', 0).changes
  }
  const outcomes = await Promise.all([attempt(), attempt()])
  assert.deepEqual(outcomes.sort(), [0, 1])
}

database.exec("INSERT INTO calendar_events (id, organization_id, title, updated_at) VALUES ('new', 'org', 'Novo evento', '2026-08-22T00:00:00.000Z')")
assert.equal(requiredRow(database.prepare('SELECT revision FROM calendar_events WHERE id = ?').get('new')).revision, 0)

console.log('Agenda revision migration and concurrent CAS: PASS')
