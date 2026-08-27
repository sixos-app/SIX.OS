import assert from 'node:assert/strict'
import { onRequestPost as createClient } from '../functions/api/admin/clients.ts'
import { onRequestPatch as patchClient } from '../functions/api/clients/[id].ts'
import { onRequestGet as listLibrary } from '../functions/api/clients/[id]/library.ts'
import { onRequestPost as createFolder } from '../functions/api/clients/[id]/library/folders.ts'
import { onRequestPost as uploadFile } from '../functions/api/clients/[id]/library/upload.ts'
import { onRequestDelete as deleteFile, onRequestGet as downloadFile } from '../functions/api/clients/[id]/library/files/[fileId].ts'

type Scope = 'all' | 'assigned_clients' | 'participating_projects'
type Values = Array<string | number | null>

class Statement {
  constructor(private readonly db: ClientScopeDb, private readonly sql: string, private readonly values: Values = []) {}
  bind(...values: Values) { return new Statement(this.db, this.sql, values) }
  first<T>() { return this.db.first<T>(this.sql, this.values) }
  all<T>() { return this.db.all<T>(this.sql, this.values) }
  run() { return this.db.run(this.sql, this.values) }
}

class ClientScopeDb {
  permissions = new Map<string, Scope>()
  clients = new Map<string, { id: string; organizationId: string; accountManagerId: string | null; description: string | null }>([
    ['client-a', { id: 'client-a', organizationId: 'org-1', accountManagerId: 'user-1', description: null as string | null }],
    ['client-b', { id: 'client-b', organizationId: 'org-1', accountManagerId: 'user-2', description: null as string | null }],
    ['client-foreign', { id: 'client-foreign', organizationId: 'org-2', accountManagerId: 'user-1', description: null as string | null }],
  ])
  participatingClientIds = new Set(['client-a'])
  folders = new Map([['folder-a', { id: 'folder-a', clientId: 'client-a', slug: 'contrato', name: 'Contrato', position: 1 }]])
  files = new Map([['file-a', { id: 'file-a', clientId: 'client-a', folderId: 'folder-a', name: 'contrato.pdf', storageKey: 'org-1/client-a/contrato.pdf', version: 1 }]])
  metadataWrites = 0

  prepare(sql: string) { return new Statement(this, sql) }
  async batch(statements: Statement[]) { return Promise.all(statements.map((statement) => statement.run())) }

  async first<T>(sql: string, values: Values): Promise<T | null> {
    if (sql.includes('FROM auth_sessions')) {
      return { expiresAt: '2099-01-01T00:00:00.000Z', id: 'user-1', organizationId: 'org-1', teamId: null, departmentId: null, accessProfileId: 'profile-1', managerId: null, name: 'Scope User', email: 'scope@six.os', role: 'specialist' } as T
    }
    if (sql.includes('FROM user_permission_overrides')) return null
    if (sql.includes('FROM profile_permissions')) {
      const scope = this.permissions.get(values[0] as string)
      return scope ? { scope } as T : null
    }
    if (sql.includes('account_manager_id = ?')) {
      const client = this.clients.get(values[0] as string)
      return client && client.organizationId === values[1] && client.accountManagerId === values[2] ? { id: client.id } as T : null
    }
    if (sql.includes('JOIN mission_assignees')) {
      const client = this.clients.get(values[0] as string)
      return client && client.organizationId === values[1] && values[2] === 'user-1' && this.participatingClientIds.has(client.id) ? { id: client.id } as T : null
    }
    if (sql.includes('FROM clients WHERE id = ? AND organization_id = ?')) {
      const client = this.clients.get(values[0] as string)
      return client && client.organizationId === values[1] ? { id: client.id } as T : null
    }
    if (sql.includes('FROM client_library_folders WHERE id = ? AND client_id = ?')) {
      const folder = this.folders.get(values[0] as string)
      return folder && folder.clientId === values[1] ? { id: folder.id, slug: folder.slug } as T : null
    }
    if (sql.includes('FROM client_library_folders WHERE client_id = ? AND lower(name)')) return null
    if (sql.includes('COALESCE(MAX(position)')) return { value: 1 } as T
    if (sql.includes('FROM client_library_files files') && sql.includes('JOIN clients')) {
      const file = this.files.get(values[0] as string)
      const client = this.clients.get(values[1] as string)
      return file && client && file.clientId === client.id && client.organizationId === values[2]
        ? { id: file.id, name: file.name, storageKey: file.storageKey, version: file.version } as T : null
    }
    if (sql.includes('FROM client_library_files WHERE client_id = ? AND folder_id = ?')) return null
    return null
  }

