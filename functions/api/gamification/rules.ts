import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'missions.assign'))) return permissionRequiredResponse()
  const { results } = await env.DB.prepare(`
    SELECT id, name, description, base_xp AS baseXp, recipient_mode AS recipientMode,
      on_time_bonus_percent AS onTimeBonusPercent
    FROM xp_rules WHERE organization_id = ? AND is_active = 1 ORDER BY name
  `).bind(user.organizationId).all()
  return Response.json({ rules: results })
}
