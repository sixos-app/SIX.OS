import {
  accessRequiredResponse,
  getAccessUser,
  hasPermissionV2,
  permissionRequiredResponse,
  type Bindings,
} from '../../_access'
import { getEmployeeWithinScope } from '../_documentAccess'

type DocumentBindings = Bindings & { FILES: R2Bucket }

type DocumentRow = {
  id: string
  organizationId: string
  employeeId: string
  folderCategory: string
  fileName: string
  fileType: string
  sizeBytes: number
  uploadedByName: string | null
  createdAt: string
}

export const onRequestGet: PagesFunction<DocumentBindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.documents.view'))) {
    return permissionRequiredResponse()
  }

  const employeeId = params.id as string
  const employee = await getEmployeeWithinScope(env, request, user, employeeId, 'employees.documents.view')
  if (!employee) return Response.json({ error: 'Colaborador não encontrado' }, { status: 404 })

  const docs = await env.DB.prepare(`
    SELECT
      doc.id,
      doc.organization_id AS organizationId,
      doc.employee_id AS employeeId,
      doc.folder_category AS folderCategory,
      doc.file_name AS fileName,
      doc.file_type AS fileType,
      doc.size_bytes AS sizeBytes,
      u.name AS uploadedByName,
      doc.created_at AS createdAt
    FROM employee_documents doc
    LEFT JOIN users u ON u.id = doc.uploaded_by_user_id
    WHERE doc.employee_id = ? AND doc.organization_id = ?
    ORDER BY doc.created_at DESC
  `).bind(employeeId, user.organizationId).all<DocumentRow>()

  return Response.json(docs.results)
}

export const onRequestPost: PagesFunction<DocumentBindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.documents.upload'))) {
    return permissionRequiredResponse()
  }

  const employeeId = params.id as string
  const employee = await getEmployeeWithinScope(env, request, user, employeeId, 'employees.documents.upload')

  if (!employee) return Response.json({ error: 'Colaborador não encontrado.' }, { status: 404 })

  const form = await request.formData()
  const category = form.get('folderCategory')
  const file = form.get('file')

  const validCategories = ['personal', 'contracts', 'payslips', 'medical', 'vacation', 'benefits', 'terms', 'evaluations', 'other']
  const folderCategory = typeof category === 'string' && validCategories.includes(category) ? category : 'other'

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: 'Selecione um arquivo válido.' }, { status: 400 })
  }

  if (file.size > 25 * 1024 * 1024) {
    return Response.json({ error: 'O documento deve ter no máximo 25 MB.' }, { status: 413 })
  }

  const docId = crypto.randomUUID()
  const rawName = file.name.trim().slice(0, 180) || 'documento'
  const safeName = rawName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'documento'
  const storageKey = `organizations/${user.organizationId}/employees/${employee.id}/${folderCategory}/${docId}/${safeName}`
  const now = new Date().toISOString()

  await env.FILES.put(storageKey, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { employeeId: employee.id, organizationId: user.organizationId, docId, folderCategory },
  })

  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO employee_documents (
          id, organization_id, employee_id, folder_category, file_name, storage_key, file_type, size_bytes, uploaded_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        docId,
        user.organizationId,
        employee.id,
        folderCategory,
        rawName,
        storageKey,
        file.type || 'application/octet-stream',
        file.size,
        user.id,
        now,
      ),
      env.DB.prepare(`
        INSERT INTO employee_audit_logs (
          id, organization_id, employee_id, actor_user_id, action, field_name, old_value, new_value, details, created_at
        ) VALUES (?, ?, ?, ?, 'document_uploaded', 'document', NULL, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        user.organizationId,
        employee.id,
        user.id,
        rawName,
        `Upload do documento '${rawName}' na pasta '${folderCategory}' (${Math.round(file.size / 1024)} KB)`,
        now,
      ),
    ])
  } catch (error) {
    try {
      await env.FILES.delete(storageKey)
    } catch (cleanupError) {
      console.error('[files] document upload compensation failed', {
        operation: 'employee_document_upload',
        organizationId: user.organizationId,
        employeeId: employee.id,
        documentId: docId,
        error: cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
      })
    }
    throw error
  }

  return Response.json({
    id: docId,
    fileName: rawName,
    folderCategory,
    sizeBytes: file.size,
    fileType: file.type || 'application/octet-stream',
    createdAt: now,
  }, { status: 201 })
}
