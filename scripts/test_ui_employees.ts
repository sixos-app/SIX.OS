import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const create = readFileSync(resolve(root, 'src/components/admin/AdminUserDialog.tsx'), 'utf8')
const detail = readFileSync(resolve(root, 'src/components/employees/EmployeeDetailsModal.tsx'), 'utf8')
const page = readFileSync(resolve(root, 'src/components/employees/EmployeesPage.tsx'), 'utf8')
const api = readFileSync(resolve(root, 'functions/api/admin/users.ts'), 'utf8')
const styles = readFileSync(resolve(root, 'src/styles.css'), 'utf8')

// E1-E10: structural/modal/accessibility contracts.
for (const source of [create, detail]) {
  assert.match(source, /<ModalShell/)
  assert.match(source, /<ModalHeader/)
  assert.doesNotMatch(source, /mission-(create|details)-(overlay|dialog|scroll|footer)/)
  assert.doesNotMatch(source, /overflowY:\s*'auto'/)
}
assert.match(create, /role="tablist"/)
assert.match(create, /role="tab"/)
assert.match(create, /aria-selected/)
assert.match(create, /departmentId|positionId|professionalLevelId|managerId/)
assert.match(create, /cpf|birthDate|zipCode|salary/)
assert.match(create, /initialPassword/)

// E11-E20: create persistence and tenant/RBAC contracts remain server-side.
assert.match(api, /validateEmployeeRelations/)
assert.match(api, /organization_id/)
assert.match(api, /employee_compensation_history/)
assert.match(api, /hashPassword\(initialPassword\)/)
assert.match(detail, /getEmployeeDetail/)
assert.match(detail, /updateEmployee/)
assert.match(detail, /createEmployeeCompensation/)
assert.match(detail, /getEmployeeLibrary/)

// EP1-EP6: semantic cards plus existing grid/filter behavior.
assert.match(page, /<button[\s\S]*employee-card/)
assert.match(page, /aria-label=\{`Abrir detalhes/)
assert.match(page, /employees-grid/)
assert.match(page, /filterDept|filterStatus|filterContract/)
assert.match(styles, /\.employee-card:focus-visible/)
assert.match(styles, /\.employee-form-grid/)

console.log('Employees UI and persistence contract: PASS')
