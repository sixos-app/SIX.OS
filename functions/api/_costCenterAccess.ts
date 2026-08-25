import { getPermissionScope, type AccessUser, type Bindings } from './_access'

/**
 * Cost centers are organization-wide configuration. They have no owner,
 * department, team, client, project, or unit relation that can safely map a
 * restricted RBAC V2 scope, so only `all` is valid for this resource.
 */
async function hasOrganizationWideScope(
  env: Bindings,
  request: Request,
  user: AccessUser,
  permissionCode: 'finance.view' | 'finance.manage',
) {
  return (await getPermissionScope(env, request, user, permissionCode)) === 'all'
}

export async function canViewCostCenters(env: Bindings, request: Request, user: AccessUser) {
  const [canView, canManage] = await Promise.all([
    hasOrganizationWideScope(env, request, user, 'finance.view'),
    hasOrganizationWideScope(env, request, user, 'finance.manage'),
  ])
  return canView || canManage
}

export function canManageCostCenters(env: Bindings, request: Request, user: AccessUser) {
  return hasOrganizationWideScope(env, request, user, 'finance.manage')
}
