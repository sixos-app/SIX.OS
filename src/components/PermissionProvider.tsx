import { createContext, type ReactNode } from 'react'
import type { AccessCapabilities } from '../data/accessRepository'

export type PermissionContextType = {
  capabilities: AccessCapabilities
  can: (permission: string) => boolean
  scopesFor: (permission: string) => string[]
  hasScope: (permission: string, scope: string) => boolean
}

export const PermissionContext = createContext<PermissionContextType | null>(null)

export function PermissionProvider({ capabilities, children }: { capabilities?: AccessCapabilities, children: ReactNode }) {
  const safeCapabilities = capabilities ?? {}

  const can = (permission: string) => {
    return Array.isArray(safeCapabilities[permission]) && safeCapabilities[permission].length > 0
  }

  const scopesFor = (permission: string) => {
    return safeCapabilities[permission] ?? []
  }

  const hasScope = (permission: string, scope: string) => {
    return scopesFor(permission).includes(scope)
  }

  return (
    <PermissionContext.Provider value={{ capabilities: safeCapabilities, can, scopesFor, hasScope }}>
      {children}
    </PermissionContext.Provider>
  )
}


