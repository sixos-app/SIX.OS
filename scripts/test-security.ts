import assert from 'node:assert/strict'
import { getAccessUser, type Bindings } from '../functions/api/_access.ts'
import { onRequestGet as getProfile, onRequestPost as updateProfile } from '../functions/api/profile.ts'
import { onRequest as securityMiddleware } from '../functions/_middleware.ts'
import { decryptIntegrationConfig, encryptIntegrationConfig, isAllowedSlackWebhook } from '../functions/api/_integrationSecrets.ts'
import { onRequestGet as searchLibrary } from '../functions/api/library/search.ts'
import { onRequestPost as createProject } from '../functions/api/projects.ts'

const unusedDb = {} as D1Database
const env = { DB: unusedDb } satisfies Bindings

const unauthenticatedGet = await getProfile({
  env,
  request: new Request('https://sixos.app/api/profile'),
} as never)
assert.equal(unauthenticatedGet.status, 401, 'profile GET must reject unauthenticated requests')

const unauthenticatedPost = await updateProfile({
  env,
  request: new Request('https://sixos.app/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ socialName: 'intruder' }),
  }),
} as never)
assert.equal(unauthenticatedPost.status, 401, 'profile POST must reject unauthenticated requests')

const unauthenticatedSearch = await searchLibrary({
  env,
  request: new Request('https://sixos.app/api/library/search?q=contrato'),
} as never)
assert.equal(unauthenticatedSearch.status, 401, 'library search must reject unauthenticated requests')

const unauthenticatedProject = await createProject({
  env,
  request: new Request('https://sixos.app/api/projects', { method: 'POST' }),
} as never)
assert.equal(unauthenticatedProject.status, 401, 'project creation must reject unauthenticated requests')

const spoofedAccessUser = await getAccessUser(new Request('https://sixos.app/api/session', {
  headers: { 'Cf-Access-Authenticated-User-Email': 'agsix@sixos.app' },
}), env)
assert.equal(spoofedAccessUser, null, 'Cloudflare Access e-mail without a signed JWT must not authenticate')

let nextCalled = false
const rejectedOrigin = await securityMiddleware({
  request: new Request('https://sixos.app/api/profile', {
    method: 'POST',
    headers: { Origin: 'https://sixos.app.evil.example' },
  }),
  env,
  next: async () => {
    nextCalled = true
    return new Response(null, { status: 204 })
  },
} as never)
assert.equal(rejectedOrigin.status, 403, 'lookalike origins must be rejected')
assert.equal(nextCalled, false, 'rejected origins must not reach the route')

const acceptedOrigin = await securityMiddleware({
  request: new Request('https://sixos.app/api/profile', {
    method: 'POST',
    headers: { Origin: 'https://sixos.app' },
  }),
  env,
  next: async () => new Response(null, { status: 204 }),
} as never)
assert.equal(acceptedOrigin.status, 204, 'the exact application origin must be accepted')

const secretEnv = {
  DB: unusedDb,
  INTEGRATIONS_ENCRYPTION_KEY: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
} satisfies Bindings
const encrypted = await encryptIntegrationConfig(secretEnv, { token: 'sensitive-value' })
assert.ok(encrypted.startsWith('enc:v1:'), 'integration configuration must be encrypted')
assert.ok(!encrypted.includes('sensitive-value'), 'ciphertext must not contain the plaintext')
assert.deepEqual(await decryptIntegrationConfig(secretEnv, encrypted), { token: 'sensitive-value' })
assert.equal(isAllowedSlackWebhook('https://hooks.slack.com/services/T/B/X'), true)
assert.equal(isAllowedSlackWebhook('https://hooks.slack.com.evil.example/services/T/B/X'), false)

console.log('Security regression tests passed.')
