import { deleteSession, sessionCookie, type Bindings } from '../_access'

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  await deleteSession(request, env)
  return new Response(null, { status: 204, headers: { 'Set-Cookie': sessionCookie('', request, 0) } })
}
