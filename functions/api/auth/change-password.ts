import { accessRequiredResponse, getAccessUser, hashPassword, sessionCookie, verifyPassword, type Bindings } from '../_access'

type ChangePasswordPayload = { currentPassword?: unknown; newPassword?: unknown }

export const onRequestPost: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()

  const payload = await request.json().catch(() => null) as ChangePasswordPayload | null
  const currentPassword = typeof payload?.currentPassword === 'string' ? payload.currentPassword : ''
  const newPassword = typeof payload?.newPassword === 'string' ? payload.newPassword : ''
  if (!currentPassword || newPassword.length < 12 || newPassword.length > 256 || currentPassword === newPassword) {
    return Response.json({ error: 'A nova senha deve ter entre 12 e 256 caracteres e ser diferente da atual.' }, { status: 400 })
  }

  const currentIsValid = await verifyPassword(env, user.email.toLocaleLowerCase('en-US'), currentPassword).catch(() => false)
  if (!currentIsValid) return Response.json({ error: 'A senha atual está incorreta.' }, { status: 403 })

  const credential = await hashPassword(newPassword)
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO user_credentials (user_id, password_salt, password_hash, iterations, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        password_salt = excluded.password_salt,
        password_hash = excluded.password_hash,
        iterations = excluded.iterations,
        updated_at = excluded.updated_at
    `).bind(user.id, credential.passwordSalt, credential.passwordHash, credential.iterations, new Date().toISOString()),
    env.DB.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(user.id),
  ])

  return Response.json(
    { success: true, reauthenticationRequired: true },
    { headers: { 'Set-Cookie': sessionCookie('', request, 0) } },
  )
}
