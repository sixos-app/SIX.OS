import { type AccessUser, type Bindings } from '../_access'
import { canAccessClient } from './_clientAccess'

export async function canAccessClientLibrary(
  env: Bindings,
  request: Request,
  user: AccessUser,
  clientId: string,
  permissionCode = 'library.view',
): Promise<boolean> {
  return canAccessClient(env, request, user, clientId, permissionCode)
}
