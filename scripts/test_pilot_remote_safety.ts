import assert from 'node:assert/strict'
import { PILOT_IDENTITY } from './pilot-targeting'
import {
  HISTORICAL_SEED_COUNTS,
  REMOTE_BOOTSTRAP_CONFIRMATION,
  createRemoteBootstrapPlan,
  validateHistoricalSeedFingerprint,
  validateRemoteBootstrapIntent,
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
  { pagesName: 'six-os' }, { pagesId: 'wrong' }, { d1Name: 'six-os' }, { d1Id: 'de5f9b02-a8a3-4602-943f-f61bdb524f74' }, { d1Id: 'wrong' }, { r2Bucket: 'six-os-files' }, { accountId: 'wrong' },
  { branch: 'main' }, { expectedHead: 'bad' }, { remoteHead: 'a'.repeat(40) }, { confirmation: '' },
  { git: { branch: PILOT_IDENTITY.branch, head, porcelain: '?? unsafe' } },
]) assert.equal(validateRemoteBootstrapIntent(intent(overrides)).ok, false)

const identity = { organization: 'org-six:agencia-six', user: 'user-agsix-admin:org-six:agsix', adminProfile: 'profile-admin:org-six' }
assert.equal(validateHistoricalSeedFingerprint({ ...HISTORICAL_SEED_COUNTS }, identity).ok, true)
assert.equal(validateHistoricalSeedFingerprint({ ...HISTORICAL_SEED_COUNTS, employees: 0 }, identity).ok, false)
assert.equal(validateHistoricalSeedFingerprint({ ...HISTORICAL_SEED_COUNTS }, { ...identity, organization: 'unexpected:tenant' }).ok, false)

const plan = createRemoteBootstrapPlan()
assert.equal(plan.actualWrites, 0)
assert.match(plan.wouldPreserve.join(' '), /permissions/)
assert.match(plan.wouldCreate.join(' '), /dynamic admin grants/)
console.log('Pilot remote safety: PASS')
