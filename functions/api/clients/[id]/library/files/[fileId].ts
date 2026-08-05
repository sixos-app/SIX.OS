import { accessRequiredResponse, getAccessUser, type Bindings } from '../../../../_access'

type Env = Bindings & { FILES: R2Bucket }

export const onRequestGet: PagesFunction<Env, { id: string; fileId: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  const file = await env.DB.prepare(`SELECT files.name, files.storage_key AS storageKey FROM client_library_files files JOIN clients ON clients.id = files.client_id WHERE files.id = ? AND files.client_id = ? AND clients.organization_id = ?`).bind(params.fileId, params.id, user.organizationId).first<{ name: string; storageKey: string | null }>()
  if (!file?.storageKey) return Response.json({ error: 'Arquivo não encontrado' }, { status: 404 })
  const object = await env.FILES.get(file.storageKey)
  if (!object) return Response.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'private, no-store' } })
}
