import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  PILOT_CONFIG_FILE,
  PILOT_IDENTITY,
  type PilotRemoteSnapshot,
  validatePilotConfig,
  validatePilotAccount,
  validatePilotGitState,
  validatePilotRemoteSnapshot,
  validatePilotRepository,
} from './pilot-targeting'

type ApiEnvelope<T> = { success: boolean; errors?: Array<{ message?: string }>; result: T }

type PagesApiProject = {
  id: string
  name: string
  subdomain: string
  source: unknown
  production_branch: string
  deployment_configs?: {
    production?: { d1_databases?: { DB?: { id?: string } }; r2_buckets?: { FILES?: { name?: string } } }
    preview?: { d1_databases?: { DB?: { id?: string } }; r2_buckets?: { FILES?: { name?: string } } }
  }
}

type D1ApiDatabase = { uuid: string; name: string }
type R2ApiBucket = { name: string }

function git(root: string, args: string[]) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trimEnd()
}

export function readPilotGitState(root: string) {
  return {
    branch: git(root, ['branch', '--show-current']),
    head: git(root, ['rev-parse', 'HEAD']),
    porcelain: git(root, ['status', '--porcelain=v1', '--untracked-files=all']),
  }
}

async function cloudflareGet<T>(path: string, token: string) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const payload = await response.json() as ApiEnvelope<T>
  if (!response.ok || !payload.success) {
    const detail = payload.errors?.map((error) => error.message).filter(Boolean).join('; ') || `HTTP ${response.status}`
    throw new Error(`Cloudflare read-only preflight failed: ${detail}`)
  }
  return payload.result
}

async function readPilotRemoteSnapshotWithToken(token: string): Promise<PilotRemoteSnapshot> {
  const base = `/accounts/${PILOT_IDENTITY.accountId}`
  const [pages, d1, r2] = await Promise.all([
    cloudflareGet<PagesApiProject>(`${base}/pages/projects/${PILOT_IDENTITY.pagesProject}`, token),
    cloudflareGet<D1ApiDatabase>(`${base}/d1/database/${PILOT_IDENTITY.d1Id}`, token),
    cloudflareGet<R2ApiBucket>(`${base}/r2/buckets/${PILOT_IDENTITY.r2Bucket}`, token),
  ])
  return {
    pages: {
      id: pages.id,
      name: pages.name,
      subdomain: pages.subdomain,
      source: pages.source,
      productionBranch: pages.production_branch,
      productionD1Id: pages.deployment_configs?.production?.d1_databases?.DB?.id,
      previewD1Id: pages.deployment_configs?.preview?.d1_databases?.DB?.id,
      productionR2Bucket: pages.deployment_configs?.production?.r2_buckets?.FILES?.name,
      previewR2Bucket: pages.deployment_configs?.preview?.r2_buckets?.FILES?.name,
    },
    d1: { id: d1.uuid, name: d1.name },
    r2: { name: r2.name },
  }
}

function jsonObjects(text: string) {
  const objects: unknown[] = []
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue
    let depth = 0
    let inString = false
    let escaped = false
    for (let index = start; index < text.length; index += 1) {
      const character = text[index]
      if (inString) {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === '"') inString = false
        continue
      }
      if (character === '"') inString = true
      else if (character === '{') depth += 1
      else if (character === '}' && --depth === 0) {
        try { objects.push(JSON.parse(text.slice(start, index + 1))) } catch { /* continue scanning */ }
        break
      }
    }
  }
  return objects
}

export function parsePilotPagesDebugSnapshot(text: string) {
  const project = jsonObjects(text).find((value): value is PagesApiProject => {
    const candidate = value as Partial<PagesApiProject>
    return candidate.name === PILOT_IDENTITY.pagesProject && Boolean(candidate.deployment_configs)
  })
  if (!project) throw new Error('Cloudflare read-only preflight failed: Pages project snapshot missing from Wrangler output')
  return project
}

function parseWranglerObject<T>(output: string, label: string, predicate: (value: Record<string, unknown>) => boolean) {
  const object = jsonObjects(output).find((value) => Boolean(value) && typeof value === 'object' && predicate(value as Record<string, unknown>))
  if (!object) throw new Error(`Cloudflare read-only preflight failed: ${label} output was not JSON`)
  return object as T
}

/**
 * OAuth fallback uses Wrangler's existing authenticated session. Debug output is
 * captured only in memory, disk logging is disabled, and the generated config is
 * confined to a 0700 temporary directory removed in finally.
 */
