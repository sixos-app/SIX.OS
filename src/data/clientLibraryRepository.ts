import type { ProjectLibrary, ProjectLibraryFile, ProjectLibraryFolder } from './projectLibraryRepository'

export class ClientLibraryRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export async function getClientLibrary(clientId: string): Promise<ProjectLibrary> {
  const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}/library`)
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new ClientLibraryRequestError(payload.error ?? 'Biblioteca do cliente indisponível', response.status)
  }
  return response.json() as Promise<ProjectLibrary>
}

export async function createClientLibraryFolder(clientId: string, name: string): Promise<ProjectLibraryFolder> {
  const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}/library/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name }),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string; folder?: ProjectLibraryFolder }
  if (!response.ok || !payload.folder) throw new Error(payload.error ?? 'Não foi possível criar a pasta')
  return payload.folder
}

export async function uploadClientLibraryFile(clientId: string, folderId: string, file: File): Promise<ProjectLibraryFile> {
  const form = new FormData(); form.append('folderId', folderId); form.append('file', file)
  const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}/library/upload`, { method: 'POST', body: form })
  const payload = await response.json() as { file?: ProjectLibraryFile; error?: string }
  if (!response.ok || !payload.file) throw new Error(payload.error ?? 'Não foi possível enviar o arquivo')
  return payload.file
}

export async function deleteClientLibraryFile(clientId: string, fileId: string): Promise<void> {
  const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}/library/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Não foi possível excluir o arquivo')
}

export async function provisionClientLibrary(clientId: string): Promise<Array<{ slug: string; name: string }>> {
  const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}/library/provision`, { method: 'POST', headers: { Accept: 'application/json' } })
  const payload = await response.json().catch(() => ({})) as { folders?: Array<{ slug: string; name: string }>; error?: string }
  if (!response.ok || !payload.folders) throw new Error(payload.error ?? 'Não foi possível preparar a biblioteca do cliente')
  return payload.folders
}
