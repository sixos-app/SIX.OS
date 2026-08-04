import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../../../../_access'
import { canAccessProjectLibrary } from '../../../_libraryAccess'

type LibraryBindings = Bindings & { FILES: R2Bucket }

type FileRow = {
  name: string
  storageKey: string | null
}

export const onRequestGet: PagesFunction<LibraryBindings, { id: string; fileId: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const file = await env.DB.prepare(`
    SELECT files.name, files.storage_key AS storageKey
    FROM project_library_files AS files
    JOIN projects ON projects.id = files.project_id
    WHERE files.id = ? AND files.project_id = ? AND projects.organization_id = ?
    LIMIT 1
  `).bind(params.fileId, params.id, user.organizationId).first<FileRow>()
  if (!file?.storageKey) return Response.json({ error: 'Arquivo não encontrado' }, { status: 404 })
  if (!await canAccessProjectLibrary(env, user, params.id)) return permissionRequiredResponse()

  const object = await env.FILES.get(file.storageKey)
  if (!object) return Response.json({ error: 'Conteúdo não encontrado' }, { status: 404 })

  const safeName = file.name.replace(/[\r\n"]/g, '_')
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
