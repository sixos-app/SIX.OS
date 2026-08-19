import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../../_access'

type EmployeeRow = { id: string }
type PositionRow = { position: number }

function slugPart(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pasta'
}

export const onRequestPost: PagesFunction<Bindings, 'id'> = async ({ env, params, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  
  if (!(await hasPermissionV2(env, request, user, 'employees.documents.edit')) && !(await hasPermissionV2(env, request, user, 'employees.documents.upload'))) {
    return permissionRequiredResponse()
  }

  const employee = await env.DB.prepare('SELECT id FROM employees WHERE id = ? AND organization_id = ? LIMIT 1')
    .bind(params.id, user.organizationId)
    .first<EmployeeRow>()
  if (!employee) return Response.json({ error: 'Colaborador não encontrado' }, { status: 404 })

  const payload = await request.json().catch(() => null) as { name?: unknown } | null
  const name = typeof payload?.name === 'string' ? payload.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 2 || name.length > 48) return Response.json({ error: 'A pasta deve ter entre 2 e 48 caracteres' }, { status: 400 })

  const existingFolder = await env.DB.prepare('SELECT id FROM employee_library_folders WHERE employee_id = ? AND lower(name) = lower(?) LIMIT 1')
    .bind(employee.id, name)
    .first<{ id: string }>()
  if (existingFolder) return Response.json({ error: 'Já existe uma pasta com este nome' }, { status: 409 })

  const lastFolder = await env.DB.prepare('SELECT COALESCE(MAX(position), 0) AS position FROM employee_library_folders WHERE employee_id = ?')
    .bind(employee.id)
    .first<PositionRow>()
  const folder = { id: crypto.randomUUID(), name, slug: `custom-${slugPart(name)}-${crypto.randomUUID().slice(0, 8)}`, fileCount: 0 }
  
  await env.DB.batch([
    env.DB.prepare('INSERT INTO employee_library_folders (id, employee_id, name, slug, position) VALUES (?, ?, ?, ?, ?)')
      .bind(folder.id, employee.id, folder.name, folder.slug, (lastFolder?.position ?? 0) + 1),
    env.DB.prepare(`
      INSERT INTO employee_audit_logs (
        id, organization_id, employee_id, actor_user_id, action, field_name, old_value, new_value, details, created_at
      ) VALUES (?, ?, ?, ?, 'folder_created', 'document', NULL, ?, ?, ?)
    `).bind(crypto.randomUUID(), user.organizationId, employee.id, user.id, name, `Pasta criada: ${name}`, new Date().toISOString())
  ])

  return Response.json({ folder }, { status: 201 })
}
