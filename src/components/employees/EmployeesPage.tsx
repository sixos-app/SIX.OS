import { useEffect, useState } from 'react'
import {
  createEmployee,
  getEmployees,
  type EmployeeListItem,
} from '../../data/employeeRepository'
import { usePermission } from '../../hooks/usePermission'
import { getInitials } from '../../utils/formatters'
import { Avatar } from '../shared/Avatar'
import { EmployeeDetailsModal } from './EmployeeDetailsModal'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os Status' },
  { value: 'active', label: 'Ativos' },
  { value: 'vacation', label: 'Em Férias' },
  { value: 'leave', label: 'Afastados' },
  { value: 'inactive', label: 'Inativos' },
  { value: 'terminated', label: 'Desligados' },
]

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
      const [empList, dRes, posRes, lRes, uRes] = await Promise.all([
        getEmployees(),
        fetch('/api/admin/departments').then((r) => r.ok ? r.json() : []),
        fetch('/api/admin/positions').then((r) => r.ok ? r.json() : []),
        fetch('/api/admin/professional-levels').then((r) => r.ok ? r.json() : []),
        fetch('/api/admin/users').then((r) => r.ok ? r.json() : []),
      ])
      setEmployees(empList)
      setDepartments(dRes)
      setPositions(posRes)
      setLevels(lRes)
      setUsers(uRes)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Erro ao carregar colaboradores.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        name: createName,
        personalEmail: createEmail || null,
        departmentId: createDeptId || null,
        positionId: createPositionId || null,
        contractType: createContractType,
      }
      if (createSalary && can('employees.salary.edit')) {
        payload.salary = Number(createSalary.replace(/\./g, '').replace(',', '.')) || 0
        payload.monthlyHours = Number(createMonthlyHours) || 220
      }
      const created = await createEmployee(payload)
      setIsCreateModalOpen(false)
      setCreateName('')
      setCreateEmail('')
      setCreateSalary('')
      await loadData()
      setSelectedEmployeeId(created.id)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Falha ao cadastrar colaborador.')
    } finally {
      setCreating(false)
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

  const canViewSalary = can('employees.salary.view')

  return (
    <main className="content-area" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header com Ações */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0 }}>Colaboradores & RH</h2>
          <p style={{ color: '#85857e', fontSize: '13px', margin: '4px 0 0' }}>
            Gestão profissional, dados cadastrais, remuneração e histórico funcional.
          </p>
        </div>
        {can('employees.create') && (
          <button className="primary-button" onClick={() => setIsCreateModalOpen(true)}>
            + Novo Colaborador
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(255, 107, 107, 0.15)', color: '#ff6b6b', padding: '10px 16px', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Barra de Filtros */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder="Buscar por nome, cargo ou departamento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 260px' }}
        />
        <select className="input" value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ flex: '1 1 160px' }}>
          <option value="">Todos os Departamentos</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="input" value={filterContract} onChange={(e) => setFilterContract(e.target.value)} style={{ flex: '1 1 140px' }}>
          <option value="">Todas as Contratações</option>
          <option value="CLT">CLT</option>
          <option value="PJ">PJ</option>
          <option value="estagio">Estágio</option>
          <option value="freelancer">Freelancer</option>
        </select>
        <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ flex: '1 1 140px' }}>
          {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {/* Lista de Colaboradores */}
      {loading ? (
        <div style={{ color: '#888', padding: '40px 0', textAlign: 'center' }}>Carregando colaboradores do SIX.OS...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#666', padding: '40px 0', textAlign: 'center', background: '#171717', borderRadius: '8px', border: '1px solid #282825' }}>
          Nenhum colaborador encontrado com os filtros selecionados.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filtered.map((emp) => (
            <div
              key={emp.id}
              onClick={() => setSelectedEmployeeId(emp.id)}
              style={{
                background: '#191919',
                border: '1px solid #282825',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'border-color .15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#c6ff38')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#282825')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar initials={getInitials(emp.name)} tone="lime" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#fff' }}>{emp.name}</h4>
                    <span style={{ fontSize: '12px', color: '#85857e' }}>{emp.positionName || 'Sem cargo'}</span>
                  </div>
                </div>
                <span className={`badge badge-${emp.status === 'active' ? 'lime' : emp.status === 'terminated' ? 'red' : 'gray'}`} style={{ fontSize: '9px' }}>
                  {emp.status}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#777', borderTop: '1px solid #242421', paddingTop: '10px' }}>
                <span>📁 {emp.departmentName || 'Geral'}</span>
                <span>📋 {emp.contractType}</span>
                {canViewSalary && emp.hourlyCost !== undefined && (
                  <span style={{ color: '#c6ff38', fontWeight: 700 }}>
                    {emp.hourlyCost ? `R$ ${emp.hourlyCost.toFixed(2)}/h` : 'R$ 0,00/h'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criação Rápida */}
      {isCreateModalOpen && (
        <div className="mission-details-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="mission-details-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Cadastrar Novo Colaborador</h3>
              <button className="icon-button" onClick={() => setIsCreateModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Nome Completo *</label>
                <input className="input" value={createName} onChange={(e) => setCreateName(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>E-mail Pessoal</label>
                <input className="input" type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Departamento</label>
                  <select className="input" value={createDeptId} onChange={(e) => setCreateDeptId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Cargo</label>
                  <select className="input" value={createPositionId} onChange={(e) => setCreatePositionId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Tipo de Contratação</label>
                <select className="input" value={createContractType} onChange={(e) => setCreateContractType(e.target.value)}>
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                  <option value="estagio">Estágio</option>
                  <option value="freelancer">Freelancer</option>
                </select>
              </div>

              {can('employees.salary.edit') && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Salário Base Inicial (R$)</label>
                    <input className="input" placeholder="Ex: 4400.00" value={createSalary} onChange={(e) => setCreateSalary(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px' }}>Jornada Mensal (h)</label>
                    <input className="input" type="number" value={createMonthlyHours} onChange={(e) => setCreateMonthlyHours(e.target.value)} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="ghost-button" onClick={() => setIsCreateModalOpen(false)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={creating}>{creating ? 'Cadastrando...' : 'Cadastrar'}</button>
              </div>
            </form>
          </div>
        </div>
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

    </main>
  )
}
