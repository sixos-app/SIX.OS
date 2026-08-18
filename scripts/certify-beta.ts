import { execSync } from 'node:child_process'

interface TestGate {
  name: string
  command: string
  category: 'TYPES' | 'SECURITY' | 'WORKFLOW' | 'AGENDA' | 'BUILD'
}

const gates: TestGate[] = [
  { name: 'TypeScript Functions', command: 'tsc -p tsconfig.functions.json', category: 'TYPES' },
  { name: 'TypeScript Scripts', command: 'tsc -p tsconfig.scripts.json', category: 'TYPES' },
  { name: 'RBAC V2 & Access Profiles', command: 'tsx scripts/test_rbac_v2.ts', category: 'SECURITY' },
  { name: 'Security & Tenant Isolation', command: 'tsx scripts/test-security.ts', category: 'SECURITY' },
  { name: 'Work Types Catalog & Multi-tenant Isolation', command: 'tsx scripts/test_work_types_catalog.ts', category: 'SECURITY' },
  { name: 'Employee Financial Lifecycle & Snapshot', command: 'tsx scripts/test_employee_financial_lifecycle.ts', category: 'SECURITY' },
  { name: 'Sector Workflows & Mission Timers', command: 'tsx scripts/test_workflow_lifecycle.ts', category: 'WORKFLOW' },
  { name: 'Operational Missions & Review Cycles', command: 'tsx scripts/test_operational_missions.ts', category: 'WORKFLOW' },
  { name: 'Expanded Agenda & Events', command: 'tsx scripts/test_agenda_expansion.ts', category: 'AGENDA' },
  { name: 'Vite Production Build', command: 'tsc -b && vite build', category: 'BUILD' },
]

async function runCertifyBeta() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║               SIX.OS BETA READINESS CERTIFICATION              ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  const results: Array<{ gate: string; category: string; passed: boolean; durationMs: number; error?: string }> = []
  let allPassed = true

  for (const gate of gates) {
    process.stdout.write(`⏳ Executando: ${gate.name}... `)
    const startTime = Date.now()
    try {
      execSync(gate.command, {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PATH: `./node_modules/.bin:${process.env.PATH}` },
      })
      const durationMs = Date.now() - startTime
      console.log(`✅ APROVADO (${(durationMs / 1000).toFixed(2)}s)`)
      results.push({ gate: gate.name, category: gate.category, passed: true, durationMs })
    } catch (error: any) {
      const durationMs = Date.now() - startTime
      allPassed = false
      const errorMessage = error.stderr?.toString() || error.stdout?.toString() || error.message
      console.log(`❌ REPROVADO (${(durationMs / 1000).toFixed(2)}s)`)
      results.push({ gate: gate.name, category: gate.category, passed: false, durationMs, error: errorMessage })
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log('                    RELATÓRIO DE CERTIFICAÇÃO                    ')
  console.log('══════════════════════════════════════════════════════════════════\n')

  for (const r of results) {
    const statusIcon = r.passed ? '🟢 PASS' : '🔴 FAIL'
    console.log(`[${r.category.padEnd(8)}] ${statusIcon} - ${r.gate} (${(r.durationMs / 1000).toFixed(2)}s)`)
  }

  console.log('\n──────────────────────────────────────────────────────────────────')
  if (allPassed) {
    console.log('🎉 CERTIFICAÇÃO BETA: TODOS OS GATES FORAM APROVADOS COM SUCESSO!')
    console.log('──────────────────────────────────────────────────────────────────\n')
  } else {
    console.error('⚠️ CERTIFICAÇÃO BETA: ALGUNS GATES FALHARAM. VERIFIQUE OS LOGS ACIMA.')
    console.log('──────────────────────────────────────────────────────────────────\n')
    process.exit(1)
  }
}

runCertifyBeta().catch((err) => {
  console.error('Erro fatal ao rodar certificação:', err)
  process.exit(1)
})
