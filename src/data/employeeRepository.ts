export type EmployeeListItem = {
  id: string
  organizationId: string
  userId: string | null
  name: string
  socialName: string | null
  departmentId: string | null
  departmentName: string | null
  positionId: string | null
  positionName: string | null
  professionalLevelId: string | null
  professionalLevelName: string | null
  managerId: string | null
  managerName: string | null
  admissionDate: string | null
  contractType: string
  workModality: string
  status: 'active' | 'inactive' | 'vacation' | 'leave' | 'terminated'
  personalEmail: string | null
  phone: string | null
  avatarUrl: string | null
  salary?: number | null
  hourlyCost?: number | null
}

export type EmployeeDetail = {
  id: string
  organizationId: string
  userId: string | null
  name: string
  socialName: string | null
  cpf: string | null
  rg: string | null
  emitterOrgan: string | null
  birthDate: string | null
  maritalStatus: string | null
  phone: string | null
  personalEmail: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  zipCode: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  country: string | null
  registrationNumber: string | null
  departmentId: string | null
  departmentName: string | null
  positionId: string | null
  positionName: string | null
  professionalLevelId: string | null
  professionalLevelName: string | null
  managerId: string | null
  managerName: string | null
  admissionDate: string | null
  contractType: string
  workModality: string
  status: 'active' | 'inactive' | 'vacation' | 'leave' | 'terminated'
  terminationDate: string | null
  terminationReason: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  userEmail: string | null
  userUsername: string | null
  userRole: string | null
  avatarUrl: string | null
  currentSalary?: number | null
  currentMonthlyHours?: number | null
  currentHourlyCost?: number | null
  compensationValidFrom?: string | null
}

export type EmployeeCompensationItem = {
  id: string
  organizationId: string
  employeeId: string
  salary: number
  monthlyHours: number
  hourlyCost: number
  currency: string
  validFrom: string
  validUntil: string | null
  reason: string | null
  createdByName: string | null
  createdAt: string
}

export type EmployeeDocumentItem = {
  id: string
  organizationId: string
  employeeId: string
  folderCategory: string
  fileName: string
  fileType: string
  sizeBytes: number
  uploadedByName: string | null
  createdAt: string
}

export type EmployeeAuditLogItem = {
  id: string
  organizationId: string
  employeeId: string
  actorUserId: string | null
  actorName: string | null
  action: string
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  details: string | null
  createdAt: string
}

export async function getEmployees(): Promise<EmployeeListItem[]> {
  const res = await fetch('/api/employees')
  if (!res.ok) {
    if (res.status === 403) return []
    throw new Error('Erro ao carregar colaboradores.')
  }
  return await res.json()
}

export async function getEmployeeDetail(id: string): Promise<EmployeeDetail> {
  const res = await fetch(`/api/employees/${id}`)
  if (!res.ok) throw new Error('Erro ao carregar dados do colaborador.')
  return await res.json()
}

export async function createEmployee(data: Record<string, unknown>): Promise<{ id: string; name: string }> {
  const res = await fetch('/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || 'Erro ao criar colaborador.')
  }
  return await res.json()
}

export async function updateEmployee(id: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/employees/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || 'Erro ao atualizar colaborador.')
  }
}

export async function getEmployeeCompensationHistory(id: string): Promise<EmployeeCompensationItem[]> {
  const res = await fetch(`/api/employees/${id}/compensation`)
  if (!res.ok) {
    if (res.status === 403) return []
    throw new Error('Erro ao carregar histórico salarial.')
  }
  return await res.json()
}

export async function createEmployeeCompensation(id: string, data: { salary: number; monthlyHours?: number; validFrom?: string; reason?: string }): Promise<void> {
  const res = await fetch(`/api/employees/${id}/compensation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || 'Erro ao registrar reajuste salarial.')
  }
}

export async function getEmployeeDocuments(id: string): Promise<EmployeeDocumentItem[]> {
  const res = await fetch(`/api/employees/${id}/documents`)
  if (!res.ok) {
    if (res.status === 403) return []
    throw new Error('Erro ao carregar documentos.')
  }
  return await res.json()
}

export async function uploadEmployeeDocument(id: string, formData: FormData): Promise<EmployeeDocumentItem> {
  const res = await fetch(`/api/employees/${id}/documents`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || 'Erro ao enviar documento.')
  }
  return await res.json()
}

export async function deleteEmployeeDocument(employeeId: string, documentId: string): Promise<void> {
  const res = await fetch(`/api/employees/${employeeId}/documents/${documentId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Erro ao excluir documento.')
}

export async function getEmployeeAuditLogs(id: string): Promise<EmployeeAuditLogItem[]> {
  const res = await fetch(`/api/employees/${id}/audit-logs`)
  if (!res.ok) {
    if (res.status === 403) return []
    throw new Error('Erro ao carregar trilha de auditoria.')
  }
  return await res.json()
}
