import { hasPermission, type AccessUser, type Bindings } from '../_access'

export type MissionAccess = {
  id: string
  projectId: string
  clientId: string
  assigneeId: string | null
  status: string
  approvalStatus: string
}

export async function getMissionAccess(env: Bindings, user: AccessUser, missionId: string) {
  return env.DB.prepare(`
    SELECT missions.id, missions.project_id AS projectId, missions.client_id AS clientId,
      MIN(mission_assignees.user_id) AS assigneeId, missions.status,
      missions.approval_status AS approvalStatus
    FROM missions
    JOIN projects ON projects.id = missions.project_id
    LEFT JOIN mission_assignees ON mission_assignees.mission_id = missions.id
    WHERE missions.id = ? AND projects.organization_id = ?
    GROUP BY missions.id, missions.project_id, missions.client_id, missions.status, missions.approval_status
    LIMIT 1
  `).bind(missionId, user.organizationId).first<MissionAccess>()
}

export function canManageMission(user: AccessUser) {
  return hasPermission(user, 'missions.assign') || hasPermission(user, 'missions.approve')
}

export function canAccessMission(user: AccessUser, mission: MissionAccess) {
  return canManageMission(user) || (mission.assigneeId === user.id && hasPermission(user, 'missions.update_own'))
}
