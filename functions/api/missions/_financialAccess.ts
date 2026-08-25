import type { AccessUser, Bindings } from '../_access'
import { canManageCostCenters, canViewCostCenters, hasOrganizationWidePermission } from '../_costCenterAccess'

export function canManageMissionFinancials(env: Bindings, request: Request, user: AccessUser) {
  return canManageCostCenters(env, request, user)
}

export function canViewMissionBilling(env: Bindings, request: Request, user: AccessUser) {
  return canViewCostCenters(env, request, user)
}

export async function canViewMissionCosts(env: Bindings, request: Request, user: AccessUser) {
  return (await canViewMissionBilling(env, request, user))
    || (await hasOrganizationWidePermission(env, request, user, 'mission_costs.view'))
}
