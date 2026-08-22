import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../_access'
import { getEmployeeWithinScope } from '../_documentAccess'

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

export const onRequestGet: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  if (!(await hasPermissionV2(env, request, user, 'employees.documents.view'))) {
    return permissionRequiredResponse()
  }

  const employee = await getEmployeeWithinScope(env, request, user, params.id as string, 'employees.documents.view')

  if (!employee) return Response.json({ error: 'Colaborador não encontrado' }, { status: 404 })

  const [folderResult, fileResult] = await Promise.all([
    env.DB.prepare(`
      SELECT folders.id, folders.name, folders.slug, COUNT(files.id) AS fileCount
      FROM employee_library_folders AS folders
      LEFT JOIN employee_library_files AS files ON files.folder_id = folders.id
      WHERE folders.employee_id = ?
      GROUP BY folders.id
      ORDER BY folders.position, folders.name
    `).bind(employee.id).all<FolderRow>(),
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
      FROM employee_library_files AS files
      LEFT JOIN employee_library_file_versions AS versions ON versions.file_id = files.id
      WHERE files.employee_id = ?
      GROUP BY files.id
      ORDER BY files.updated_at DESC
    `).bind(employee.id).all<FileRow>(),
  ])

  return Response.json({ folders: folderResult.results, files: fileResult.results })
}
