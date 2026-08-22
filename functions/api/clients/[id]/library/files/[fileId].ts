import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../../../_access'
import { canAccessClientLibrary } from '../../../_libraryAccess'

type Env = Bindings & { FILES: R2Bucket }

export const onRequestGet: PagesFunction<Env, 'id' | 'fileId'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const canView = await hasPermissionV2(env, request, user, 'library.view')
  const canManage = await hasPermissionV2(env, request, user, 'library.manage')
  if (!canView && !canManage) return permissionRequiredResponse()
  if (!await canAccessClientLibrary(env, request, user, params.id as string)) return permissionRequiredResponse()
  const file = await env.DB.prepare(`SELECT files.name, files.storage_key AS storageKey FROM client_library_files files JOIN clients ON clients.id = files.client_id WHERE files.id = ? AND files.client_id = ? AND clients.organization_id = ?`).bind(params.fileId, params.id, user.organizationId).first<{ name: string; storageKey: string | null }>()
  if (!file?.storageKey) return Response.json({ error: 'Arquivo não encontrado' }, { status: 404 })
  const object = await env.FILES.get(file.storageKey)
  if (!object) return Response.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream'
  const previewRequested = new URL(request.url).searchParams.get('preview') === '1'
  const previewAllowed = /^image\/(png|jpeg|webp|gif|avif)$/i.test(contentType)
  const disposition = previewRequested && previewAllowed ? 'inline' : 'attachment'
  return new Response(object.body, { headers: { 'Content-Type': contentType, 'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'private, no-store' } })
}

export const onRequestDelete: PagesFunction<Env, 'id' | 'fileId'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'library.manage'))) return permissionRequiredResponse()

  const file = await env.DB.prepare(`
    SELECT files.id, files.storage_key AS storageKey
    FROM client_library_files files
    JOIN clients ON clients.id = files.client_id
    WHERE files.id = ? AND files.client_id = ? AND clients.organization_id = ?
    LIMIT 1
  `).bind(params.fileId, params.id, user.organizationId).first<{ id: string; storageKey: string | null }>()
  if (!file) return Response.json({ error: 'Arquivo não encontrado' }, { status: 404 })

  const versions = await env.DB.prepare('SELECT storage_key AS storageKey FROM client_library_file_versions WHERE file_id = ?').bind(file.id).all<{ storageKey: string | null }>()
  const storageKeys = [...new Set([file.storageKey, ...(versions.results ?? []).map((item) => item.storageKey)].filter((key): key is string => Boolean(key)))]

  await env.DB.batch([
    env.DB.prepare('DELETE FROM client_library_file_versions WHERE file_id = ?').bind(file.id),
    env.DB.prepare('DELETE FROM client_library_files WHERE id = ? AND client_id = ?').bind(file.id, params.id),
  ])
  if (storageKeys.length) {
    try {
      await env.FILES.delete(storageKeys)
    } catch (error) {
      console.error('[files] client library cleanup failed', {
        operation: 'client_library_delete',
        organizationId: user.organizationId,
        clientId: params.id,
        fileId: file.id,
        keyCount: storageKeys.length,
        error: error instanceof Error ? error.name : 'UnknownError',
      })
      throw error
    }
  }

  return Response.json({ ok: true })
}
