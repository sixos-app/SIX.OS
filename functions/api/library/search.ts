import { getAccessUser, getPermissionScope, permissionRequiredResponse, type Bindings } from '../_access'

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
  const scope = await getPermissionScope(env, request, user, 'library.view')
  if (!scope) return permissionRequiredResponse()

  let projectScopeFilter = ''
  let projectScopeBinds: string[] = []
  let clientScopeFilter = ''
  let clientScopeBinds: string[] = []

  if (scope === 'assigned_clients') {
    projectScopeFilter = ' AND clients.account_manager_id = ?'
    projectScopeBinds = [user.id]
    clientScopeFilter = ' AND clients.account_manager_id = ?'
    clientScopeBinds = [user.id]
  } else if (scope === 'participating_projects') {
    projectScopeFilter = ' AND projects.id IN (SELECT missions.project_id FROM missions JOIN mission_assignees ON mission_assignees.mission_id = missions.id WHERE mission_assignees.user_id = ?)'
    projectScopeBinds = [user.id]
    clientScopeFilter = ' AND clients.id IN (SELECT missions.client_id FROM missions JOIN mission_assignees ON mission_assignees.mission_id = missions.id WHERE mission_assignees.user_id = ?)'
    clientScopeBinds = [user.id]
  } else if (scope !== 'all') {
    // Project-library access treats the remaining restricted scopes as
    // participation-based; client-library access has no equivalent scope.
    projectScopeFilter = ' AND projects.id IN (SELECT missions.project_id FROM missions JOIN mission_assignees ON mission_assignees.mission_id = missions.id WHERE mission_assignees.user_id = ?)'
    projectScopeBinds = [user.id]
    clientScopeFilter = ' AND 1 = 0'
  }

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
      WHERE projects.organization_id = ?${projectScopeFilter}
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
      WHERE clients.organization_id = ?${clientScopeFilter}
        AND (files.name LIKE ? OR files.file_type LIKE ? OR clients.name LIKE ? OR folders.name LIKE ?)
    )
    ORDER BY updatedAt DESC
    LIMIT 50
  `).bind(
    user.organizationId, ...projectScopeBinds, term, term, term, term, term,
    user.organizationId, ...clientScopeBinds, term, term, term, term,
  ).all<LibrarySearchResult>()

  return Response.json({ query, results })
}
