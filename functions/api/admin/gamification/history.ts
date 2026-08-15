import { accessRequiredResponse, getAccessUser, hasPermissionV2, permissionRequiredResponse, type Bindings } from '../../_access'

export const onRequestGet: PagesFunction<Bindings> = async ({ env, request }) => {
  const user = await getAccessUser(request, env)
  if (!user) return accessRequiredResponse()
  if (!(await hasPermissionV2(env, request, user, 'gamification.manage'))) return permissionRequiredResponse()
  const { results } = await env.DB.prepare(`
    SELECT awards.id, awards.rule_name AS ruleName, awards.rule_version AS ruleVersion,
      awards.base_xp AS baseXp, awards.bonus_xp AS bonusXp, awards.final_xp AS finalXp,
      awards.recipient_mode AS recipientMode, awards.created_at AS createdAt,
      missions.title AS missionTitle, users.name AS userName, awarder.name AS awardedBy
    FROM xp_awards awards
    JOIN missions ON missions.id = awards.mission_id
    JOIN users ON users.id = awards.user_id
    LEFT JOIN users awarder ON awarder.id = awards.awarded_by_user_id
    WHERE awards.organization_id = ?
    ORDER BY awards.created_at DESC
    LIMIT 100
  `).bind(user.organizationId).all()
  return Response.json({ awards: results })
}
