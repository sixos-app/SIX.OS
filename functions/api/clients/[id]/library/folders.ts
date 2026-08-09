import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../../_access'

export const onRequestPost: PagesFunction<Bindings, { id: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'library.manage'))) return permissionRequiredResponse()

  const client = await env.DB.prepare('SELECT id FROM clients WHERE id = ? AND organization_id = ?').bind(params.id, user.organizationId).first<{ id: string }>()
  if (!client) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })

  const body = await request.json().catch(() => null) as { name?: unknown } | null
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 2 || name.length > 48) return Response.json({ error: 'A pasta deve ter entre 2 e 48 caracteres' }, { status: 400 })

  const exists = await env.DB.prepare('SELECT id FROM client_library_folders WHERE client_id = ? AND lower(name) = lower(?)').bind(client.id, name).first<{ id: string }>()
  if (exists) return Response.json({ error: 'Já existe uma pasta com este nome' }, { status: 409 })

  const position = await env.DB.prepare('SELECT COALESCE(MAX(position), 0) AS value FROM client_library_folders WHERE client_id = ?').bind(client.id).first<{ value: number }>()
  const slugBase = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pasta'
  const folder = { id: crypto.randomUUID(), name, slug: `custom-${slugBase}-${crypto.randomUUID().slice(0, 8)}`, fileCount: 0 }
  await env.DB.prepare('INSERT INTO client_library_folders (id, client_id, name, slug, position) VALUES (?, ?, ?, ?, ?)').bind(folder.id, client.id, folder.name, folder.slug, (position?.value ?? 0) + 1).run()
  return Response.json({ folder }, { status: 201 })
}
