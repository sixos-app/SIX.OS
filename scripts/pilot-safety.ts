import { PILOT_IDENTITY } from './pilot-targeting'

export const PRODUCTION_DENYLIST = Object.freeze({
  pagesProject: 'six-os',
  d1Name: 'six-os',
  d1Id: 'de5f9b02-a8a3-4602-943f-f61bdb524f74',
  r2Bucket: 'six-os-files',
  domain: 'sixos.app',
  branch: 'main',
})

export const PILOT_RESOURCE_NAMES = Object.freeze({
  accountId: PILOT_IDENTITY.accountId,
  pagesProject: PILOT_IDENTITY.pagesProject,
  pagesProjectId: PILOT_IDENTITY.pagesProjectId,
  d1Name: PILOT_IDENTITY.d1Name,
  d1Id: PILOT_IDENTITY.d1Id,
  r2Bucket: PILOT_IDENTITY.r2Bucket,
  branch: PILOT_IDENTITY.branch,
})

export type PilotMode = 'local' | 'remote'

export type PilotTarget = {
  accountId?: string
  pagesProject: string
  pagesProjectId?: string
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
  /** Explicit executor opt-in. Omission keeps every remote write disabled. */
  allowRemoteWrite?: boolean
}

function normalized(value: string | undefined) {
  return value?.trim().toLocaleLowerCase('en-US') ?? ''
}

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

export function validatePilotTarget(target: PilotTarget, options: PilotSafetyOptions = {}) {
  const values = {
    accountId: normalized(target.accountId),
    pagesProject: normalized(target.pagesProject),
    pagesProjectId: normalized(target.pagesProjectId),
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

  if (values.accountId !== PILOT_IDENTITY.accountId || values.pagesProjectId !== PILOT_IDENTITY.pagesProjectId) {
    return { allowed: false as const, reason: 'pilot account or Pages project ID mismatch' }
  }
  if (!options.expectedRemoteD1Id || !isUuid(options.expectedRemoteD1Id)) {
    return { allowed: false as const, reason: 'registered pilot D1 UUID required for remote mode' }
  }
  if (!isUuid(target.d1Id) || values.d1Id !== normalized(options.expectedRemoteD1Id)) {
    return { allowed: false as const, reason: 'pilot D1 UUID mismatch' }
  }

  if (!options.allowRemoteWrite) return { allowed: false as const, reason: 'remote writes are disabled by default' }
  return { allowed: true as const }
}

export function assertPilotTarget(target: PilotTarget, options?: PilotSafetyOptions) {
  const result = validatePilotTarget(target, options)
  if (!result.allowed) throw new Error(`PILOT SAFETY ABORT: ${result.reason}`)
}
