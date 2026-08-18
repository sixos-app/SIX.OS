import {
  accessRequiredResponse,
  getAccessUser,
  hasPermissionV2,
  permissionRequiredResponse,
  type Bindings,
} from '../../../_access'

type DocumentBindings = Bindings & { FILES: R2Bucket }

type DocumentDetail = {
  id: string
  organizationId: string
  employeeId: string
  folderCategory: string
  fileName: string
  storageKey: string
  fileType: string
  sizeBytes: number
}

export const onRequestGet: PagesFunction<DocumentBindings, 'id' | 'docId'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.documents.view'))) {
    return permissionRequiredResponse()
  }

  const employeeId = params.id as string
  const docId = params.docId as string

  const doc = await env.DB.prepare(`
    SELECT id, organization_id AS organizationId, employee_id AS employeeId,
      folder_category AS folderCategory, file_name AS fileName, storage_key AS storageKey,
      file_type AS fileType, size_bytes AS sizeBytes
    FROM employee_documents
    WHERE id = ? AND employee_id = ? AND organization_id = ?
    LIMIT 1
  `).bind(docId, employeeId, user.organizationId).first<DocumentDetail>()

  if (!doc) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 })

  const object = await env.FILES.get(doc.storageKey)
  if (!object) return Response.json({ error: 'Arquivo não encontrado no armazenamento.' }, { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`)
  headers.set('Cache-Control', 'private, max-age=3600')

  return new Response(object.body, { headers })
}

export const onRequestDelete: PagesFunction<DocumentBindings, 'id' | 'docId'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.documents.delete'))) {
    return permissionRequiredResponse()
  }

  const employeeId = params.id as string
  const docId = params.docId as string

  const doc = await env.DB.prepare(`
    SELECT id, file_name AS fileName, storage_key AS storageKey
    FROM employee_documents
    WHERE id = ? AND employee_id = ? AND organization_id = ?
    LIMIT 1
  `).bind(docId, employeeId, user.organizationId).first<{ id: string; fileName: string; storageKey: string }>()

  if (!doc) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 })

  await env.FILES.delete(doc.storageKey)

  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare('DELETE FROM employee_documents WHERE id = ? AND organization_id = ?').bind(docId, user.organizationId),
    env.DB.prepare(`
      INSERT INTO employee_audit_logs (
        id, organization_id, employee_id, actor_user_id, action, field_name, old_value, new_value, details, created_at
      ) VALUES (?, ?, ?, ?, 'document_deleted', 'document', ?, NULL, ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.organizationId,
      employeeId,
      user.id,
      doc.fileName,
      `Documento '${doc.fileName}' excluído.`,
      now,
    ),
  ])

  return new Response(null, { status: 204 })
}
