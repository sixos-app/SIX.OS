import { accessRequiredResponse, getAccessUser, hasPermission, permissionRequiredResponse, type Bindings } from '../_access'

type CreateClientPayload = { name?: unknown }

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!hasPermission(user, 'clients.manage')) return permissionRequiredResponse()

  let payload: CreateClientPayload
  try {
    payload = await request.json() as CreateClientPayload
  } catch {
    return Response.json({ error: 'Dados do cliente inválidos' }, { status: 400 })
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  if (!name || name.length > 120) return Response.json({ error: 'Informe o nome do cliente' }, { status: 400 })

  const id = `client-${crypto.randomUUID()}`
  await env.DB.prepare('INSERT INTO clients (id, organization_id, name) VALUES (?, ?, ?)').bind(id, user.organizationId, name).run()
  return Response.json({ client: { id, name } }, { status: 201 })
}
