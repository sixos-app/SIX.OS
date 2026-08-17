import { hasPermissionV2, type AccessUser, type Bindings } from '../_access'

export type MissionAccess = {
  id: string
  title: string
  projectId: string
  clientId: string
  assigneeId: string | null
  status: string
  approvalStatus: string
}

export async function getMissionAccess(env: Bindings, user: AccessUser, missionId: string) {
  return env.DB.prepare(`
    SELECT missions.id, missions.title, missions.project_id AS projectId, missions.client_id AS clientId,
      MIN(mission_assignees.user_id) AS assigneeId, missions.status,
      missions.approval_status AS approvalStatus
    FROM missions
    JOIN projects ON projects.id = missions.project_id
    LEFT JOIN mission_assignees ON mission_assignees.mission_id = missions.id
    WHERE missions.id = ? AND projects.organization_id = ?
    GROUP BY missions.id, missions.title, missions.project_id, missions.client_id, missions.status, missions.approval_status
    LIMIT 1
  `).bind(missionId, user.organizationId).first<MissionAccess>()
}

export async function canManageMission(env: Bindings, request: Request, user: AccessUser) {
  return (await hasPermissionV2(env, request, user, 'missions.assign')) || (await hasPermissionV2(env, request, user, 'missions.approve'))
}

export async function canAccessMission(env: Bindings, request: Request, user: AccessUser, mission: MissionAccess) {
  if (await canManageMission(env, request, user)) return true
  if (!(await hasPermissionV2(env, request, user, 'missions.update_own'))) return false
  if (mission.assigneeId === user.id) return true

  const participant = await env.DB.prepare(`
    SELECT 1 AS allowed
    FROM missions
    WHERE missions.id = ?
      AND (
        EXISTS (
          SELECT 1 FROM mission_assignees
          WHERE mission_assignees.mission_id = missions.id AND mission_assignees.user_id = ?
        )
        OR EXISTS (
          SELECT 1 FROM mission_workflow_steps
          WHERE mission_workflow_steps.mission_id = missions.id
            AND mission_workflow_steps.responsible_user_id = ?
        )
      )
    LIMIT 1
  `).bind(mission.id, user.id, user.id).first<{ allowed: number }>()
  return Boolean(participant)
}
