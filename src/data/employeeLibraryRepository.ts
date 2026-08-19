export type EmployeeLibraryFile = {
  id: string
  folderId: string | null
  name: string
  fileType: string
  sizeBytes: number | null
  storageProvider: 'pending' | 'r2' | 'mega_link'
  version: number
  updatedAt: string
  historyCount: number
}

export type EmployeeLibraryFolder = {
  id: string
  name: string
  slug: string
  fileCount: number
}

export type EmployeeLibrary = {
  folders: EmployeeLibraryFolder[]
  files: EmployeeLibraryFile[]
}

export const employeeLibrarySeed: EmployeeLibrary = {
  folders: [],
  files: [],
}

export async function getEmployeeLibrary(employeeId: string): Promise<EmployeeLibrary> {
  const response = await fetch(`/api/employees/${employeeId}/library`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Não foi possível carregar a biblioteca do colaborador')
  return await response.json()
}

export async function createEmployeeLibraryFolder(employeeId: string, name: string): Promise<EmployeeLibraryFolder> {
  const response = await fetch(`/api/employees/${employeeId}/library/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(error?.error ?? 'Não foi possível criar a pasta')
  }
  const result = await response.json() as { folder: EmployeeLibraryFolder }
  return result.folder
}

export async function uploadEmployeeLibraryFile(params: { employeeId: string; folderId: string; file: File }): Promise<EmployeeLibraryFile> {
  const formData = new FormData()
  formData.append('folderId', params.folderId)
  formData.append('file', params.file)

  const response = await fetch(`/api/employees/${params.employeeId}/library/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(error?.error ?? 'Não foi possível enviar o arquivo')
  }
  const result = await response.json() as { file: EmployeeLibraryFile }
  return result.file
}

export async function deleteEmployeeLibraryFile(employeeId: string, fileId: string): Promise<void> {
  const response = await fetch(`/api/employees/${employeeId}/library/files/${fileId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(error?.error ?? 'Não foi possível excluir o arquivo')
  }
}