  async all<T>(sql: string, values: Values): Promise<{ results: T[] }> {
    if (sql.includes('FROM client_library_file_versions')) {
      const file = this.files.get(values[0] as string)
      return { results: file ? [{ storageKey: file.storageKey } as T] : [] }
    }
    if (sql.includes('FROM client_library_folders folders')) {
      return { results: [...this.folders.values()].filter((folder) => folder.clientId === values[0]).map((folder) => ({ id: folder.id, name: folder.name, slug: folder.slug, fileCount: 0 } as T)) }
    }
    if (sql.includes('FROM client_library_files files')) {
      return { results: [...this.files.values()].filter((file) => file.clientId === values[0]).map((file) => ({ id: file.id, folderId: file.folderId, name: file.name, fileType: 'application/pdf', sizeBytes: 1, storageProvider: 'r2', version: file.version, updatedAt: '2026-01-01', historyCount: 1 } as T)) }
    }
    return { results: [] }
  }

  async run(sql: string, values: Values) {
    if (sql.includes('UPDATE clients SET description')) {
      const client = this.clients.get(values[1] as string)
      if (client?.organizationId === values[2]) { client.description = values[0] as string | null; return { meta: { changes: 1 } } }
      return { meta: { changes: 0 } }
    }
    if (sql.includes('INSERT INTO clients')) {
      this.clients.set(values[0] as string, { id: values[0] as string, organizationId: values[1] as string, accountManagerId: null, description: null })
      return { meta: { changes: 1 } }
    }
    if (sql.includes('INSERT INTO client_library_folders')) {
      this.metadataWrites++
      return { meta: { changes: 1 } }
    }
    if (sql.includes('INSERT INTO client_library_files') || sql.includes('UPDATE client_library_files') || sql.includes('INSERT INTO client_library_file_versions')) {
      this.metadataWrites++
      return { meta: { changes: 1 } }
    }
    if (sql.includes('DELETE FROM client_library_files')) {
      const file = this.files.get(values[0] as string)
      if (file?.clientId === values[1] && file.version === values[2] && file.storageKey === values[3]) { this.files.delete(file.id); return { meta: { changes: 1 } } }
      return { meta: { changes: 0 } }
    }
    return { meta: { changes: 1 } }
  }
}

class TestBucket {
  puts = 0
  deletes = 0
  async put() { this.puts++ }
  async get(key: string) { return { body: new Blob(['file']).stream(), httpMetadata: { contentType: 'application/pdf' }, key } }
  async delete() { this.deletes++ }
}

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Cookie', 'sixos_session=scope-test')
  return new Request(`https://sixos.local${path}`, { ...init, headers })
}

function context(db: ClientScopeDb, bucket = new TestBucket(), params: Record<string, string> = {}, req: Request) {
  return { env: { DB: db, FILES: bucket }, request: req, params } as never
}

