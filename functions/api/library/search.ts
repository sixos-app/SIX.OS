import { getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

type LibrarySearchResult = {
  id: string
  title: string
  type: string
  project: string
  client: string
  snippet: string
  updatedAt: string
}

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  if (!(await hasPermissionV2(env, request, user, 'library.view'))) return permissionRequiredResponse()

  const query = (new URL(request.url).searchParams.get('q') || '').trim()
  if (query.length < 2 || query.length > 120) {
    return Response.json({ error: 'A busca deve conter entre 2 e 120 caracteres.' }, { status: 400 })
  }

  const term = `%${query}%`
  const { results } = await env.DB.prepare(`
    SELECT * FROM (
      SELECT
        'project:' || files.id AS id,
        files.name AS title,
        files.file_type AS type,
        projects.name AS project,
        clients.name AS client,
        COALESCE(folders.name, 'Sem pasta') || ' · versão ' || files.version AS snippet,
        files.updated_at AS updatedAt
      FROM project_library_files files
      JOIN projects ON projects.id = files.project_id
      JOIN clients ON clients.id = projects.client_id
      LEFT JOIN project_library_folders folders ON folders.id = files.folder_id
      WHERE projects.organization_id = ?
        AND (files.name LIKE ? OR files.file_type LIKE ? OR projects.name LIKE ? OR clients.name LIKE ? OR folders.name LIKE ?)

      UNION ALL

      SELECT
        'client:' || files.id AS id,
        files.name AS title,
        files.file_type AS type,
        'Biblioteca do cliente' AS project,
        clients.name AS client,
        COALESCE(folders.name, 'Sem pasta') || ' · versão ' || files.version AS snippet,
        files.updated_at AS updatedAt
      FROM client_library_files files
      JOIN clients ON clients.id = files.client_id
      LEFT JOIN client_library_folders folders ON folders.id = files.folder_id
      WHERE clients.organization_id = ?
        AND (files.name LIKE ? OR files.file_type LIKE ? OR clients.name LIKE ? OR folders.name LIKE ?)
    )
    ORDER BY updatedAt DESC
    LIMIT 50
  `).bind(
    user.organizationId, term, term, term, term, term,
    user.organizationId, term, term, term, term,
  ).all<LibrarySearchResult>()

  return Response.json({ query, results })
}
