import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../../_access'
import { getEmployeeWithinScope } from '../../_documentAccess'

type LibraryBindings = Bindings & { FILES: R2Bucket }

type FolderRow = { id: string; slug: string }
type ExistingFileRow = { id: string; version: number }

function fileTypeFrom(file: File) {
  if (file.type) return file.type
  const extension = file.name.split('.').pop()?.toLocaleUpperCase('en-US')
  return extension ? `.${extension}` : 'Arquivo'
}

function storageFileName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'arquivo'
}

export const onRequestPost: PagesFunction<LibraryBindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.documents.upload'))) {
    return permissionRequiredResponse()
  }

  const employee = await getEmployeeWithinScope(env, request, user, params.id as string, 'employees.documents.upload')
  if (!employee) return Response.json({ error: 'Colaborador não encontrado' }, { status: 404 })

  const form = await request.formData()
  const folderId = form.get('folderId')
  const file = form.get('file')
  if (typeof folderId !== 'string' || !folderId || !(file instanceof File) || file.size === 0) return Response.json({ error: 'Selecione uma pasta e um arquivo válido' }, { status: 400 })
  if (file.size > 25 * 1024 * 1024) return Response.json({ error: 'O arquivo deve ter no máximo 25 MB' }, { status: 413 })

  const folder = await env.DB.prepare('SELECT id, slug FROM employee_library_folders WHERE id = ? AND employee_id = ? LIMIT 1')
    .bind(folderId, employee.id)
    .first<FolderRow>()
  if (!folder) return Response.json({ error: 'Pasta não encontrada neste colaborador' }, { status: 404 })

  const name = file.name.trim().slice(0, 180)
  if (!name) return Response.json({ error: 'O arquivo precisa ter um nome válido' }, { status: 400 })

  const existingFile = await env.DB.prepare(`
    SELECT id, version
    FROM employee_library_files
    WHERE employee_id = ? AND folder_id = ? AND name = ?
    LIMIT 1
  `).bind(employee.id, folder.id, name).first<ExistingFileRow>()

  const fileId = existingFile?.id ?? crypto.randomUUID()
  const version = (existingFile?.version ?? 0) + 1
  const storageKey = `organizations/${user.organizationId}/employees/${employee.id}/${folder.slug}/${fileId}/v${version}/${storageFileName(name)}`
  const now = new Date().toISOString()

  await env.FILES.put(storageKey, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { employeeId: employee.id, folderId: folder.id, fileId, version: String(version) },
  })

  try {
    const statements = [
      existingFile
        ? env.DB.prepare(`UPDATE employee_library_files SET file_type = ?, size_bytes = ?, storage_provider = 'r2', storage_key = ?, version = ?, created_by_user_id = ?, updated_at = ? WHERE id = ?`)
          .bind(fileTypeFrom(file), file.size, storageKey, version, user.id, now, fileId)
        : env.DB.prepare(`INSERT INTO employee_library_files (id, employee_id, folder_id, name, file_type, size_bytes, storage_provider, storage_key, version, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'r2', ?, ?, ?, ?, ?)`)
          .bind(fileId, employee.id, folder.id, name, fileTypeFrom(file), file.size, storageKey, version, user.id, now, now),
      env.DB.prepare(`INSERT INTO employee_library_file_versions (id, file_id, version, storage_key, size_bytes, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), fileId, version, storageKey, file.size, user.id, now),
      env.DB.prepare(`
        INSERT INTO employee_audit_logs (
          id, organization_id, employee_id, actor_user_id, action, field_name, old_value, new_value, details, created_at
        ) VALUES (?, ?, ?, ?, 'file_uploaded', 'document', NULL, ?, ?, ?)
      `).bind(crypto.randomUUID(), user.organizationId, employee.id, user.id, name, `Upload realizado: ${name} (v${version})`, now)
    ]
    await env.DB.batch(statements)
  } catch (error) {
    await env.FILES.delete(storageKey)
    throw error
  }

  return Response.json({
    file: { id: fileId, folderId: folder.id, name, fileType: fileTypeFrom(file), sizeBytes: file.size, storageProvider: 'r2', version, updatedAt: now, historyCount: version },
  }, { status: existingFile ? 200 : 201 })
}
