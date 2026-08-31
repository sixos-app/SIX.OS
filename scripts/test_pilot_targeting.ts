import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createPilotPagesStage } from './pilot-prepare-pages'
import { parsePilotPagesDebugSnapshot } from './pilot-preflight'
import {
  PILOT_CONFIG_FILE,
  PILOT_IDENTITY,
  futurePilotMigrationCommand,
  futurePilotPagesDeployCommand,
  parsePilotConfig,
  validatePilotAccount,
  validatePilotConfig,
  validatePilotGitState,
  validatePilotRemoteSnapshot,
  validatePilotRepository,
} from './pilot-targeting'

const root = process.cwd()
const approvedHead = 'd553e00a621506841fb482749b1a3ae86e40b3b6'
const pilotConfigText = readFileSync(resolve(root, PILOT_CONFIG_FILE), 'utf8')
const productionConfigText = readFileSync(resolve(root, 'wrangler.toml'), 'utf8')

const pilotConfig = validatePilotConfig(pilotConfigText)
assert.equal(pilotConfig.ok, true, pilotConfig.failures.join('; '))
assert.equal(validatePilotAccount(PILOT_IDENTITY.accountId).ok, true)
assert.equal(validatePilotAccount('wrong-account').ok, false)
assert.equal(validatePilotAccount(undefined).ok, false)
assert.equal(validatePilotConfig(productionConfigText).ok, false, 'production config must never pass as pilot config')
assert.deepEqual(parsePilotConfig(pilotConfigText), {
  pagesProject: PILOT_IDENTITY.pagesProject,
  buildOutput: 'dist',
  d1Binding: 'DB',
  d1Name: PILOT_IDENTITY.d1Name,
  d1Id: PILOT_IDENTITY.d1Id,
  migrationsDir: 'migrations',
  r2Binding: 'FILES',
  r2Bucket: PILOT_IDENTITY.r2Bucket,
})

const repository = validatePilotRepository(root)
assert.equal(repository.ok, true, repository.failures.join('; '))
assert.equal(repository.migrations.length, 50)
assert.equal(repository.migrations.at(-1), '0049_client_master_data.sql')

const remote = {
  pages: {
    id: PILOT_IDENTITY.pagesProjectId,
    name: PILOT_IDENTITY.pagesProject,
    subdomain: PILOT_IDENTITY.pagesDomain,
    source: null,
    productionBranch: PILOT_IDENTITY.branch,
    productionD1Id: PILOT_IDENTITY.d1Id,
    previewD1Id: PILOT_IDENTITY.d1Id,
    productionR2Bucket: PILOT_IDENTITY.r2Bucket,
    previewR2Bucket: PILOT_IDENTITY.r2Bucket,
  },
  d1: { id: PILOT_IDENTITY.d1Id, name: PILOT_IDENTITY.d1Name },
  r2: { name: PILOT_IDENTITY.r2Bucket },
}
assert.equal(validatePilotRemoteSnapshot(remote).ok, true)
assert.equal(validatePilotRemoteSnapshot({ ...remote, pages: { ...remote.pages, source: undefined } }).ok, true)
assert.equal(validatePilotRemoteSnapshot({ ...remote, pages: { ...remote.pages, source: { type: 'github' } } }).ok, false)
assert.equal(validatePilotRemoteSnapshot({ ...remote, pages: { ...remote.pages, id: 'wrong' } }).ok, false)
assert.equal(validatePilotRemoteSnapshot({ ...remote, d1: { ...remote.d1, id: 'wrong' } }).ok, false)
assert.equal(validatePilotRemoteSnapshot({ ...remote, r2: { name: 'wrong' } }).ok, false)

const debugProject = parsePilotPagesDebugSnapshot(`Wrangler debug prefix\n${JSON.stringify({
  id: PILOT_IDENTITY.pagesProjectId,
  name: PILOT_IDENTITY.pagesProject,
  subdomain: PILOT_IDENTITY.pagesDomain,
  source: null,
  production_branch: PILOT_IDENTITY.branch,
  deployment_configs: {
    production: { d1_databases: { DB: { id: PILOT_IDENTITY.d1Id } }, r2_buckets: { FILES: { name: PILOT_IDENTITY.r2Bucket } } },
    preview: { d1_databases: { DB: { id: PILOT_IDENTITY.d1Id } }, r2_buckets: { FILES: { name: PILOT_IDENTITY.r2Bucket } } },
  },
})}\nWrangler debug suffix`)
assert.equal(debugProject.id, PILOT_IDENTITY.pagesProjectId)
assert.throws(() => parsePilotPagesDebugSnapshot('{"name":"six-os"}'), /snapshot missing/)

assert.equal(validatePilotGitState({ branch: PILOT_IDENTITY.branch, head: approvedHead, porcelain: '' }, approvedHead).ok, true)
assert.equal(validatePilotGitState({ branch: 'main', head: approvedHead, porcelain: '' }, approvedHead).ok, false)
assert.equal(validatePilotGitState({ branch: PILOT_IDENTITY.branch, head: approvedHead, porcelain: '?? unsafe' }, approvedHead).ok, false)
assert.equal(validatePilotGitState({ branch: PILOT_IDENTITY.branch, head: approvedHead, porcelain: '' }, 'bad').ok, false)

const migrationCommand = futurePilotMigrationCommand(approvedHead)
assert.match(migrationCommand, /d1 migrations apply six-os-pilot --remote --config wrangler\.pilot\.toml/)
assert.match(migrationCommand, new RegExp(PILOT_IDENTITY.accountId))
assert.doesNotMatch(migrationCommand, /d1 migrations apply six-os(?:\s|$)/)

const pagesCommand = futurePilotPagesDeployCommand(approvedHead)
assert.match(pagesCommand, /<PILOT_STAGE_DIR>/)
assert.match(pagesCommand, /--project-name six-os-pilot/)
assert.match(pagesCommand, /--branch codex\/pilot-environment/)
assert.match(pagesCommand, new RegExp(`--commit-hash ${approvedHead}`))
assert.doesNotMatch(pagesCommand, /--config/)

const temporaryParent = mkdtempSync(join(tmpdir(), 'pilot-targeting-test-'))
try {
  const stage = createPilotPagesStage(root, temporaryParent)
  const stagedConfig = readFileSync(resolve(stage, 'wrangler.toml'), 'utf8')
  assert.equal(validatePilotConfig(stagedConfig).ok, true)
  assert.equal(readFileSync(resolve(stage, 'functions', 'api', 'dashboard.ts'), 'utf8').length > 0, true)
  assert.equal(readFileSync(resolve(stage, 'shared', 'gamificationLevels.ts'), 'utf8').length > 0, true)
  assert.deepEqual(readdirSync(resolve(stage, 'node_modules')), ['jose'])
} finally {
  rmSync(temporaryParent, { recursive: true, force: true })
}

console.log('Pilot targeting: PASS')
