import { useState, useEffect } from 'react'
import { usePermission } from '../../hooks/usePermission'
import { UserDirectory } from './UserDirectory'
import { DepartmentManager } from './DepartmentManager'
import { PositionManager } from './PositionManager'
import { LevelManager } from './LevelManager'
import { ProfileManager } from './ProfileManager'

export function PeopleAccessAdmin() {
  const { can } = usePermission()
  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'positions' | 'levels' | 'profiles'>('users')

  if (!can('users.manage') && !can('roles.manage')) {
    return <div className="p-4 text-gray-500">Você não tem acesso a esta área.</div>
  }

  return (
    <div className="people-access-admin">
      <div className="admin-tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #eee', marginBottom: '1rem', paddingBottom: '0.5rem' }}>
        {(can('users.manage') || can('roles.manage')) && (
          <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
            Colaboradores
          </button>
        )}
        {can('users.manage') && (
          <>
            <button className={activeTab === 'departments' ? 'active' : ''} onClick={() => setActiveTab('departments')}>Departamentos</button>
            <button className={activeTab === 'positions' ? 'active' : ''} onClick={() => setActiveTab('positions')}>Cargos</button>
            <button className={activeTab === 'levels' ? 'active' : ''} onClick={() => setActiveTab('levels')}>Níveis</button>
          </>
        )}
        {can('roles.manage') && (
          <button className={activeTab === 'profiles' ? 'active' : ''} onClick={() => setActiveTab('profiles')}>Perfis de Acesso</button>
        )}
      </div>

      <div className="admin-content">
        {activeTab === 'users' && <UserDirectory />}
        {activeTab === 'departments' && <DepartmentManager />}
        {activeTab === 'positions' && <PositionManager />}
        {activeTab === 'levels' && <LevelManager />}
        {activeTab === 'profiles' && <ProfileManager />}
      </div>
    </div>
  )
}
