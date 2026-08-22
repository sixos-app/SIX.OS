import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../_access'
import { canAccessClientLibrary } from '../_libraryAccess'

export const onRequestGet: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const canView = await hasPermissionV2(env, request, user, 'library.view')
  const canManage = await hasPermissionV2(env, request, user, 'library.manage')
  if (!canView && !canManage) return permissionRequiredResponse()
  if (!await canAccessClientLibrary(env, request, user, params.id as string)) return permissionRequiredResponse()
  const client = await env.DB.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').bind(params.id, user.organizationId).first<{ id: string }>()
  if (!client) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  const [folders, files] = await Promise.all([
    env.DB.prepare(`SELECT folders.id, folders.name, folders.slug, COUNT(files.id) AS fileCount FROM client_library_folders folders LEFT JOIN client_library_files files ON files.folder_id = folders.id WHERE folders.client_id = ? GROUP BY folders.id ORDER BY folders.position`).bind(client.id).all(),
    env.DB.prepare(`SELECT files.id, files.folder_id AS folderId, files.name, files.file_type AS fileType, files.size_bytes AS sizeBytes, files.storage_provider AS storageProvider, files.version, files.updated_at AS updatedAt, COUNT(versions.id) AS historyCount FROM client_library_files files LEFT JOIN client_library_file_versions versions ON versions.file_id = files.id WHERE files.client_id = ? GROUP BY files.id ORDER BY files.updated_at DESC`).bind(client.id).all(),
  ])
  return Response.json({ folders: folders.results, files: files.results })
}
