import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repository = process.cwd()
const migrationDirectory = join(repository, 'migrations')
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'sixos-client-master-migration-'))
const stateDirectory = join(temporaryDirectory, 'state')

function d1(args: string[], json = false) {
  const wranglerBin = join(repository, 'node_modules', '.bin', 'wrangler')
  const output = execFileSync(wranglerBin, ['d1', 'execute', 'six-os', '--local', '--persist-to', stateDirectory, ...args, ...(json ? ['--json'] : [])], {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (!json) return null
  const start = output.indexOf('[')
  const end = output.lastIndexOf(']')
  assert.ok(start >= 0 && end >= start, `Wrangler did not return JSON: ${output}`)
  return JSON.parse(output.slice(start, end + 1)) as Array<{ results?: Array<Record<string, unknown>> }>
}

function execute(sql: string) {
  d1(['--command', sql])
}

function query(sql: string) {
  const rows = d1(['--command', sql], true)?.[0]?.results ?? []
  return rows.map((row) => Object.values(row).map((value) => value === null ? '' : String(value)))
}

function expectFailure(sql: string) {
  assert.throws(() => execute(sql), /Command failed/)
}

function migrationNames() {
  return readdirSync(migrationDirectory).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort()
}

function applyThrough(lastMigration: number) {
  const migrationRoot = join(temporaryDirectory, `migrations-${lastMigration}`)
  const selectedMigrations = migrationNames().filter((name) => Number(name.slice(0, 4)) <= lastMigration)
  mkdirSync(migrationRoot)
  for (const name of selectedMigrations) cpSync(join(migrationDirectory, name), join(migrationRoot, name))

  const configPath = join(temporaryDirectory, `wrangler-${lastMigration}.toml`)
  writeFileSync(configPath, `name = "six-os"\ncompatibility_date = "2026-08-04"\n\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "six-os"\ndatabase_id = "de5f9b02-a8a3-4602-943f-f61bdb524f74"\nmigrations_dir = "migrations-${lastMigration}"\n`)

  const wranglerBin = join(repository, 'node_modules', '.bin', 'wrangler')
  execFileSync(wranglerBin, ['d1', 'migrations', 'apply', 'six-os', '--local', '--persist-to', stateDirectory, '--config', configPath], {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

try {
  // M49-01: full sequence including 0049, then create a representative 0048 dataset.
  applyThrough(48)
  execute(`
    INSERT INTO organizations (id, name, slug) VALUES ('org-a', 'Organization A', 'organization-a'), ('org-b', 'Organization B', 'organization-b');
    INSERT INTO clients (id, organization_id, name, short_code, corporate_name, segment, units, contact_name, contact_email, contact_phone, status, description)
    VALUES ('legacy-client', 'org-a', 'Legacy Client', 'LEG', 'Legacy Legal', 'Services', 'Legacy units', 'Legacy Contact', 'legacy@example.test', '5511999999999', 'active', 'Legacy description'),
           ('client-b', 'org-b', 'Client B', 'CLB', NULL, NULL, NULL, NULL, NULL, NULL, 'active', NULL);
    INSERT INTO contracts (id, organization_id, client_id, monthly_deliverables, hour_limit, agreed_deadline_days, revision_rounds, monthly_balance, contract_value, start_date, end_date, status)
    VALUES ('legacy-contract', 'org-a', 'legacy-client', 5, 10, 3, 2, 4, 1000, '2026-01-01', NULL, 'active');
  `)

  const invalidCnpj = query(`
    SELECT COUNT(*) FROM clients
    WHERE cnpj IS NOT NULL AND (length(cnpj) <> 14 OR cnpj GLOB '*[^0-9]*')
  `)
  const duplicateCnpj = query(`
    SELECT COUNT(*) FROM (
      SELECT organization_id, cnpj FROM clients WHERE cnpj IS NOT NULL GROUP BY organization_id, cnpj HAVING COUNT(*) > 1
    )
  `)
  const inconsistentContracts = query(`
    SELECT COUNT(*) FROM contracts ctr
    WHERE NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = ctr.client_id AND c.organization_id = ctr.organization_id)
  `)
  assert.equal(invalidCnpj[0]?.[0], '0')
  assert.equal(duplicateCnpj[0]?.[0], '0')
  assert.equal(inconsistentContracts[0]?.[0], '0')

  applyThrough(49)

  // M49-02 through M49-04: legacy rows and optional master fields survive 0048 -> 0049.
  const legacy = query("SELECT name, short_code, corporate_name, segment, units, contact_name, contact_email, contact_phone, description FROM clients WHERE id = 'legacy-client'")
  assert.deepEqual(legacy[0], ['Legacy Client', 'LEG', 'Legacy Legal', 'Services', 'Legacy units', 'Legacy Contact', 'legacy@example.test', '5511999999999', 'Legacy description'])
  const optionalClientColumns = ['trade_name', 'state_registration', 'municipal_registration', 'website', 'address_zip_code', 'address_street', 'address_number', 'address_complement', 'address_district', 'address_city', 'address_state', 'address_country']
  const presentClientColumns = query(`SELECT name FROM pragma_table_info('clients') WHERE name IN (${optionalClientColumns.map((column) => `'${column}'`).join(', ')})`).map(([name]) => name)
  assert.deepEqual(presentClientColumns.sort(), [...optionalClientColumns].sort())
  const nullableColumns = query(`SELECT ${optionalClientColumns.join(', ')} FROM clients WHERE id = 'legacy-client'`)[0]
  assert.deepEqual(nullableColumns, Array(optionalClientColumns.length).fill(''))

  // M49-05 through M49-07: contact tenant, boolean and primary-active constraints.
  execute("INSERT INTO client_contacts (id, organization_id, client_id, name, is_primary, is_active) VALUES ('contact-a-1', 'org-a', 'legacy-client', 'Primary', 1, 1)")
  execute("INSERT INTO client_contacts (id, organization_id, client_id, name, is_primary, is_active) VALUES ('contact-a-2', 'org-a', 'legacy-client', 'Secondary', 0, 1)")
  expectFailure("INSERT INTO client_contacts (id, organization_id, client_id, name) VALUES ('contact-cross', 'org-a', 'client-b', 'Cross tenant')")
  expectFailure("INSERT INTO client_contacts (id, organization_id, client_id, name, is_primary) VALUES ('contact-a-primary-2', 'org-a', 'legacy-client', 'Second primary', 1)")
  expectFailure("INSERT INTO client_contacts (id, organization_id, client_id, name, is_active) VALUES ('contact-invalid-bool', 'org-a', 'legacy-client', 'Invalid', 2)")
  execute("UPDATE client_contacts SET is_active = 0 WHERE id = 'contact-a-1'; INSERT INTO client_contacts (id, organization_id, client_id, name, is_primary) VALUES ('contact-a-primary-2', 'org-a', 'legacy-client', 'Replacement primary', 1)")

  // M49-08 through M49-09: contract relation is tenant-safe for insert and update.
  execute("INSERT INTO contracts (id, organization_id, client_id, monthly_deliverables, hour_limit, monthly_balance, contract_value, start_date, status) VALUES ('contract-a', 'org-a', 'legacy-client', 0, 0, 0, 0, '2026-01-01', 'active')")
  expectFailure("INSERT INTO contracts (id, organization_id, client_id, monthly_deliverables, hour_limit, monthly_balance, contract_value, start_date, status) VALUES ('contract-cross', 'org-a', 'client-b', 0, 0, 0, 0, '2026-01-01', 'active')")
  expectFailure("UPDATE contracts SET organization_id = 'org-b' WHERE id = 'contract-a'")

  // M49-10: canonical CNPJ and tenant-local uniqueness.
  execute("INSERT INTO clients (id, organization_id, name, cnpj) VALUES ('cnpj-null', 'org-a', 'Null CNPJ', NULL), ('cnpj-a', 'org-a', 'Canonical CNPJ', '12345678000199'), ('cnpj-b', 'org-b', 'Same Other Tenant', '12345678000199')")
  expectFailure("INSERT INTO clients (id, organization_id, name, cnpj) VALUES ('cnpj-punctuated', 'org-a', 'Punctuated', '12.345.678/0001-99')")
  expectFailure("INSERT INTO clients (id, organization_id, name, cnpj) VALUES ('cnpj-13', 'org-a', 'Thirteen', '1234567800019')")
  expectFailure("INSERT INTO clients (id, organization_id, name, cnpj) VALUES ('cnpj-15', 'org-a', 'Fifteen', '123456780001999')")
  expectFailure("INSERT INTO clients (id, organization_id, name, cnpj) VALUES ('cnpj-alpha', 'org-a', 'Alphabetic', '1234567800019A')")
  expectFailure("INSERT INTO clients (id, organization_id, name, cnpj) VALUES ('cnpj-duplicate', 'org-a', 'Duplicate', '12345678000199')")

  // M49-11: existing contract data is preserved and all schema protections exist.
  assert.deepEqual(query("SELECT monthly_deliverables, hour_limit, agreed_deadline_days, revision_rounds, monthly_balance, contract_value, start_date, end_date, status FROM contracts WHERE id = 'legacy-contract'")[0], ['5', '10', '3', '2', '4', '1000', '2026-01-01', '', 'active'])
  const schemaObjects = query("SELECT name FROM sqlite_master WHERE type IN ('table', 'index', 'trigger') AND name IN ('client_contacts', 'idx_client_contacts_client_active', 'idx_client_contacts_one_primary_active', 'idx_clients_organization_cnpj', 'trg_clients_cnpj_canonical_insert', 'trg_clients_cnpj_canonical_update', 'trg_client_contacts_tenant_insert', 'trg_client_contacts_tenant_update', 'trg_contracts_tenant_insert', 'trg_contracts_tenant_update')").map(([name]) => name)
  assert.equal(schemaObjects.length, 10)
  assert.equal(query("SELECT COUNT(*) FROM permissions WHERE code = 'contracts.manage'")[0]?.[0], '1')
  assert.equal(query("SELECT COUNT(*) FROM profile_permissions WHERE permission_code = 'contracts.manage'")[0]?.[0], '0')
  assert.deepEqual(query('PRAGMA foreign_key_check'), [])

  // M49-12: the full sequence is numerically contiguous through the new migration.
  assert.equal(migrationNames().length, 50)
  assert.equal(migrationNames().filter((name) => name.startsWith('0049_')).length, 1)
  assert.equal(migrationNames().at(-1), '0049_client_master_data.sql')
  console.log('Client master migration: PASS')
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
