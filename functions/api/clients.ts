import { accessRequiredResponse, getAccessUser, type Bindings } from './_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const clients = await env.DB.prepare(`
    SELECT id, name, short_code AS shortCode, image_url AS imageUrl
    FROM clients
    WHERE organization_id = ?
    ORDER BY name
  `).bind(user.organizationId).all()

  return Response.json({ clients: clients.results })
}
