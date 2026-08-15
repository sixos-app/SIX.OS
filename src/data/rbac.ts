export const roleCodes = ['admin', 'management', 'coordinator', 'service', 'specialist'] as const

export type RoleCode = typeof roleCodes[number]

export const permissionCodes = [
  'users.manage',
  'roles.manage',
  'gamification.manage',
  'projects.create',
  'projects.manage',
  'missions.assign',
  'missions.approve',
  'missions.delete',
  'missions.workflow.manage',
  'missions.update_own',
  'clients.manage',
  'library.manage',
  'finance.view',
  'ai.use',
  'reports.view',
  'agenda.team.view',
] as const

export type PermissionCode = typeof permissionCodes[number]

export const roleLabels: Record<RoleCode, string> = {
  admin: 'Administrador',
  management: 'Gestão',
  coordinator: 'Coordenador',
  service: 'Planejamento',
  specialist: 'Especialista',
}

const permissionsByRole: Record<RoleCode, readonly PermissionCode[]> = {
  admin: permissionCodes,
  management: ['projects.create', 'projects.manage', 'missions.approve', 'missions.delete', 'missions.workflow.manage', 'clients.manage', 'library.manage', 'ai.use', 'reports.view', 'agenda.team.view'],
  coordinator: ['projects.manage', 'missions.assign', 'missions.approve', 'missions.delete', 'missions.workflow.manage', 'agenda.team.view'],
  service: ['projects.create', 'missions.assign', 'missions.approve', 'missions.delete', 'missions.workflow.manage', 'clients.manage', 'agenda.team.view'],
  specialist: ['missions.update_own'],
}

export function isRoleCode(value: string): value is RoleCode {
  return roleCodes.includes(value as RoleCode)
}

export function getRoleLabel(role: string) {
  return isRoleCode(role) ? roleLabels[role] : 'Colaborador'
}

/** @deprecated Use usePermission() or capabilities from AccessSession instead (RBAC V2) */
export function hasPermission(role: string, permission: PermissionCode) {
  return isRoleCode(role) && permissionsByRole[role].includes(permission)
}
