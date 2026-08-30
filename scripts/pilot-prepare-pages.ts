import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PILOT_CONFIG_FILE, PILOT_IDENTITY, futurePilotPagesDeployCommand, validatePilotConfig, validatePilotRepository } from './pilot-targeting'
import { readPilotGitState } from './pilot-preflight'
import { validatePilotGitState } from './pilot-targeting'

export function createPilotPagesStage(root: string, parent = tmpdir()) {
  const repository = validatePilotRepository(root)
  if (!repository.ok) throw new Error(`PILOT STAGE ABORT: ${repository.failures.join('; ')}`)
  const stage = mkdtempSync(join(parent, 'six-os-pilot-pages-'))
  for (const directory of [PILOT_IDENTITY.buildOutput, 'functions', 'shared', PILOT_IDENTITY.migrationsDir]) {
    cpSync(resolve(root, directory), resolve(stage, directory), { recursive: true })
  }
  cpSync(resolve(root, PILOT_CONFIG_FILE), resolve(stage, 'wrangler.toml'))
  cpSync(resolve(root, 'package.json'), resolve(stage, 'package.json'))
  // Wrangler itself is invoked from the approved worktree. The stage only needs
  // the Functions runtime dependency, not a copy or link of all node_modules.
  mkdirSync(resolve(stage, 'node_modules'))
  symlinkSync(resolve(root, 'node_modules', 'jose'), resolve(stage, 'node_modules', 'jose'), 'dir')
  const stagedConfig = validatePilotConfig(readFileSync(resolve(stage, 'wrangler.toml'), 'utf8'))
  if (!stagedConfig.ok) throw new Error(`PILOT STAGE ABORT: ${stagedConfig.failures.join('; ')}`)
  if (!existsSync(resolve(stage, 'functions', 'api'))) throw new Error('PILOT STAGE ABORT: functions/api missing')
  return stage
}

function argument(name: string) {
  const prefix = `${name}=`
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? ''
}

if (import.meta.main) {
  const root = process.cwd()
  const expectedHead = argument('--expected-head') || process.env.EXPECTED_HEAD?.trim() || ''
  const state = readPilotGitState(root)
  const gate = validatePilotGitState(state, expectedHead)
  if (!gate.ok) {
    console.error(`PILOT STAGE ABORT: ${gate.failures.join('; ')}`)
    process.exitCode = 1
  } else {
    const stage = createPilotPagesStage(root)
    writeFileSync(resolve(stage, '.pilot-stage.json'), `${JSON.stringify({
      accountId: PILOT_IDENTITY.accountId,
      pagesProject: PILOT_IDENTITY.pagesProject,
      pagesProjectId: PILOT_IDENTITY.pagesProjectId,
      branch: PILOT_IDENTITY.branch,
      head: state.head,
      remoteWriter: false,
    }, null, 2)}\n`)
    console.log(JSON.stringify({
      result: 'PASS',
      remoteWriter: false,
      stage,
      futureCommandNotExecuted: futurePilotPagesDeployCommand(state.head, stage),
    }, null, 2))
  }
}
