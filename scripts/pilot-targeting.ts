import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

export const PILOT_IDENTITY = Object.freeze({
  accountId: 'b45eeeb9e898de9689fad1875f559e83',
  pagesProject: 'six-os-pilot',
  pagesProjectId: '15210a19-6154-418d-b0c3-cb6389836333',
  pagesDomain: 'six-os-pilot.pages.dev',
  d1Name: 'six-os-pilot',
  d1Id: '81642d81-f81a-4a2f-8b43-400ce8d02261',
  r2Bucket: 'six-os-files-pilot',
  branch: 'codex/pilot-environment',
  buildOutput: 'dist',
  migrationsDir: 'migrations',
})

export const PILOT_CONFIG_FILE = 'wrangler.pilot.toml'

export type PilotConfigTargets = {
  pagesProject: string
  buildOutput: string
  d1Binding: string
  d1Name: string
  d1Id: string
  migrationsDir: string
  r2Binding: string
  r2Bucket: string
}

export type PilotRemoteSnapshot = {
  pages: {
    id: string
    name: string
    subdomain: string
    source: unknown
    productionBranch: string
    productionD1Id?: string
    previewD1Id?: string
    productionR2Bucket?: string
    previewR2Bucket?: string
  }
  d1: { id: string; name: string }
  r2: { name: string }
}

export type PilotGitState = { branch: string; head: string; porcelain: string }

export function validatePilotAccount(accountId: string | undefined) {
  const value = accountId?.trim() ?? ''
  return {
    ok: value === PILOT_IDENTITY.accountId,
    failures: value === PILOT_IDENTITY.accountId ? [] : ['Cloudflare account mismatch'],
  }
}

function assignment(text: string, key: string) {
  const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"\\s*$`, 'm'))
  return match?.[1] ?? ''
}

