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

async function middlewareRequest({
  requestUrl,
  method = 'POST',
  origin,
  referer,
}: {
  requestUrl: string
  method?: string
  origin?: string
  referer?: string
}) {
  let nextCalled = false
  const headers = new Headers()
  if (origin !== undefined) headers.set('Origin', origin)
  if (referer !== undefined) headers.set('Referer', referer)
  const response = await securityMiddleware({
    request: new Request(requestUrl, { method, headers }),
    env,
    next: async () => {
      nextCalled = true
      return new Response(null, { status: 204 })
    },
  } as never)
  return { response, nextCalled }
}

for (const [label, requestUrl, origin] of [
  ['production apex', 'https://sixos.app/api/profile', 'https://sixos.app'],
  ['production www', 'https://www.sixos.app/api/profile', 'https://www.sixos.app'],
  ['pilot Pages', 'https://six-os-pilot.pages.dev/api/profile', 'https://six-os-pilot.pages.dev'],
] as const) {
  const { response, nextCalled } = await middlewareRequest({ requestUrl, origin })
  assert.equal(response.status, 204, `${label} same-origin request must be accepted`)
  assert.equal(nextCalled, true, `${label} same-origin request must reach the route`)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), new URL(requestUrl).origin, `${label} must only emit its validated request origin`)
  assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), '*', `${label} must never emit a wildcard origin`)
}

for (const [label, requestUrl, origin] of [
  ['production origin on pilot', 'https://six-os-pilot.pages.dev/api/profile', 'https://sixos.app'],
  ['production malicious suffix', 'https://sixos.app/api/profile', 'https://sixos.app.evil.example'],
  ['pilot malicious suffix', 'https://six-os-pilot.pages.dev/api/profile', 'https://six-os-pilot.pages.dev.evil.example'],
  ['scheme mismatch', 'https://sixos.app/api/profile', 'http://sixos.app'],
  ['port mismatch', 'https://sixos.app/api/profile', 'https://sixos.app:8443'],
  ['origin with path', 'https://sixos.app/api/profile', 'https://sixos.app/path'],
  ['malformed origin', 'https://sixos.app/api/profile', 'not a valid origin'],
  ['null origin', 'https://sixos.app/api/profile', 'null'],
] as const) {
  const { response, nextCalled } = await middlewareRequest({ requestUrl, origin })
  assert.equal(response.status, 403, `${label} must be rejected`)
  assert.equal(nextCalled, false, `${label} must not reach the route`)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null, `${label} must not receive a CORS allow header`)
}

const validReferer = await middlewareRequest({
  requestUrl: 'https://six-os-pilot.pages.dev/api/profile',
  referer: 'https://six-os-pilot.pages.dev/profile?tab=security',
})
assert.equal(validReferer.response.status, 204, 'same-origin Referer fallback must be accepted')
assert.equal(validReferer.nextCalled, true, 'same-origin Referer fallback must reach the route')

for (const [label, referer] of [
  ['cross-origin Referer', 'https://sixos.app/profile'],
  ['malicious Referer suffix', 'https://six-os-pilot.pages.dev.evil.example/profile'],
  ['malformed Referer', 'not a valid referer'],
] as const) {
  const { response, nextCalled } = await middlewareRequest({
    requestUrl: 'https://six-os-pilot.pages.dev/api/profile',
    referer,
  })
  assert.equal(response.status, 403, `${label} must be rejected`)
  assert.equal(nextCalled, false, `${label} must not reach the route`)
}

const missingOriginAndReferer = await middlewareRequest({ requestUrl: 'https://sixos.app/api/profile' })
assert.equal(missingOriginAndReferer.response.status, 403, 'state-changing API request without Origin or Referer must be rejected')
assert.equal(missingOriginAndReferer.nextCalled, false)

const validPreflight = await middlewareRequest({
  requestUrl: 'https://six-os-pilot.pages.dev/api/profile',
  method: 'OPTIONS',
  origin: 'https://six-os-pilot.pages.dev',
})
assert.equal(validPreflight.response.status, 204)
assert.equal(validPreflight.response.headers.get('Access-Control-Allow-Origin'), 'https://six-os-pilot.pages.dev')
assert.equal(validPreflight.nextCalled, false)

const invalidPreflight = await middlewareRequest({
  requestUrl: 'https://six-os-pilot.pages.dev/api/profile',
  method: 'OPTIONS',
  origin: 'https://evil.example',
})
assert.equal(invalidPreflight.response.status, 204, 'invalid preflight preserves the existing no-CORS response contract')
assert.equal(invalidPreflight.response.headers.get('Access-Control-Allow-Origin'), null)
assert.equal(invalidPreflight.nextCalled, false)

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