async function runTests() {
  // CS1-CS2: all is limited to the current organization.
  {
    const db = new ClientScopeDb(); db.permissions.set('clients.manage', 'all')
    const own = await patchClient(context(db, undefined, { id: 'client-a' }, request('/api/clients/client-a', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: 'Permitido' }) })))
    const foreign = await patchClient(context(db, undefined, { id: 'client-foreign' }, request('/api/clients/client-foreign', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: 'Negado' }) })))
    assert.equal(own.status, 200)
    assert.equal(foreign.status, 404)
  }
  // CS3-CS6: existing client scopes authorize only their actual client relation.
  for (const scope of ['assigned_clients', 'participating_projects'] as Scope[]) {
    const db = new ClientScopeDb(); db.permissions.set('clients.manage', scope)
    const allowed = await patchClient(context(db, undefined, { id: 'client-a' }, request('/api/clients/client-a', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: scope }) })))
    const denied = await patchClient(context(db, undefined, { id: 'client-b' }, request('/api/clients/client-b', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: 'Negado' }) })))
    assert.equal(allowed.status, 200)
    assert.equal(denied.status, 403)
  }
  // CS7-CS8: creation cannot be widened from a restricted scope.
  {
    const allDb = new ClientScopeDb(); allDb.permissions.set('clients.manage', 'all')
    const created = await createClient(context(allDb, undefined, {}, request('/api/admin/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Novo', shortCode: 'NEW' }) })))
    assert.equal(created.status, 201)
    const restrictedDb = new ClientScopeDb(); restrictedDb.permissions.set('clients.manage', 'assigned_clients')
    const rejected = await createClient(context(restrictedDb, undefined, {}, request('/api/admin/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Novo', shortCode: 'NEW' }) })))
    assert.equal(rejected.status, 403)
  }

  // LS1-LS10: every library operation resolves the permission's own client scope.
  {
    const db = new ClientScopeDb(); const bucket = new TestBucket(); db.permissions.set('library.manage', 'assigned_clients'); db.permissions.set('library.view', 'assigned_clients')
    const list = await listLibrary(context(db, bucket, { id: 'client-a' }, request('/api/clients/client-a/library')))
    const folder = await createFolder(context(db, bucket, { id: 'client-a' }, request('/api/clients/client-a/library/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Legal' }) })))
    const download = await downloadFile(context(db, bucket, { id: 'client-a', fileId: 'file-a' }, request('/api/clients/client-a/library/files/file-a')))
    const removed = await deleteFile(context(db, bucket, { id: 'client-a', fileId: 'file-a' }, request('/api/clients/client-a/library/files/file-a', { method: 'DELETE' })))
    assert.equal(list.status, 200)
    assert.equal(folder.status, 201)
    assert.equal(download.status, 200)
    assert.equal(removed.status, 200)
  }
  {
    const db = new ClientScopeDb(); const bucket = new TestBucket(); db.permissions.set('library.manage', 'assigned_clients'); db.permissions.set('library.view', 'assigned_clients')
    const deniedFolder = await createFolder(context(db, bucket, { id: 'client-b' }, request('/api/clients/client-b/library/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Negada' }) })))
    const deniedDownload = await downloadFile(context(db, bucket, { id: 'client-b', fileId: 'file-a' }, request('/api/clients/client-b/library/files/file-a')))
    const deniedDelete = await deleteFile(context(db, bucket, { id: 'client-b', fileId: 'file-a' }, request('/api/clients/client-b/library/files/file-a', { method: 'DELETE' })))
    const foreignFolder = await createFolder(context(db, bucket, { id: 'client-foreign' }, request('/api/clients/client-foreign/library/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Estrangeira' }) })))
    assert.equal(deniedFolder.status, 403)
    assert.equal(deniedDownload.status, 403)
    assert.equal(deniedDelete.status, 403)
    assert.equal(foreignFolder.status, 403)

    const form = new FormData(); form.set('folderId', 'folder-a'); form.set('file', new File(['content'], 'contrato.pdf', { type: 'application/pdf' }))
    const deniedUpload = await uploadFile(context(db, bucket, { id: 'client-b' }, request('/api/clients/client-b/library/upload', { method: 'POST', body: form })))
    assert.equal(deniedUpload.status, 403)
    assert.equal(bucket.puts, 0)
    assert.equal(db.metadataWrites, 0)
  }
  {
    const db = new ClientScopeDb(); const bucket = new TestBucket(); db.permissions.set('library.manage', 'participating_projects'); db.permissions.set('library.view', 'participating_projects')
    const form = new FormData(); form.set('folderId', 'folder-a'); form.set('file', new File(['content'], 'contrato.pdf', { type: 'application/pdf' }))
    const uploaded = await uploadFile(context(db, bucket, { id: 'client-a' }, request('/api/clients/client-a/library/upload', { method: 'POST', body: form })))
    assert.equal(uploaded.status, 200)
    assert.equal(bucket.puts, 1)
    assert.ok(db.metadataWrites >= 2)
    const deniedList = await listLibrary(context(db, bucket, { id: 'client-b' }, request('/api/clients/client-b/library')))
    assert.equal(deniedList.status, 403)
  }
  {
    const db = new ClientScopeDb(); const bucket = new TestBucket(); db.permissions.set('library.manage', 'all'); db.permissions.set('library.view', 'all')
    const mismatchedFile = await downloadFile(context(db, bucket, { id: 'client-b', fileId: 'file-a' }, request('/api/clients/client-b/library/files/file-a')))
    assert.equal(mismatchedFile.status, 404)
  }

  console.log('Client scope security: PASS')
}

runTests().catch((error) => { console.error(error); process.exit(1) })
