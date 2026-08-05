import type { ProjectLibrary, ProjectLibraryFile, ProjectLibraryFolder } from './projectLibraryRepository'

export async function getClientLibrary(clientId: string): Promise<ProjectLibrary> {
  const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}/library`)
  if (!response.ok) throw new Error('Biblioteca do cliente indisponível')
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
