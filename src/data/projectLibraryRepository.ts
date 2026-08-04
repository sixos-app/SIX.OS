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
