import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../../../_access'
import { canAccessClientLibrary } from '../../_libraryAccess'
import { CLIENT_LIBRARY_FOLDERS, provisionClientLibraryFolders } from '../../_clientMaster'

export const onRequestPost: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const clientId = params.id as string
  if (!await canAccessClientLibrary(env, request, user, clientId, 'library.manage')) return permissionRequiredResponse()
  const client = await env.DB.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ? LIMIT 1').bind(clientId, user.organizationId).first()
  if (!client) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  await provisionClientLibraryFolders(env, clientId)
  return Response.json({ folders: CLIENT_LIBRARY_FOLDERS.map(([slug, name]) => ({ slug, name })) })
}
