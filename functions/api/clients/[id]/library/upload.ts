import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../../_access'
type Env = Bindings & { FILES: R2Bucket }
const clean = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'arquivo'
export const onRequestPost: PagesFunction<Env, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env); if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'library.manage'))) return permissionRequiredResponse()
  const client = await env.DB.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').bind(params.id, user.organizationId).first<{ id: string }>(); if (!client) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })
  const form = await request.formData(), folderId = form.get('folderId'), file = form.get('file')
  if (typeof folderId !== 'string' || !(file instanceof File) || !file.size) return Response.json({ error: 'Selecione uma pasta e um arquivo válido' }, { status: 400 }); if (file.size > 25 * 1024 * 1024) return Response.json({ error: 'O arquivo deve ter no máximo 25 MB' }, { status: 413 })
  const folder = await env.DB.prepare('SELECT id, slug FROM client_library_folders WHERE id = ? AND client_id = ?').bind(folderId, client.id).first<{ id: string; slug: string }>(); if (!folder) return Response.json({ error: 'Pasta não encontrada' }, { status: 404 })
  const name = file.name.trim().slice(0, 180)
  if (!name) return Response.json({ error: 'O arquivo precisa ter um nome válido' }, { status: 400 })
  const existing = await env.DB.prepare('SELECT id, version, storage_key AS storageKey FROM client_library_files WHERE client_id = ? AND folder_id = ? AND name = ?').bind(client.id, folder.id, name).first<{ id: string; version: number; storageKey: string | null }>()
  const id = existing?.id ?? crypto.randomUUID(), version = (existing?.version ?? 0) + 1, uploadAttemptId = crypto.randomUUID(), key = `organizations/${user.organizationId}/clients/${client.id}/${folder.slug}/${id}/v${version}/${uploadAttemptId}-${clean(name)}`, now = new Date().toISOString(), type = file.type || 'Arquivo'
  await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } })
  try {
    const [persistence] = await env.DB.batch([existing ? env.DB.prepare("UPDATE client_library_files SET file_type=?,size_bytes=?,storage_provider='r2',storage_key=?,version=?,created_by_user_id=?,updated_at=? WHERE id=? AND version=? AND storage_key IS ?").bind(type,file.size,key,version,user.id,now,id,existing.version,existing.storageKey) : env.DB.prepare("INSERT INTO client_library_files (id,client_id,folder_id,name,file_type,size_bytes,storage_provider,storage_key,version,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,'r2',?,?,?,?,?)").bind(id,client.id,folder.id,name,type,file.size,key,version,user.id,now,now), env.DB.prepare('INSERT INTO client_library_file_versions (id,file_id,version,storage_key,size_bytes,created_by_user_id,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,version,key,file.size,user.id,now)])
    if (existing && !persistence.meta.changes) {
      await env.FILES.delete(key)
      return Response.json({ error: 'O arquivo foi alterado por outra solicitação' }, { status: 409 })
    }
  } catch (error) {
    await env.FILES.delete(key)
    throw error
  }
  return Response.json({ file: { id, folderId: folder.id, name, fileType: type, sizeBytes: file.size, storageProvider: 'r2', version, updatedAt: now, historyCount: version } })
}
