import { accessRequiredResponse, getAccessUser, getEffectiveCapabilities, type Bindings } from './_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const capabilities = await getEffectiveCapabilities(env, request, user)

  return Response.json({ user, capabilities })
}
