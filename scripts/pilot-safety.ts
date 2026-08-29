export const PRODUCTION_DENYLIST = Object.freeze({
  pagesProject: 'six-os',
  d1Name: 'six-os',
  d1Id: 'de5f9b02-a8a3-4602-943f-f61bdb524f74',
  r2Bucket: 'six-os-files',
  domain: 'sixos.app',
  branch: 'main',
})

export const PILOT_RESOURCE_NAMES = Object.freeze({
  pagesProject: 'six-os-pilot',
  d1Name: 'six-os-pilot',
  r2Bucket: 'six-os-files-pilot',
  branch: 'codex/pilot-environment',
})

export type PilotMode = 'local' | 'remote'

export type PilotTarget = {
  pagesProject: string
  d1Name: string
  d1Id?: string
  r2Bucket: string
  branch: string
  mode: PilotMode
  confirmed: boolean
}

export type PilotSafetyOptions = {
  /** The UUID recorded only when the isolated D1 is actually created. */
  expectedRemoteD1Id?: string
}

function normalized(value: string | undefined) {
  return value?.trim().toLocaleLowerCase('en-US') ?? ''
}

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

export function validatePilotTarget(target: PilotTarget, options: PilotSafetyOptions = {}) {
  const values = {
    pagesProject: normalized(target.pagesProject),
    d1Name: normalized(target.d1Name),
    d1Id: normalized(target.d1Id),
    r2Bucket: normalized(target.r2Bucket),
    branch: target.branch.trim(),
  }

  // Denylist always wins, even when every other field looks like Pilot.
  if (values.pagesProject === PRODUCTION_DENYLIST.pagesProject
    || values.d1Name === PRODUCTION_DENYLIST.d1Name
    || values.d1Id === PRODUCTION_DENYLIST.d1Id
    || values.r2Bucket === PRODUCTION_DENYLIST.r2Bucket
    || values.branch === PRODUCTION_DENYLIST.branch) {
    return { allowed: false as const, reason: 'production target denied' }
  }

  if (!target.confirmed) return { allowed: false as const, reason: 'explicit confirmation required' }
  if (target.mode !== 'local' && target.mode !== 'remote') return { allowed: false as const, reason: 'invalid execution mode' }
  if (values.pagesProject !== PILOT_RESOURCE_NAMES.pagesProject
    || values.d1Name !== PILOT_RESOURCE_NAMES.d1Name
    || values.r2Bucket !== PILOT_RESOURCE_NAMES.r2Bucket
    || values.branch !== PILOT_RESOURCE_NAMES.branch) {
    return { allowed: false as const, reason: 'pilot resource contract mismatch' }
  }

  if (target.mode === 'local') return { allowed: true as const }

  if (!options.expectedRemoteD1Id || !isUuid(options.expectedRemoteD1Id)) {
    return { allowed: false as const, reason: 'registered pilot D1 UUID required for remote mode' }
  }
  if (!isUuid(target.d1Id) || values.d1Id !== normalized(options.expectedRemoteD1Id)) {
    return { allowed: false as const, reason: 'pilot D1 UUID mismatch' }
  }

  // PILOT-1B intentionally provides no remote executor. A later approved phase
  // must opt in separately after the actual UUID has been recorded.
  return { allowed: false as const, reason: 'remote writes are disabled by default' }
}

export function assertPilotTarget(target: PilotTarget, options?: PilotSafetyOptions) {
  const result = validatePilotTarget(target, options)
  if (!result.allowed) throw new Error(`PILOT SAFETY ABORT: ${result.reason}`)
}
