import { useContext } from 'react'
import { PermissionContext } from '../components/PermissionProvider'

export function usePermission() {
  const context = useContext(PermissionContext)
  
  if (!context) {
    return { capabilities: {}, can: () => false, scopesFor: () => [], hasScope: () => false }
  }
  
  return context
}