function bindingBlock(text: string, heading: string, binding: string) {
  const blocks = text.split(new RegExp(`^\\s*\\[\\[${heading}\\]\\]\\s*$`, 'm')).slice(1)
  return blocks.find((block) => assignment(block, 'binding') === binding)?.split(/^\s*\[\[/m)[0] ?? ''
}

export function parsePilotConfig(text: string): PilotConfigTargets {
  const d1 = bindingBlock(text, 'd1_databases', 'DB')
  const r2 = bindingBlock(text, 'r2_buckets', 'FILES')
  return {
    pagesProject: assignment(text, 'name'),
    buildOutput: assignment(text, 'pages_build_output_dir'),
    d1Binding: assignment(d1, 'binding'),
    d1Name: assignment(d1, 'database_name'),
    d1Id: assignment(d1, 'database_id'),
    migrationsDir: assignment(d1, 'migrations_dir'),
    r2Binding: assignment(r2, 'binding'),
    r2Bucket: assignment(r2, 'bucket_name'),
  }
}

export function validatePilotConfig(text: string) {
  const target = parsePilotConfig(text)
  const failures: string[] = []
  const expected: PilotConfigTargets = {
    pagesProject: PILOT_IDENTITY.pagesProject,
    buildOutput: PILOT_IDENTITY.buildOutput,
    d1Binding: 'DB',
    d1Name: PILOT_IDENTITY.d1Name,
    d1Id: PILOT_IDENTITY.d1Id,
    migrationsDir: PILOT_IDENTITY.migrationsDir,
    r2Binding: 'FILES',
    r2Bucket: PILOT_IDENTITY.r2Bucket,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (target[key as keyof PilotConfigTargets] !== value) failures.push(`${key}: expected ${value}`)
  }
  return { ok: failures.length === 0, failures, target }
}

export function validatePilotGitState(state: PilotGitState, expectedHead: string) {
  const failures: string[] = []
  if (state.branch !== PILOT_IDENTITY.branch) failures.push(`branch: expected ${PILOT_IDENTITY.branch}`)
  if (!/^[0-9a-f]{40}$/i.test(expectedHead)) failures.push('expected HEAD must be a full Git SHA')
  else if (state.head !== expectedHead) failures.push(`HEAD: expected ${expectedHead}, got ${state.head}`)
  if (state.porcelain.trim()) failures.push('working tree must be clean')
  return { ok: failures.length === 0, failures }
}

export function validatePilotRemoteSnapshot(snapshot: PilotRemoteSnapshot) {
  const failures: string[] = []
  const checks: Array<[string, unknown, unknown]> = [
    ['Pages name', snapshot.pages.name, PILOT_IDENTITY.pagesProject],
    ['Pages ID', snapshot.pages.id, PILOT_IDENTITY.pagesProjectId],
    ['Pages domain', snapshot.pages.subdomain, PILOT_IDENTITY.pagesDomain],
    ['Pages production branch', snapshot.pages.productionBranch, PILOT_IDENTITY.branch],
    ['D1 name', snapshot.d1.name, PILOT_IDENTITY.d1Name],
    ['D1 ID', snapshot.d1.id, PILOT_IDENTITY.d1Id],
    ['R2 name', snapshot.r2.name, PILOT_IDENTITY.r2Bucket],
    ['Production DB binding', snapshot.pages.productionD1Id, PILOT_IDENTITY.d1Id],
    ['Preview DB binding', snapshot.pages.previewD1Id, PILOT_IDENTITY.d1Id],
    ['Production FILES binding', snapshot.pages.productionR2Bucket, PILOT_IDENTITY.r2Bucket],
    ['Preview FILES binding', snapshot.pages.previewR2Bucket, PILOT_IDENTITY.r2Bucket],
  ]
  for (const [label, actual, expected] of checks) {
    if (actual !== expected) failures.push(`${label}: expected ${String(expected)}, got ${String(actual)}`)
  }
  if (snapshot.pages.source !== null && snapshot.pages.source !== undefined) failures.push('Pages Git integration must be absent')
  return { ok: failures.length === 0, failures }
}

export function validatePilotRepository(root: string) {
  const failures: string[] = []
  const configPath = resolve(root, PILOT_CONFIG_FILE)
  if (!existsSync(configPath)) failures.push(`${PILOT_CONFIG_FILE} missing`)
  else failures.push(...validatePilotConfig(readFileSync(configPath, 'utf8')).failures)
  if (!existsSync(resolve(root, PILOT_IDENTITY.buildOutput))) failures.push('dist output missing; run the local build first')
  if (!existsSync(resolve(root, 'functions', 'api'))) failures.push('functions/api missing')
  if (!existsSync(resolve(root, 'shared'))) failures.push('shared directory missing')
  const migrationsPath = resolve(root, PILOT_IDENTITY.migrationsDir)
  const migrations = existsSync(migrationsPath) ? readdirSync(migrationsPath).filter((file) => file.endsWith('.sql')).sort() : []
  if (migrations.length !== 50) failures.push(`migrations: expected 50, got ${migrations.length}`)
  if (migrations.at(-1) !== '0049_client_master_data.sql') failures.push(`last migration: expected 0049_client_master_data.sql, got ${migrations.at(-1) ?? 'none'}`)
  return { ok: failures.length === 0, failures, migrations }
}

function assertFullSha(value: string) {
  if (!/^[0-9a-f]{40}$/i.test(value)) throw new Error('approved HEAD must be a full Git SHA')
}

export function futurePilotMigrationCommand(approvedHead: string) {
  assertFullSha(approvedHead)
  return `CLOUDFLARE_ACCOUNT_ID=${PILOT_IDENTITY.accountId} pnpm exec wrangler d1 migrations apply ${PILOT_IDENTITY.d1Name} --remote --config ${PILOT_CONFIG_FILE}`
}

export function futurePilotPagesDeployCommand(approvedHead: string, stageDirectory = '<PILOT_STAGE_DIR>') {
  assertFullSha(approvedHead)
  return `(cd ${stageDirectory} && CLOUDFLARE_ACCOUNT_ID=${PILOT_IDENTITY.accountId} /private/tmp/sixos-pilot/node_modules/.bin/wrangler pages deploy ${PILOT_IDENTITY.buildOutput} --project-name ${PILOT_IDENTITY.pagesProject} --branch ${PILOT_IDENTITY.branch} --commit-hash ${approvedHead} --commit-dirty=false)`
}
