import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../../_access'
import { canAccessProjectLibrary } from '../_libraryAccess'

type ProjectRow = { id: string }

type FolderRow = {
  id: string
  name: string
  slug: string
  fileCount: number
}

type FileRow = {
  id: string
  folderId: string | null
  name: string
  fileType: string
  sizeBytes: number | null
  storageProvider: 'pending' | 'r2' | 'mega_link'
  version: number
  updatedAt: string
  historyCount: number
}

export const onRequestGet: PagesFunction<Bindings, { id: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const project = await env.DB.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ? LIMIT 1')
    .bind(params.id, user.organizationId)
    .first<ProjectRow>()

  if (!project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })
  if (!await canAccessProjectLibrary(env, request, user, project.id)) return permissionRequiredResponse()

  const [folderResult, fileResult] = await Promise.all([
    env.DB.prepare(`
      SELECT folders.id, folders.name, folders.slug, COUNT(files.id) AS fileCount
      FROM project_library_folders AS folders
      LEFT JOIN project_library_files AS files ON files.folder_id = folders.id
      WHERE folders.project_id = ?
      GROUP BY folders.id
      ORDER BY folders.position, folders.name
    `).bind(project.id).all<FolderRow>(),
    env.DB.prepare(`
      SELECT
        files.id,
        files.folder_id AS folderId,
        files.name,
        files.file_type AS fileType,
        files.size_bytes AS sizeBytes,
        files.storage_provider AS storageProvider,
        files.version,
        files.updated_at AS updatedAt,
        COUNT(versions.id) AS historyCount
      FROM project_library_files AS files
      LEFT JOIN project_library_file_versions AS versions ON versions.file_id = files.id
      WHERE files.project_id = ?
      GROUP BY files.id
      ORDER BY files.updated_at DESC
    `).bind(project.id).all<FileRow>(),
  ])

  return Response.json({ folders: folderResult.results, files: fileResult.results })
}
