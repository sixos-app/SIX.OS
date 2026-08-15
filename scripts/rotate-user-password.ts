import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const username = (process.env.SIXOS_PASSWORD_USERNAME || 'agsix').trim().toLocaleLowerCase('en-US')
const password = process.env.SIXOS_NEW_PASSWORD || ''
const useRemote = process.argv.includes('--remote')

if (!/^[a-z0-9@._-]{3,180}$/.test(username)) {
  throw new Error('SIXOS_PASSWORD_USERNAME is invalid')
}
if (password.length < 12 || password.length > 256) {
  throw new Error('SIXOS_NEW_PASSWORD must contain between 12 and 256 characters')
}
if (useRemote && process.env.ALLOW_REMOTE_PASSWORD_ROTATION !== 'YES') {
  throw new Error('Remote rotation requires ALLOW_REMOTE_PASSWORD_ROTATION=YES')
}

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`
const salt = Buffer.from(crypto.randomBytes(16)).toString('base64')
const hash = Buffer.from(crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), 100000, 32, 'sha256')).toString('base64')
const normalizedUser = sqlString(username)

const sql = `
INSERT INTO user_credentials (user_id, password_salt, password_hash, iterations, updated_at)
SELECT id, ${sqlString(salt)}, ${sqlString(hash)}, 100000, CURRENT_TIMESTAMP
FROM users
WHERE (username = ${normalizedUser} OR lower(email) = ${normalizedUser}) AND status = 'active'
ON CONFLICT(user_id) DO UPDATE SET
  password_salt = excluded.password_salt,
  password_hash = excluded.password_hash,
  iterations = excluded.iterations,
  updated_at = excluded.updated_at;

DELETE FROM auth_sessions
WHERE user_id IN (
  SELECT id FROM users WHERE username = ${normalizedUser} OR lower(email) = ${normalizedUser}
);
`

const workDirectory = mkdtempSync(join(tmpdir(), 'sixos-password-'))
const sqlFile = join(workDirectory, 'rotate.sql')
writeFileSync(sqlFile, sql, { mode: 0o600 })

try {
  const targetArgument = useRemote ? '--remote' : '--local'
  const args = ['wrangler', 'd1', 'execute', 'six-os', targetArgument, '--file', sqlFile]
  execFileSync('pnpm', args, { stdio: 'inherit' })
  const verificationOutput = execFileSync('pnpm', [
    'wrangler', 'd1', 'execute', 'six-os', targetArgument,
    '--command', `SELECT COUNT(*) AS count FROM user_credentials JOIN users ON users.id = user_credentials.user_id WHERE (users.username = ${normalizedUser} OR lower(users.email) = ${normalizedUser}) AND users.status = 'active' AND user_credentials.password_salt = ${sqlString(salt)} AND user_credentials.password_hash = ${sqlString(hash)};`,
    '--json',
  ], { encoding: 'utf8' })
  const jsonStart = verificationOutput.indexOf('[')
  const jsonEnd = verificationOutput.lastIndexOf(']')
  const verification = jsonStart >= 0 && jsonEnd >= jsonStart
    ? JSON.parse(verificationOutput.slice(jsonStart, jsonEnd + 1)) as Array<{ results?: Array<{ count?: number }> }>
    : []
  if (Number(verification[0]?.results?.[0]?.count) !== 1) {
    throw new Error(`No active user matched ${username}; password rotation was not applied.`)
  }
  console.log(`Password rotated and sessions revoked for ${username} (${useRemote ? 'remote' : 'local'}).`)
} finally {
  rmSync(workDirectory, { recursive: true, force: true })
}
