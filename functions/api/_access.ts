export type Bindings = { DB: D1Database }

export type AccessUser = {
  id: string
  organizationId: string
  teamId: string | null
  name: string
  email: string
  role: string
}

export async function getAccessUser(request: Request, env: Bindings): Promise<AccessUser | null> {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim().toLocaleLowerCase('en-US')
  if (!email) return null

  const user = await env.DB.prepare(`
    SELECT id, organization_id AS organizationId, team_id AS teamId, name, email, role
    FROM users
    WHERE email = ?
    LIMIT 1
  `).bind(email).first<AccessUser>()

  return user ?? null
}

export function accessRequiredResponse() {
  return Response.json({ error: 'Autenticação Cloudflare Access necessária' }, { status: 401 })
}
