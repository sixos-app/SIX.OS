import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { buildPilotBootstrapSql } from './pilot-bootstrap-operation'
import { PILOT_IDENTITY } from './pilot-targeting'
import {
  REMOTE_BOOTSTRAP_CONFIRMATION,
  assertInteractiveWriteTerminal,
  buildRemoteD1WriteCommand,
  collectNonSensitiveInput,
  hashConfirmedPassword,
  validateRemoteBootstrapIntent,
  withTemporarySqlFile,
} from './pilot-remote-bootstrap'

const head = '445d629ceb173eea8413ff37394ba14f3a112b11'
const intent = (overrides: Partial<Parameters<typeof validateRemoteBootstrapIntent>[0]> = {}) => ({
  accountId: PILOT_IDENTITY.accountId,
  pagesName: PILOT_IDENTITY.pagesProject,
  pagesId: PILOT_IDENTITY.pagesProjectId,
  d1Name: PILOT_IDENTITY.d1Name,
  d1Id: PILOT_IDENTITY.d1Id,
  r2Bucket: PILOT_IDENTITY.r2Bucket,
  branch: PILOT_IDENTITY.branch,
  expectedHead: head,
  remoteHead: head,
  confirmation: REMOTE_BOOTSTRAP_CONFIRMATION,
  git: { branch: PILOT_IDENTITY.branch, head, porcelain: '' },
  ...overrides,
})

assert.equal(validateRemoteBootstrapIntent(intent()).ok, true)
for (const overrides of [
  { accountId: 'wrong' },
  { pagesName: 'six-os' },
  { pagesId: 'wrong-pages-id' },
  { d1Name: 'six-os' },
  { d1Id: 'de5f9b02-a8a3-4602-943f-f61bdb524f74' },
  { r2Bucket: 'six-os-files' },
  { branch: 'main' },
  { expectedHead: 'bad' },
  { remoteHead: 'a'.repeat(40) },
  { confirmation: '' },
  { confirmation: 'yes' },
  { git: { branch: PILOT_IDENTITY.branch, head, porcelain: ' M unsafe' } },
]) assert.equal(validateRemoteBootstrapIntent(intent(overrides)).ok, false)

assert.throws(() => assertInteractiveWriteTerminal({ stdinTTY: false, stdoutTTY: true, rawMode: true }), /real interactive TTY/)
assert.throws(() => assertInteractiveWriteTerminal({ stdinTTY: true, stdoutTTY: false, rawMode: true }), /real interactive TTY/)
assert.doesNotThrow(() => assertInteractiveWriteTerminal({ stdinTTY: true, stdoutTTY: true, rawMode: true }))

const promptValues = ["Agência d'Água – Pilot", 'pilot-safe-slug', "Ana d'Ávila — Gestão", 'pilot.admin+ops@example.test', 'pilot-admin_1']
const input = await collectNonSensitiveInput(async () => promptValues.shift()!)
assert.deepEqual(input, {
  organizationName: "Agência d'Água – Pilot",
  organizationSlug: 'pilot-safe-slug',
  adminName: "Ana d'Ávila — Gestão",
  adminEmail: 'pilot.admin+ops@example.test',
  adminUsername: 'pilot-admin_1',
})
const unsafePromptValues = ['Pilot', "unsafe'; delete", 'Admin User', 'admin@example.test', 'admin-user']
await assert.rejects(() => collectNonSensitiveInput(async () => unsafePromptValues.shift()!), /organization slug inválido/)

const secrets = ['secret-password-123', 'different-password-123']
await assert.rejects(() => hashConfirmedPassword(async () => secrets.shift()!), /password confirmation mismatch/)
let hashedPlaintext = ''
const matchingSecrets = ['secret-password-123', 'secret-password-123']
const credential = await hashConfirmedPassword(async () => matchingSecrets.shift()!, async (password) => {
  hashedPlaintext = password
  return { passwordSalt: 'c2FsdA==', passwordHash: 'aGFzaA==', iterations: 100000 }
})
assert.equal(hashedPlaintext, 'secret-password-123')

const operation = buildPilotBootstrapSql(input, credential, undefined, { includeHistoricalCleanup: true })
assert.doesNotMatch(operation.sql, /secret-password-123/)
assert.match(operation.sql, /Agência d''Água – Pilot/)
assert.match(operation.sql, /pilot\.admin\+ops@example\.test/)
assert.match(operation.sql, /PILOT_BOOTSTRAP_GUARD_FAILED/)

let successPath = ''
withTemporarySqlFile(operation.sql, (path) => {
  successPath = path
  assert.equal(statSync(path).mode & 0o777, 0o600)
  assert.equal(statSync(resolve(path, '..')).mode & 0o777, 0o700)
  assert.equal(readFileSync(path, 'utf8').includes('secret-password-123'), false)
  const command = buildRemoteD1WriteCommand(path)
  assert.equal(command.executable, 'pnpm')
  assert.deepEqual(command.args.slice(0, 6), ['exec', 'wrangler', 'd1', 'execute', PILOT_IDENTITY.d1Name, '--remote'])
  assert.ok(command.args.includes('--config'))
  assert.ok(command.args.includes('wrangler.pilot.toml'))
  assert.ok(command.args.includes('--file'))
  assert.ok(command.args.includes('--yes'))
  assert.ok(!command.args.includes('wrangler.toml'))
  assert.ok(!command.args.includes('six-os'))
  assert.ok(!command.args.includes('de5f9b02-a8a3-4602-943f-f61bdb524f74'))
  assert.ok(!command.args.some((argument) => argument.startsWith('--password')))
}, { installSignalHandler: false })
assert.equal(existsSync(successPath), false, 'temporary SQL must be removed after success')

let failurePath = ''
assert.throws(() => withTemporarySqlFile('SELECT 1;', (path) => {
  failurePath = path
  throw new Error('fake executor failure')
}, { installSignalHandler: false }), /fake executor failure/)
assert.equal(existsSync(failurePath), false, 'temporary SQL must be removed after failure')

let signalPath = ''
withTemporarySqlFile('SELECT 1;', (path) => {
  signalPath = path
  process.emit('SIGINT')
  assert.equal(existsSync(path), false, 'SIGINT handler must remove temporary SQL immediately')
})
process.exitCode = 0
assert.equal(existsSync(signalPath), false, 'temporary SQL must remain absent after SIGINT simulation')

assert.throws(() => buildRemoteD1WriteCommand(resolve(process.cwd(), 'unsafe.sql')), /system temporary directory/)

try {
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/pilot-remote-bootstrap.ts', '--remote-pilot', '--write'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.fail('non-TTY write process must fail')
} catch (error) {
  const output = `${(error as { stdout?: string }).stdout ?? ''}${(error as { stderr?: string }).stderr ?? ''}`
  assert.match(output, /real interactive TTY/)
}

assert.ok(resolve(successPath).startsWith(resolve(tmpdir())))
console.log('Pilot remote bootstrap executor: PASS')
