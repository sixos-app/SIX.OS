import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../../_access'
import { canAccessMission, getMissionAccess } from '../_missionAccess'

export const onRequestPost: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const mission = await getMissionAccess(env, user, params.id as string)
  if (!mission) return Response.json({ error: 'Missão não encontrada' }, { status: 404 })
  if (!(await canAccessMission(env, request, user, mission))) return permissionRequiredResponse()
  const body = await request.json().catch(() => null) as { libraryFileId?: unknown } | null
  const libraryFileId = typeof body?.libraryFileId === 'string' ? body.libraryFileId : ''
  if (!libraryFileId) return Response.json({ error: 'Selecione um arquivo da biblioteca do projeto' }, { status: 400 })
  const file = await env.DB.prepare('SELECT id, name, version FROM project_library_files WHERE id = ? AND project_id = ?').bind(libraryFileId, mission.projectId).first<{ id: string; name: string; version: number }>()
  if (!file) return Response.json({ error: 'Arquivo não pertence a este projeto' }, { status: 404 })
  const attachment = { id: crypto.randomUUID(), libraryFileId: file.id, fileName: file.name, fileVersion: file.version, createdAt: new Date().toISOString() }
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO mission_attachments (id, mission_id, library_file_id, file_name, file_version, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(attachment.id, mission.id, file.id, file.name, file.version, user.id, attachment.createdAt),
      env.DB.prepare('INSERT INTO mission_history (id, mission_id, actor_user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), mission.id, user.id, 'attachment_added', file.name, attachment.createdAt),
    ])
  } catch {
    return Response.json({ error: 'Este arquivo já está anexado à missão' }, { status: 409 })
  }
  return Response.json({ attachment }, { status: 201 })
}
