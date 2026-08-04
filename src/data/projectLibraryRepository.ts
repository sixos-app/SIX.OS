export type ProjectLibraryFolder = {
  id: string
  name: string
  slug: string
  fileCount: number
}

export type ProjectLibraryFile = {
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

export type ProjectLibrary = {
  folders: ProjectLibraryFolder[]
  files: ProjectLibraryFile[]
}

export type UploadProjectLibraryFileInput = {
  projectId: string
  folderId: string
  file: File
}

export async function createProjectLibraryFolder(projectId: string, name: string): Promise<ProjectLibraryFolder> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/library/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name }),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string; folder?: ProjectLibraryFolder }
  if (!response.ok || !payload.folder) throw new Error(payload.error ?? 'Não foi possível criar a pasta')
  return payload.folder
}

const standardFolders = [
  ['Logo', 'logo'],
  ['KV', 'kv'],
  ['Vídeos', 'videos'],
  ['Artes', 'artes'],
  ['Briefing', 'briefing'],
  ['Contrato', 'contrato'],
  ['Outros', 'outros'],
] as const

export const projectLibrarySeed: ProjectLibrary = {
  folders: standardFolders.map(([name, slug]) => ({ id: `folder-preview-${slug}`, name, slug, fileCount: 0 })),
  files: [],
}

export async function getProjectLibrary(projectId: string): Promise<ProjectLibrary> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/library`, { headers: { Accept: 'application/json' } })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Biblioteca indisponível')

  const payload = await response.json() as Partial<ProjectLibrary>
  return {
    folders: Array.isArray(payload.folders) ? payload.folders : projectLibrarySeed.folders,
    files: Array.isArray(payload.files) ? payload.files : [],
  }
}

export async function uploadProjectLibraryFile({ projectId, folderId, file }: UploadProjectLibraryFileInput): Promise<ProjectLibraryFile> {
  const form = new FormData()
  form.append('folderId', folderId)
  form.append('file', file)

  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/library/upload`, { method: 'POST', body: form })
  const payload = await response.json().catch(() => ({})) as { error?: string; file?: ProjectLibraryFile }
  if (!response.ok || !payload.file) throw new Error(payload.error ?? 'Não foi possível enviar o arquivo')
  return payload.file
}
