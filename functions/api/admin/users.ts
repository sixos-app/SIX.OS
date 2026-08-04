import { accessRequiredResponse, getAccessUser, hasPermission, permissionRequiredResponse, type Bindings } from '../_access'

type CreateUserPayload = { name?: unknown; email?: unknown; role?: unknown; username?: unknown }

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const administrator = await getAccessUser(request, env)
  if (!administrator) return accessRequiredResponse()
  if (!hasPermission(administrator, 'users.manage')) return permissionRequiredResponse()

  let payload: CreateUserPayload
  try {
    payload = await request.json() as CreateUserPayload
  } catch {
    return Response.json({ error: 'Dados do colaborador inválidos' }, { status: 400 })
  }

  const name = normalizeText(payload.name)
  const email = normalizeText(payload.email).toLocaleLowerCase('en-US')
  const role = normalizeText(payload.role)
  const usernameValue = normalizeText(payload.username).toLocaleLowerCase('en-US')
  const username = usernameValue || null
  if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 180 || !role || (username && !/^[a-z0-9._-]{3,40}$/.test(username))) return Response.json({ error: 'Revise os dados do colaborador' }, { status: 400 })

  const roleExists = await env.DB.prepare('SELECT code FROM role_definitions WHERE code = ? LIMIT 1').bind(role).first<{ code: string }>()
  if (!roleExists) return Response.json({ error: 'Cargo inválido' }, { status: 400 })

  const id = `user-${crypto.randomUUID()}`
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, organization_id, team_id, name, email, role, username) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, administrator.organizationId, administrator.teamId, name, email, role, username),
      env.DB.prepare("INSERT INTO gamification_profiles (user_id, level) VALUES (?, 'Criativo Iniciante')").bind(id),
      env.DB.prepare('INSERT INTO user_role_assignments (user_id, role_code) VALUES (?, ?)').bind(id, role),
    ])
  } catch {
    return Response.json({ error: 'Já existe um colaborador com este e-mail ou login' }, { status: 409 })
  }

  return Response.json({ member: { id, name, email, username, role } }, { status: 201 })
}
