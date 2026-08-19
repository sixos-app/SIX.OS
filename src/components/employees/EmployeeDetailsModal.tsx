import { useEffect, useState } from 'react'
import {
  createEmployeeCompensation,
  deleteEmployeeDocument,
  getEmployeeAuditLogs,
  getEmployeeCompensationHistory,
  getEmployeeDetail,
  getEmployeeDocuments,
  updateEmployee,
  uploadEmployeeDocument,
  type EmployeeAuditLogItem,
  type EmployeeCompensationItem,
  type EmployeeDetail,
  type EmployeeDocumentItem,
} from '../../data/employeeRepository'
import { usePermission } from '../../hooks/usePermission'
import { getInitials } from '../../utils/formatters'
import { Avatar } from '../shared/Avatar'
import { getEmployeeLibrary, createEmployeeLibraryFolder, uploadEmployeeLibraryFile, deleteEmployeeLibraryFile, type EmployeeLibrary, employeeLibrarySeed } from '../../data/employeeLibraryRepository'

type TabType = 'overview' | 'personal' | 'professional' | 'compensation' | 'documents' | 'history'

const DOCUMENT_CATEGORIES: Record<string, string> = {
  personal: 'Documentos Pessoais',
  contracts: 'Contratos & Termos',
  payslips: 'Holerites & Comprovantes',
  medical: 'Atestados Médicos',
  vacation: 'Férias',
  benefits: 'Benefícios',
  terms: 'Advertências & Acordos',
  evaluations: 'Avaliações de Desempenho',
  other: 'Outros Documentos',
}

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  active: { label: 'Ativo', tone: 'lime' },
  inactive: { label: 'Inativo', tone: 'gray' },
  vacation: { label: 'Em Férias', tone: 'blue' },
  leave: { label: 'Afastado', tone: 'orange' },
  terminated: { label: 'Desligado', tone: 'red' },
}