export function readPilotRemoteSnapshotViaWrangler(root: string): PilotRemoteSnapshot {
  const wrangler = resolve(root, 'node_modules', '.bin', 'wrangler')
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'six-os-pilot-pages-snapshot-'))
  chmodSync(temporaryDirectory, 0o700)
  const env = {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: PILOT_IDENTITY.accountId,
    WRANGLER_LOG: 'debug',
    WRANGLER_WRITE_LOGS: 'false',
  }
  try {
    const pagesProcess = spawnSync(wrangler, ['pages', 'download', 'config', PILOT_IDENTITY.pagesProject, '--force'], {
      cwd: temporaryDirectory,
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    })
    if (pagesProcess.status !== 0 || pagesProcess.error) {
      throw new Error(`Cloudflare read-only preflight failed: Wrangler Pages snapshot failed (${pagesProcess.error?.message ?? pagesProcess.status ?? 'unknown'})`)
    }
    const pages = parsePilotPagesDebugSnapshot(`${pagesProcess.stdout ?? ''}\n${pagesProcess.stderr ?? ''}`)
    const d1Output = execFileSync(wrangler, ['d1', 'info', PILOT_IDENTITY.d1Name, '--config', resolve(root, PILOT_CONFIG_FILE), '--json'], { cwd: root, env, encoding: 'utf8' })
    const r2Output = execFileSync(wrangler, ['r2', 'bucket', 'info', PILOT_IDENTITY.r2Bucket, '--config', resolve(root, PILOT_CONFIG_FILE), '--json'], { cwd: root, env, encoding: 'utf8' })
    const d1 = parseWranglerObject<D1ApiDatabase>(d1Output, 'D1 info', (value) => value.uuid === PILOT_IDENTITY.d1Id && value.name === PILOT_IDENTITY.d1Name)
    const r2 = parseWranglerObject<R2ApiBucket>(r2Output, 'R2 info', (value) => value.name === PILOT_IDENTITY.r2Bucket)
    return {
      pages: {
        id: pages.id,
        name: pages.name,
        subdomain: pages.subdomain,
        source: pages.source,
        productionBranch: pages.production_branch,
        productionD1Id: pages.deployment_configs?.production?.d1_databases?.DB?.id,
        previewD1Id: pages.deployment_configs?.preview?.d1_databases?.DB?.id,
        productionR2Bucket: pages.deployment_configs?.production?.r2_buckets?.FILES?.name,
        previewR2Bucket: pages.deployment_configs?.preview?.r2_buckets?.FILES?.name,
      },
      d1: { id: d1.uuid, name: d1.name },
      r2: { name: r2.name },
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

export async function readPilotRemoteSnapshot(token: string, root = process.cwd()): Promise<PilotRemoteSnapshot> {
  return token.trim() ? readPilotRemoteSnapshotWithToken(token) : readPilotRemoteSnapshotViaWrangler(root)
}

function valueArgument(name: string) {
  const prefix = `${name}=`
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

async function main() {
  const root = process.cwd()
  const remoteOnly = process.argv.includes('--remote-only')
  const verifyRemote = remoteOnly || process.argv.includes('--remote')
  const failures: string[] = []
  const report: Record<string, unknown> = {
    mode: remoteOnly ? 'remote-only certification check' : verifyRemote ? 'full local + remote preflight' : 'local preflight',
    readOnly: true,
    accountId: PILOT_IDENTITY.accountId,
  }

  const accountGate = validatePilotAccount(process.env.CLOUDFLARE_ACCOUNT_ID)
  failures.push(...accountGate.failures)

  if (!remoteOnly) {
    const expectedHead = valueArgument('--expected-head') ?? process.env.EXPECTED_HEAD?.trim() ?? ''
    const state = readPilotGitState(root)
    const gitResult = validatePilotGitState(state, expectedHead)
    const repository = validatePilotRepository(root)
    const config = validatePilotConfig(readFileSync(resolve(root, PILOT_CONFIG_FILE), 'utf8'))
    failures.push(...gitResult.failures, ...repository.failures, ...config.failures)
    report.git = { branch: state.branch, head: state.head, clean: !state.porcelain.trim() }
    report.config = config.target
    report.migrations = { count: repository.migrations.length, last: repository.migrations.at(-1) }
    report.functionsIncluded = true
    report.buildOutput = PILOT_IDENTITY.buildOutput
  }

  if (verifyRemote && accountGate.ok) {
    const snapshot = await readPilotRemoteSnapshot(process.env.CLOUDFLARE_API_TOKEN ?? '', root)
    const result = validatePilotRemoteSnapshot(snapshot)
    failures.push(...result.failures)
    report.remote = {
      pages: { name: snapshot.pages.name, id: snapshot.pages.id, domain: snapshot.pages.subdomain },
      d1: snapshot.d1,
      r2: snapshot.r2,
      productionDbBinding: snapshot.pages.productionD1Id,
      previewDbBinding: snapshot.pages.previewD1Id,
      productionFilesBinding: snapshot.pages.productionR2Bucket,
      previewFilesBinding: snapshot.pages.previewR2Bucket,
      productionTarget: 'ABSENT',
    }
  }

  report.result = failures.length === 0 ? 'PASS' : 'FAIL'
  if (failures.length) report.failures = failures
  console.log(JSON.stringify(report, null, 2))
  if (failures.length) process.exitCode = 1
}

if (import.meta.main) await main()
