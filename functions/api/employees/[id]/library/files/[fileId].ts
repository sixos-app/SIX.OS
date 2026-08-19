import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../../../_access'

type LibraryBindings = Bindings & { FILES: R2Bucket }

type FileRow = {
  name: string
  storageKey: string | null
}

export const onRequestGet: PagesFunction<LibraryBindings, 'id' | 'fileId'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.documents.view'))) {
    return permissionRequiredResponse()
  }

  const file = await env.DB.prepare(`
    SELECT files.name, files.storage_key AS storageKey
    FROM employee_library_files AS files
    JOIN employees ON employees.id = files.employee_id
    WHERE files.id = ? AND files.employee_id = ? AND employees.organization_id = ?
    LIMIT 1
  `).bind(params.fileId, params.id, user.organizationId).first<FileRow>()
  if (!file?.storageKey) return Response.json({ error: 'Arquivo não encontrado' }, { status: 404 })

  const object = await env.FILES.get(file.storageKey)
  if (!object) return Response.json({ error: 'Conteúdo não encontrado' }, { status: 404 })

  const safeName = file.name.replace(/[\r\n"]/g, '_')
  
  await env.DB.prepare(`
    INSERT INTO employee_audit_logs (
      id, organization_id, employee_id, actor_user_id, action, field_name, old_value, new_value, details, created_at
    ) VALUES (?, ?, ?, ?, 'file_downloaded', 'document', NULL, ?, ?, ?)
  `).bind(crypto.randomUUID(), user.organizationId, params.id as string, user.id, file.name, `Arquivo acessado/baixado: ${file.name}`, new Date().toISOString()).run()

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}

export const onRequestDelete: PagesFunction<LibraryBindings, 'id' | 'fileId'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.documents.delete'))) {
    return permissionRequiredResponse()
  }

  const file = await env.DB.prepare(`
    SELECT files.name, files.storage_key AS storageKey
    FROM employee_library_files AS files
    JOIN employees ON employees.id = files.employee_id
    WHERE files.id = ? AND files.employee_id = ? AND employees.organization_id = ?
    LIMIT 1
  `).bind(params.fileId, params.id, user.organizationId).first<FileRow>()
  
  if (!file) return Response.json({ error: 'Arquivo não encontrado' }, { status: 404 })

  if (file.storageKey) {
    await env.FILES.delete(file.storageKey)
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM employee_library_files WHERE id = ?').bind(params.fileId),
    env.DB.prepare(`
      INSERT INTO employee_audit_logs (
        id, organization_id, employee_id, actor_user_id, action, field_name, old_value, new_value, details, created_at
      ) VALUES (?, ?, ?, ?, 'file_deleted', 'document', ?, NULL, ?, ?)
    `).bind(crypto.randomUUID(), user.organizationId, params.id as string, user.id, file.name, `Arquivo excluído: ${file.name}`, new Date().toISOString())
  ])

  return new Response(null, { status: 204 })
}