export function EmployeeDetailsModal({
  employeeId,
  departments,
  positions,
  levels,
  users,
  onClose,
  onUpdated,
}: {
  employeeId: string
  departments: Array<{ id: string; name: string }>
  positions: Array<{ id: string; name: string }>
  levels: Array<{ id: string; name: string }>
  users: Array<{ id: string; name: string }>
  onClose: () => void
  onUpdated: () => void
}) {
  const { can } = usePermission()
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  // Compensation state
  const [compensationHistory, setCompensationHistory] = useState<EmployeeCompensationItem[]>([])
  const [newSalary, setNewSalary] = useState('')
  const [newMonthlyHours, setNewMonthlyHours] = useState('220')
  const [newSalaryValidFrom, setNewSalaryValidFrom] = useState('')
  const [newSalaryReason, setNewSalaryReason] = useState('')
  const [savingCompensation, setSavingCompensation] = useState(false)

  // Documents state
  const [library, setLibrary] = useState<EmployeeLibrary>(employeeLibrarySeed)
  const [selectedFolderSlug, setSelectedFolderSlug] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [isFolderFormOpen, setIsFolderFormOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [isLibraryLoading, setIsLibraryLoading] = useState(true)

  // Audit state
  const [auditLogs, setAuditLogs] = useState<EmployeeAuditLogItem[]>([])

  // Edit form state
  const [form, setForm] = useState<Partial<EmployeeDetail>>({})

  useEffect(() => {
    loadData()
  }, [employeeId])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const data = await getEmployeeDetail(employeeId)
      setEmployee(data)
      setForm(data)

      if (can('employees.salary.view')) {
        void getEmployeeCompensationHistory(employeeId).then(setCompensationHistory).catch(() => undefined)
      }
      if (can('employees.documents.view')) {
        setIsLibraryLoading(true)
        void getEmployeeLibrary(employeeId).then((lib) => {
          setLibrary(lib)
          setSelectedFolderSlug(lib.folders[0]?.slug ?? '')
        }).catch(() => undefined).finally(() => setIsLibraryLoading(false))
      }
      if (can('employees.history.view')) {
        void getEmployeeAuditLogs(employeeId).then(setAuditLogs).catch(() => undefined)
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Erro ao carregar colaborador.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFeedback('')
    setError('')
    try {
      await updateEmployee(employeeId, form)
      setFeedback('Alterações salvas com sucesso!')
      onUpdated()
      await loadData()
      setTimeout(() => setFeedback(''), 3000)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Falha ao salvar dados.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCompensation(e: React.FormEvent) {
    e.preventDefault()
    const salaryNum = Number(newSalary.replace(/\./g, '').replace(',', '.'))
    if (isNaN(salaryNum) || salaryNum <= 0) {
      setError('Informe um salário base válido.')
      return
    }
    setSavingCompensation(true)
    setError('')
    try {
      await createEmployeeCompensation(employeeId, {
        salary: salaryNum,
        monthlyHours: Number(newMonthlyHours) || 220,
        validFrom: newSalaryValidFrom || undefined,
        reason: newSalaryReason || undefined,
      })
      setNewSalary('')
      setNewSalaryReason('')
      setFeedback('Reajuste salarial registrado com sucesso!')
      onUpdated()
      await loadData()
      setTimeout(() => setFeedback(''), 3000)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Falha ao registrar reajuste.')
    } finally {
      setSavingCompensation(false)
    }
  }

  const selectedFolder = library.folders.find((folder) => folder.slug === selectedFolderSlug) ?? library.folders[0]
  const visibleFiles = library.files.filter((file) => file.folderId === selectedFolder?.id)

  async function handleFileSelection(file: File | undefined) {
    if (!file || !selectedFolder || isUploading) return

    setIsUploading(true)
    setUploadMessage('')
    try {
      const uploadedFile = await uploadEmployeeLibraryFile({ employeeId, folderId: selectedFolder.id, file })
      setLibrary((current) => {
        const previousFile = current.files.find((item) => item.id === uploadedFile.id)
        return {
          files: previousFile ? current.files.map((item) => item.id === uploadedFile.id ? uploadedFile : item) : [uploadedFile, ...current.files],
          folders: previousFile ? current.folders : current.folders.map((folder) => folder.id === selectedFolder.id ? { ...folder, fileCount: folder.fileCount + 1 } : folder),
        }
      })
      setUploadMessage(uploadedFile.version === 1 ? 'Arquivo enviado para o colaborador.' : `Nova versão ${uploadedFile.version} enviada.`)
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Não foi possível enviar o arquivo')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleFolderCreation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = folderName.trim()
    if (!name || isCreatingFolder) return

    setIsCreatingFolder(true)
    setUploadMessage('')
    try {
      const folder = await createEmployeeLibraryFolder(employeeId, name)
      setLibrary((current) => ({ ...current, folders: [...current.folders, folder] }))
      setSelectedFolderSlug(folder.slug)
      setFolderName('')
      setIsFolderFormOpen(false)
      setUploadMessage('Pasta criada para este colaborador.')
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Não foi possível criar a pasta')
    } finally {
      setIsCreatingFolder(false)
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm('Deseja realmente excluir este documento?')) return
    try {
      await deleteEmployeeLibraryFile(employeeId, fileId)
      setLibrary((current) => ({
        ...current,
        files: current.files.filter((f) => f.id !== fileId),
        folders: current.folders.map((folder) => folder.id === selectedFolder.id ? { ...folder, fileCount: Math.max(0, folder.fileCount - 1) } : folder),
      }))
      setFeedback('Documento excluído.')
      setTimeout(() => setFeedback(''), 3000)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Falha ao excluir documento.')
    }
  }

  if (loading) {
    return (
      <div className="mission-details-overlay" onClick={onClose}>
        <div className="mission-details-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '840px', padding: '32px', textAlign: 'center', color: '#888' }}>
          Carregando dados do colaborador...
        </div>
      </div>
    )
  }

  if (!employee) {
    return null
  }

  const statusMeta = STATUS_LABELS[employee.status] || { label: employee.status, tone: 'gray' }

  return (
    <div className="mission-details-overlay" onClick={onClose}>
      <div className="mission-details-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '920px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header SIX.OS */}
        <header className="mission-details-header" style={{ padding: '20px 24px', borderBottom: '1px solid #282825', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Avatar initials={getInitials(employee.name)} tone="lime" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>{employee.name}</h3>
                {employee.socialName && <span style={{ color: '#85857e', fontSize: '13px' }}>({employee.socialName})</span>}
                <span className={`badge badge-${statusMeta.tone}`} style={{ fontSize: '10px', padding: '2px 8px' }}>{statusMeta.label}</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#85857e' }}>
                {employee.positionName || 'Sem cargo'} • {employee.departmentName || 'Sem departamento'} {employee.registrationNumber ? `• Matrícula: ${employee.registrationNumber}` : ''}
              </p>
            </div>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Fechar modal">×</button>
        </header>

        {/* Feedback / Error Alerts */}
        {feedback && <div style={{ background: 'rgba(198, 255, 56, 0.15)', color: '#c6ff38', padding: '8px 24px', fontSize: '12px', borderBottom: '1px solid #31312e' }}>{feedback}</div>}
        {error && <div style={{ background: 'rgba(255, 107, 107, 0.15)', color: '#ff6b6b', padding: '8px 24px', fontSize: '12px', borderBottom: '1px solid #31312e' }}>{error}</div>}

        {/* Tabs Bar */}
        <nav className="mission-tabs" aria-label="Navegação do detalhe do colaborador" style={{ padding: '0 24px', background: '#111' }}>
          <button className={`mission-tab-button ${activeTab === 'overview' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('overview')}>VISÃO GERAL</button>
          <button className={`mission-tab-button ${activeTab === 'personal' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('personal')}>DADOS PESSOAIS</button>
          <button className={`mission-tab-button ${activeTab === 'professional' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('professional')}>VÍNCULO</button>
          {can('employees.salary.view') && <button className={`mission-tab-button ${activeTab === 'compensation' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('compensation')}>REMUNERAÇÃO</button>}
          {can('employees.documents.view') && <button className={`mission-tab-button ${activeTab === 'documents' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('documents')}>DOCUMENTOS {library.files.length > 0 && <span className="mission-tab-badge">{library.files.length}</span>}</button>}
          {can('employees.history.view') && <button className={`mission-tab-button ${activeTab === 'history' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('history')}>AUDITORIA</button>}
        </nav>

        {/* Scrollable Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          
          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div className="panel" style={{ background: '#191919', border: '1px solid #282825', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', color: '#c6ff38', textTransform: 'uppercase', letterSpacing: '.5px' }}>Dados Principais</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#ccc' }}>
                  <div><strong style={{ color: '#888' }}>E-mail corporativo:</strong> {employee.userEmail || 'Sem login vinculado'}</div>
                  <div><strong style={{ color: '#888' }}>E-mail pessoal:</strong> {employee.personalEmail || 'Não informado'}</div>
                  <div><strong style={{ color: '#888' }}>Telefone:</strong> {employee.phone || 'Não informado'}</div>
                  <div><strong style={{ color: '#888' }}>Admissão:</strong> {employee.admissionDate ? new Date(employee.admissionDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informada'}</div>
                  <div><strong style={{ color: '#888' }}>Contrato:</strong> {employee.contractType} ({employee.workModality})</div>
                </div>
              </div>

              {can('employees.salary.view') && (
                <div className="panel" style={{ background: '#191919', border: '1px solid #282825', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '13px', color: '#c6ff38', textTransform: 'uppercase', letterSpacing: '.5px' }}>Resumo Financeiro</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#ccc' }}>
                    <div><strong style={{ color: '#888' }}>Salário Base Atual:</strong> {employee.currentSalary ? `R$ ${employee.currentSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não cadastrado'}</div>
                    <div><strong style={{ color: '#888' }}>Jornada Mensal:</strong> {employee.currentMonthlyHours || 220} horas</div>
                    <div><strong style={{ color: '#888' }}>Custo Salarial / Hora:</strong> <span style={{ color: '#c6ff38', fontWeight: 700 }}>{employee.currentHourlyCost ? `R$ ${employee.currentHourlyCost.toFixed(2)}/h` : 'R$ 0,00/h'}</span></div>
                    <div><strong style={{ color: '#888' }}>Vigência Atual Desde:</strong> {employee.compensationValidFrom || 'Não registrada'}</div>
                  </div>
                </div>
              )}

              {employee.notes && (
                <div className="panel" style={{ gridColumn: '1 / -1', background: '#191919', border: '1px solid #282825', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#888' }}>Observações Administrativas</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#ccc', whiteSpace: 'pre-wrap' }}>{employee.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DADOS PESSOAIS */}
          {activeTab === 'personal' && (
            <form onSubmit={handleSaveGeneral} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Nome Completo *</label>
                  <input className="admin-input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Nome Social</label>
                  <input className="admin-input" value={form.socialName || ''} onChange={(e) => setForm({ ...form, socialName: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>CPF</label>
                  <input className="admin-input" placeholder="000.000.000-00" value={form.cpf || ''} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>RG / Órgão</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input className="admin-input" style={{ flex: 2 }} placeholder="RG" value={form.rg || ''} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
                    <input className="admin-input" style={{ flex: 1 }} placeholder="SSP/SP" value={form.emitterOrgan || ''} onChange={(e) => setForm({ ...form, emitterOrgan: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Data de Nascimento</label>
                  <input className="admin-input" type="date" value={form.birthDate || ''} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Estado Civil</label>
                  <select className="admin-input" value={form.maritalStatus || ''} onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}>
                    <option value="">Selecione...</option>
                    <option value="solteiro">Solteiro(a)</option>
                    <option value="casado">Casado(a)</option>
                    <option value="uniao_estavel">União Estável</option>
                    <option value="divorciado">Divorciado(a)</option>
                    <option value="viuvo">Viúvo(a)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Telefone / WhatsApp</label>
                  <input className="admin-input" placeholder="(11) 90000-0000" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>E-mail Pessoal</label>
                  <input className="admin-input" type="email" value={form.personalEmail || ''} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} />
                </div>
              </div>

              <h4 style={{ margin: '14px 0 6px', fontSize: '12px', color: '#c6ff38', textTransform: 'uppercase' }}>Endereço</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>CEP</label>
                  <input className="admin-input" placeholder="00000-000" value={form.zipCode || ''} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Logradouro & Número</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="admin-input" style={{ flex: 3 }} placeholder="Rua / Avenida" value={form.street || ''} onChange={(e) => setForm({ ...form, street: e.target.value })} />
                    <input className="admin-input" style={{ flex: 1 }} placeholder="Nº" value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Complemento</label>
                  <input className="admin-input" placeholder="Apto, Bloco..." value={form.complement || ''} onChange={(e) => setForm({ ...form, complement: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Bairro</label>
                  <input className="admin-input" value={form.neighborhood || ''} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Cidade & UF</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input className="admin-input" style={{ flex: 3 }} placeholder="Cidade" value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    <input className="admin-input" style={{ flex: 1 }} placeholder="UF" maxLength={2} value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                  </div>
                </div>
              </div>

              {can('employees.edit') && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button className="mission-create-submit" type="submit" disabled={saving} style={{ width: 'auto', padding: '11px 24px' }}>{saving ? 'Salvando...' : 'Salvar Dados Pessoais'}</button>
                </div>
              )}
            </form>
          )}

          {/* TAB 3: DADOS PROFISSIONAIS */}
          {activeTab === 'professional' && (
            <form onSubmit={handleSaveGeneral} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Matrícula Interna</label>
                  <input className="admin-input" placeholder="Ex: SIX-042" value={form.registrationNumber || ''} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Status Atual</label>
                  <select className="admin-input" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                    <option value="active">Ativo</option>
                    <option value="vacation">Em Férias</option>
                    <option value="leave">Afastado (Licença)</option>
                    <option value="inactive">Inativo</option>
                    <option value="terminated">Desligado</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Departamento</label>
                  <select className="admin-input" value={form.departmentId || ''} onChange={(e) => setForm({ ...form, departmentId: e.target.value || null })}>
                    <option value="">Selecione...</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Cargo Profissional</label>
                  <select className="admin-input" value={form.positionId || ''} onChange={(e) => setForm({ ...form, positionId: e.target.value || null })}>
                    <option value="">Selecione...</option>
                    {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Nível / Senioridade</label>
                  <select className="admin-input" value={form.professionalLevelId || ''} onChange={(e) => setForm({ ...form, professionalLevelId: e.target.value || null })}>
                    <option value="">Selecione...</option>
                    {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Gestor / Liderança Direta</label>
                  <select className="admin-input" value={form.managerId || ''} onChange={(e) => setForm({ ...form, managerId: e.target.value || null })}>
                    <option value="">Selecione...</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Data de Admissão</label>
                  <input className="admin-input" type="date" value={form.admissionDate || ''} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Tipo de Contratação</label>
                  <select className="admin-input" value={form.contractType || 'CLT'} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
                    <option value="CLT">CLT (Efetivo)</option>
                    <option value="PJ">PJ (Pessoa Jurídica)</option>
                    <option value="estagio">Estágio</option>
                    <option value="freelancer">Freelancer / Temporário</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Modalidade de Trabalho</label>
                  <select className="admin-input" value={form.workModality || 'hibrido'} onChange={(e) => setForm({ ...form, workModality: e.target.value })}>
                    <option value="hibrido">Híbrido</option>
                    <option value="remoto">Remoto</option>
                    <option value="presencial">Presencial</option>
                  </select>
                </div>
              </div>

              {form.status === 'terminated' && (
                <div style={{ background: 'rgba(255, 107, 107, 0.08)', border: '1px solid #ff6b6b', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '12px', color: '#ff6b6b', textTransform: 'uppercase' }}>Informações de Desligamento</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Data do Desligamento</label>
                      <input className="admin-input" type="date" value={form.terminationDate || ''} onChange={(e) => setForm({ ...form, terminationDate: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Motivo / Termos</label>
                      <input className="admin-input" placeholder="Motivo do encerramento do contrato" value={form.terminationReason || ''} onChange={(e) => setForm({ ...form, terminationReason: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Notas & Observações Administrativas</label>
                <textarea className="admin-input" style={{ minHeight: '70px', width: '100%' }} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              {can('employees.edit') && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button className="mission-create-submit" type="submit" disabled={saving} style={{ width: 'auto', padding: '11px 24px' }}>{saving ? 'Salvando...' : 'Salvar Dados Profissionais'}</button>
                </div>
              )}
            </form>
          )}

          {/* TAB 4: REMUNERAÇÃO & HISTÓRICO SALARIAL */}
          {activeTab === 'compensation' && can('employees.salary.view') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {can('employees.salary.edit') && (
                <form onSubmit={handleAddCompensation} className="panel" style={{ background: '#191919', border: '1px solid #282825', borderRadius: '8px', padding: '18px' }}>
                  <h4 style={{ margin: '0 0 14px', fontSize: '13px', color: '#c6ff38', textTransform: 'uppercase', letterSpacing: '.5px' }}>Registrar Novo Reajuste / Vigência Salarial</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Salário Base (R$) *</label>
                      <input className="admin-input" placeholder="Ex: 5000.00" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Jornada Mensal (Horas)</label>
                      <input className="admin-input" type="number" value={newMonthlyHours} onChange={(e) => setNewMonthlyHours(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Início da Vigência</label>
                      <input className="admin-input" type="date" value={newSalaryValidFrom} onChange={(e) => setNewSalaryValidFrom(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Motivo / Justificativa</label>
                      <input className="admin-input" placeholder="Ex: Promoção / Dissídio anual" value={newSalaryReason} onChange={(e) => setNewSalaryReason(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                    <button className="mission-create-submit" type="submit" disabled={savingCompensation} style={{ width: 'auto', padding: '11px 24px' }}>{savingCompensation ? 'Registrando...' : 'Conceder Reajuste Salarial'}</button>
                  </div>
                </form>
              )}

              <div>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '.5px' }}>Linha do Tempo Salarial (Histórico de Vigências)</h4>
                {compensationHistory.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '13px' }}>Nenhum histórico salarial registrado.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {compensationHistory.map((comp) => {
                      const isCurrent = !comp.validUntil
                      return (
                        <div key={comp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: isCurrent ? 'rgba(198, 255, 56, 0.05)' : '#191919', border: isCurrent ? '1px solid #c6ff38' : '1px solid #282825', borderRadius: '8px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <strong style={{ fontSize: '15px', color: isCurrent ? '#c6ff38' : '#fff' }}>R$ {comp.salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                              <span style={{ fontSize: '12px', color: '#85857e' }}>({comp.hourlyCost.toFixed(2)}/h • {comp.monthlyHours}h/mês)</span>
                              {isCurrent && <span className="badge badge-lime" style={{ fontSize: '9px', padding: '2px 6px' }}>Vigente</span>}
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#85857e' }}>
                              Vigência: <b>{new Date(comp.validFrom + 'T00:00:00').toLocaleDateString('pt-BR')}</b> {comp.validUntil ? `até ${new Date(comp.validUntil + 'T00:00:00').toLocaleDateString('pt-BR')}` : '(atual)'} {comp.reason ? `• Motivo: ${comp.reason}` : ''}
                            </p>
                          </div>
                          {comp.createdByName && <span style={{ fontSize: '11px', color: '#666' }}>Por: {comp.createdByName}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: DOCUMENTOS PRIVADOS */}
          {activeTab === 'documents' && can('employees.documents.view') && (
            <div className="project-library-layout" style={{ margin: '-24px', height: 'calc(100% + 48px)' }}>
              <div className="project-library-folders" style={{ borderRight: '1px solid #282825', background: '#111' }}>
                <div className="project-library-folders-head">
                  <span>PASTAS DO COLABORADOR</span>
                  <button onClick={() => setIsFolderFormOpen((current) => !current)}>NOVA +</button>
                </div>
                {isFolderFormOpen && (
                  <form className="project-library-folder-form" onSubmit={handleFolderCreation}>
                    <input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Ex.: Contratos" maxLength={48} required />
                    <button type="submit" disabled={isCreatingFolder}>{isCreatingFolder ? '…' : 'CRIAR'}</button>
                  </form>
                )}
                <div>
                  {library.folders.map((folder) => (
                    <button className={folder.slug === selectedFolder?.slug ? 'selected' : ''} onClick={() => setSelectedFolderSlug(folder.slug)} aria-pressed={folder.slug === selectedFolder?.slug} key={folder.id}>
                      <i>⌁</i>
                      <b>{folder.name}</b>
                      <small>{folder.fileCount} arquivo{folder.fileCount === 1 ? '' : 's'}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="project-library-files">
                <div className="project-library-files-head">
                  <div>
                    <span>{selectedFolder?.name ?? 'Pasta'}</span>
                    <b>{visibleFiles.length} arquivo{visibleFiles.length === 1 ? '' : 's'}</b>
                  </div>
                  {can('employees.documents.upload') && (
                    <label className={`project-library-upload ${isUploading ? 'uploading' : ''}`}>
                      <input type="file" onChange={(event) => { void handleFileSelection(event.target.files?.[0]); event.currentTarget.value = '' }} disabled={isUploading} />
                      {isUploading ? 'ENVIANDO…' : 'ADICIONAR ARQUIVO +'}
                    </label>
                  )}
                </div>
                
                {uploadMessage && <p className="project-library-message" role="status" style={{ margin: '0 24px', fontSize: '12px', color: '#888' }}>{uploadMessage}</p>}
                {isLibraryLoading && <small className="project-library-loading" style={{ margin: '0 24px', fontSize: '11px', color: '#888' }}>Sincronizando estrutura…</small>}
                
                {visibleFiles.length > 0 ? (
                  <div className="project-library-file-list">
                    {visibleFiles.map((file) => (
                      <article key={file.id}>
                        <i>{file.fileType}</i>
                        <div>
                          <b>{file.name}</b>
                          <small>Versão {file.version} · {file.historyCount} registro{file.historyCount === 1 ? '' : 's'} no histórico</small>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <a href={`/api/employees/${encodeURIComponent(employeeId)}/library/files/${encodeURIComponent(file.id)}`} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', fontSize: '10px', background: '#191919', color: '#c6ff38', borderRadius: '6px', textDecoration: 'none', fontWeight: 900 }}>BAIXAR</a>
                          {can('employees.documents.delete') && (
                            <button onClick={() => handleDeleteFile(file.id)} title="Excluir documento" style={{ background: '#191919', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '10px', padding: '8px 14px', borderRadius: '6px', fontWeight: 900 }}>EXCLUIR</button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="project-library-empty">
                    <b>Nenhum arquivo nesta pasta</b>
                    <p>Selecione ADICIONAR ARQUIVO para fazer upload de um documento para o colaborador.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: TRILHA DE AUDITORIA */}
          {activeTab === 'history' && can('employees.history.view') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '.5px' }}>Trilha de Auditoria Sensível</h4>
              {auditLogs.length === 0 ? (
                <p style={{ color: '#666', fontSize: '13px' }}>Nenhum registro de auditoria disponível.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} style={{ padding: '10px 14px', background: '#191919', border: '1px solid #282825', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', marginBottom: '4px' }}>
                      <strong style={{ color: '#c6ff38' }}>{log.action}</strong>
                      <span>{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <p style={{ margin: 0, color: '#ccc' }}>{log.details || `Campo ${log.fieldName}: ${log.oldValue || 'vazio'} → ${log.newValue}`}</p>
                    <span style={{ fontSize: '11px', color: '#666' }}>Responsável: {log.actorName || 'Sistema'}</span>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
