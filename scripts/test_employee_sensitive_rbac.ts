import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const sensitive = readFileSync(resolve(root, 'functions/api/_employeeSensitive.ts'), 'utf8')
const create = readFileSync(resolve(root, 'functions/api/admin/users.ts'), 'utf8')
const update = readFileSync(resolve(root, 'functions/api/employees/[id].ts'), 'utf8')
const createUi = readFileSync(resolve(root, 'src/components/admin/AdminUserDialog.tsx'), 'utf8')
const editUi = readFileSync(resolve(root, 'src/components/employees/EmployeeDetailsModal.tsx'), 'utf8')

assert.match(sensitive, /employeeSensitiveFields/)
for (const field of ['cpf', 'birthDate', 'personalEmail', 'zipCode', 'country']) assert.match(sensitive, new RegExp(`'${field}'`))
assert.match(create, /hasSensitiveEmployeeFields\(employee\)/)
assert.match(create, /employees\.edit_sensitive/)
assert.match(create, /status: 403/)
assert.match(update, /hasSensitiveEmployeeFields\(body\)/)
assert.match(update, /status: 403/)
assert.doesNotMatch(update, /if \(isSensitive && !canEditSensitive\) return/)
assert.match(createUi, /canEditSensitive/)
assert.match(createUi, /allowedEmployee/)
assert.match(createUi, /canEditSensitive \? \[\['personal'/)
assert.match(createUi, /canEditSensitive \? \[\['address'/)
assert.match(editUi, /sensitiveEmployeeFields/)
assert.match(editUi, /Object\.fromEntries/)
assert.match(editUi, /can\('employees\.edit_sensitive'\) && <button/)
console.log('Employee sensitive RBAC contract: PASS')
