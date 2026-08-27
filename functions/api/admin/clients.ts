import { accessRequiredResponse, getAccessUser, permissionRequiredResponse, type Bindings } from '../_access'
import { canCreateClient } from '../clients/_clientAccess'

type CreateClientPayload = { name?: unknown; shortCode?: unknown; imageDataUrl?: unknown }

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!await canCreateClient(env, request, user)) return permissionRequiredResponse()

  let payload: CreateClientPayload
  try {
    payload = await request.json() as CreateClientPayload
  } catch {
    return Response.json({ error: 'Dados do cliente inválidos' }, { status: 400 })
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const shortCode = typeof payload.shortCode === 'string' ? payload.shortCode.trim().toLocaleUpperCase('en-US') : ''
  const imageUrl = typeof payload.imageDataUrl === 'string' && payload.imageDataUrl ? payload.imageDataUrl : null
  const imageIsValid = imageUrl === null || (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(imageUrl) && imageUrl.length <= 350000)
  if (!name || name.length > 120 || !/^[A-Z0-9]{2,6}$/.test(shortCode) || !imageIsValid) return Response.json({ error: 'Informe nome, sigla de 2 a 6 caracteres e uma imagem válida de até 250 KB' }, { status: 400 })

  const id = `client-${crypto.randomUUID()}`
  try {
    await env.DB.prepare('INSERT INTO clients (id, organization_id, name, short_code, image_url) VALUES (?, ?, ?, ?, ?)').bind(id, user.organizationId, name, shortCode, imageUrl).run()
  } catch {
    return Response.json({ error: 'Esta sigla já está em uso' }, { status: 409 })
  }
  return Response.json({ client: { id, name, shortCode, imageUrl, description: null } }, { status: 201 })
}
