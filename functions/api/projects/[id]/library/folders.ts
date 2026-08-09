import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../../_access'

type ProjectRow = { id: string }
type PositionRow = { position: number }

function slugPart(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pasta'
}

export const onRequestPost: PagesFunction<Bindings, { id: string }> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'library.manage'))) return permissionRequiredResponse()

  const project = await env.DB.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ? LIMIT 1')
    .bind(params.id, user.organizationId)
    .first<ProjectRow>()
  if (!project) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 })

  const payload = await request.json().catch(() => null) as { name?: unknown } | null
  const name = typeof payload?.name === 'string' ? payload.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 2 || name.length > 48) return Response.json({ error: 'A pasta deve ter entre 2 e 48 caracteres' }, { status: 400 })

  const existingFolder = await env.DB.prepare('SELECT id FROM project_library_folders WHERE project_id = ? AND lower(name) = lower(?) LIMIT 1')
    .bind(project.id, name)
    .first<{ id: string }>()
  if (existingFolder) return Response.json({ error: 'Já existe uma pasta com este nome' }, { status: 409 })

  const lastFolder = await env.DB.prepare('SELECT COALESCE(MAX(position), 0) AS position FROM project_library_folders WHERE project_id = ?')
    .bind(project.id)
    .first<PositionRow>()
  const folder = { id: crypto.randomUUID(), name, slug: `custom-${slugPart(name)}-${crypto.randomUUID().slice(0, 8)}`, fileCount: 0 }
  await env.DB.prepare('INSERT INTO project_library_folders (id, project_id, name, slug, position) VALUES (?, ?, ?, ?, ?)')
    .bind(folder.id, project.id, folder.name, folder.slug, (lastFolder?.position ?? 0) + 1)
    .run()

  return Response.json({ folder }, { status: 201 })
}
