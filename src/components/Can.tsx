import type { ReactNode } from 'react'
import { usePermission } from '../hooks/usePermission'

type CanProps = {
  permission: string
  scope?: string
  children: ReactNode
  fallback?: ReactNode
}

export function Can({ permission, scope, children, fallback = null }: CanProps) {
  const { can, hasScope } = usePermission()

  const isAllowed = scope ? hasScope(permission, scope) : can(permission)

  return isAllowed ? <>{children}</> : <>{fallback}</>
}
