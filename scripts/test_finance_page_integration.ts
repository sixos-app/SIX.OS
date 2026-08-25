import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function runTests() {
  const [appShell, financePage] = await Promise.all([
    readFile(new URL('../src/components/AppShell.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/finance/FinancePage.tsx', import.meta.url), 'utf8'),
  ])

  // F1-F4 / FP1-FP2: finance is exposed only to finance.view/manage and routes to the page.
  assert.match(appShell, /can\('finance\.view'\) \|\| can\('finance\.manage'\)/)
  assert.match(appShell, /activeSection === 'finance' && \(can\('finance\.view'\) \|\| can\('finance\.manage'\)\)/)
  assert.match(appShell, /<FinancePage \/>/)
  assert.ok(appShell.indexOf("activeSection === 'finance'") < appShell.lastIndexOf('<ComingSoon'), 'FinancePage must render before the fallback')

  // FP3-FP10: the page consumes only the existing Cost Center API and handles each outcome.
  assert.match(financePage, /type LoadState = 'loading' \| 'ready' \| 'empty' \| 'unauthenticated' \| 'forbidden' \| 'error'/)
  assert.match(financePage, /fetch\('\/api\/cost-centers'/)
  assert.match(financePage, /method: 'POST'/)
  assert.match(financePage, /method: 'DELETE'/)
  assert.match(financePage, /ConfirmActionModal/)
  assert.match(financePage, /can\('finance\.manage'\) && hasScope\('finance\.manage', 'all'\)/)
  assert.match(financePage, /response\.status === 401/)
  assert.match(financePage, /response\.status === 403/)
  assert.doesNotMatch(financePage, /invoice/i)
  assert.doesNotMatch(financePage, /Em breve/)

  console.log('Finance page integration: PASS')
}

runTests().catch((error) => {
  console.error(error)
  process.exit(1)
})
