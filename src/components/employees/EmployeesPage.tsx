import { useEffect, useState } from 'react'
import {
  createEmployee,
  getEmployees,
  type EmployeeListItem,
} from '../../data/employeeRepository'
import { usePermission } from '../../hooks/usePermission'
import { getInitials } from '../../utils/formatters'
import { Avatar } from '../shared/Avatar'
import { AdminUserDialog } from '../admin/AdminUserDialog'
import { createAdminUser, getAdminOverview, type AdminOverview } from '../../data/adminRepository'
import { EmployeeDetailsModal } from './EmployeeDetailsModal'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os Status' },
  { value: 'active', label: 'Ativos' },
  { value: 'vacation', label: 'Em Férias' },
  { value: 'leave', label: 'Afastados' },
  { value: 'inactive', label: 'Inativos' },
  { value: 'terminated', label: 'Desligados' },
]

function formatStatus(status: string) {
  switch (status) {
    case 'active': return 'ATIVO'
    case 'inactive': return 'INATIVO'
    case 'vacation': return 'FÉRIAS'
    case 'leave': return 'AFASTADO'
    case 'terminated': return 'DESLIGADO'
    default: return status.toUpperCase()
  }
}

export function EmployeesPage() {
  const { can } = usePermission()
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [positions, setPositions] = useState<Array<{ id: string; name: string }>>([])
  const [levels, setLevels] = useState<Array<{ id: string; name: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterContract, setFilterContract] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null)

  // Create form state
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createDeptId, setCreateDeptId] = useState('')
  const [createPositionId, setCreatePositionId] = useState('')
  const [createContractType, setCreateContractType] = useState('CLT')
  const [createSalary, setCreateSalary] = useState('')
  const [createMonthlyHours, setCreateMonthlyHours] = useState('220')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [empList, dRes, posRes, lRes, uRes, overview] = await Promise.all([
        getEmployees(),
        fetch('/api/admin/departments').then(async (r) => r.ok ? r.json() : []),
        fetch('/api/admin/positions').then(async (r) => r.ok ? r.json() : []),
        fetch('/api/admin/professional-levels').then(async (r) => r.ok ? r.json() : []),
        fetch('/api/admin/users').then(async (r) => r.ok ? r.json() : []),
        getAdminOverview().catch(() => null),
      ])
      setEmployees(empList)
      setDepartments(dRes)
      setPositions(posRes)
      setLevels(lRes)
      setUsers(uRes)
      setAdminOverview(overview)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Erro ao carregar colaboradores.')
    } finally {
      setLoading(false)
    }
  }


  const filtered = employees.filter((emp) => {
    if (filterStatus && emp.status !== filterStatus) return false
    if (filterDept && emp.departmentId !== filterDept) return false
    if (filterContract && emp.contractType !== filterContract) return false
    if (search) {
      const s = search.toLowerCase()
      const matchesName = emp.name.toLowerCase().includes(s)
      const matchesSocial = emp.socialName?.toLowerCase().includes(s)
      const matchesPos = emp.positionName?.toLowerCase().includes(s)
      const matchesDept = emp.departmentName?.toLowerCase().includes(s)
      if (!matchesName && !matchesSocial && !matchesPos && !matchesDept) return false
    }
    return true
  })

  return (
    <div className="admin-page">
      <section className="admin-intro">
        <div>
          <span>GESTÃO DE PESSOAS</span>
          <h1>Colaboradores & <em>RH.</em></h1>
          <p>Gestão de pessoas, remuneração e documentos de forma centralizada.</p>
        </div>
        <div className="admin-intro-side">
          <div className="admin-actions">
            {can('employees.create') && (
              <button onClick={() => setIsCreateModalOpen(true)}>NOVO COLABORADOR <span>+</span></button>
            )}
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="admin-card employees-filters">
        <input
          className="admin-input"
          placeholder="Buscar por nome ou matrícula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="admin-input" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">Todos os Departamentos</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="admin-input" value={filterContract} onChange={(e) => setFilterContract(e.target.value)}>
          <option value="">Todas as Contratações</option>
          <option value="CLT">CLT</option>
          <option value="PJ">PJ</option>
          <option value="estagio">Estágio</option>
          <option value="freelancer">Freelancer</option>
        </select>
        <select className="admin-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </section>

      {error && (
        <div style={{ background: 'rgba(255, 107, 107, 0.15)', color: '#ff6b6b', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', margin: '20px 0' }}>
          {error}
        </div>
      )}

      {/* Lista de Colaboradores */}
      {loading ? (
        <div style={{ color: '#888', padding: '40px 0', textAlign: 'center', marginTop: '24px' }}>Carregando colaboradores do SIX.OS...</div>
      ) : filtered.length === 0 ? (
        <div className="admin-card" style={{ padding: '40px 0', textAlign: 'center', marginTop: '32px' }}>
          Nenhum colaborador encontrado com os filtros selecionados.
        </div>
      ) : (
        <section className="employees-grid">
          {filtered.map((emp) => (
            <button
              type="button"
              key={emp.id}
              className="admin-card employee-card"
              onClick={() => setSelectedEmployeeId(emp.id)}
              aria-label={`Abrir detalhes de ${emp.name}`}
              style={{
                cursor: 'pointer',
                transition: 'border-color .15s ease, box-shadow .15s ease, transform .15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '20px'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.borderColor = '#c6ff38';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(198,255,56,0.08)';
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <Avatar initials={getInitials(emp.name)} tone="dark" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#171717', letterSpacing: '-0.3px' }}>{emp.name}</h4>
                    <span style={{ fontSize: '12px', color: '#777771' }}>{emp.positionName || 'Cargo não informado'}</span>
                  </div>
                </div>
                <span className={`badge badge-${emp.status === 'active' ? 'lime' : emp.status === 'terminated' ? 'red' : 'gray'}`} style={{ fontSize: '9px', fontWeight: 800, padding: '4px 8px' }}>
                  {formatStatus(emp.status)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px', borderTop: '1px solid #e1e1da', paddingTop: '16px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '9px', color: '#85857e', fontWeight: 900, letterSpacing: '1px', marginBottom: '4px' }}>DEPARTAMENTO</span>
                  <span style={{ fontSize: '13px', color: '#171717', fontWeight: 500 }}>{emp.departmentName || 'Geral'}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '9px', color: '#85857e', fontWeight: 900, letterSpacing: '1px', marginBottom: '4px' }}>VÍNCULO</span>
                  <span style={{ fontSize: '13px', color: '#171717', fontWeight: 500, textTransform: 'uppercase' }}>{emp.contractType || '-'}</span>
                </div>
              </div>
            </button>
          ))}
        </section>
      )}

      {/* Modal de Criação via AdminUserDialog (Antigo padrão) */}
      {isCreateModalOpen && adminOverview && (
        <AdminUserDialog
          roles={adminOverview.roles}
          departments={departments}
          positions={positions}
          levels={levels}
          users={users}
          canSetSalary={can('employees.salary.edit')}
          canEditSensitive={can('employees.edit_sensitive')}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={async (input) => {
            await createAdminUser(input)
            await loadData()
          }}
        />
      )}

      {/* Modal de Detalhes Completo */}
      {selectedEmployeeId && (
        <EmployeeDetailsModal
          employeeId={selectedEmployeeId}
          departments={departments}
          positions={positions}
          levels={levels}
          users={users}
          onClose={() => setSelectedEmployeeId(null)}
          onUpdated={loadData}
        />
      )}

    </div>
  )
}
