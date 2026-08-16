export type WorkTypeColorKey =
  | 'lime'
  | 'purple'
  | 'orange'
  | 'blue'
  | 'cyan'
  | 'turquoise'
  | 'yellow'
  | 'pink'
  | 'coral'
  | 'magenta'

export type WorkType = {
  id: string
  name: string
  defaultMinutes: number
  colorKey: WorkTypeColorKey
  isActive: boolean
  projectCount?: number
  missionCount?: number
  createdAt?: string
  updatedAt?: string
}

export const WORK_TYPE_COLORS: Array<{ key: WorkTypeColorKey; label: string; hex: string }> = [
  { key: 'lime', label: 'Verde Lima', hex: '#C6FF38' },
  { key: 'purple', label: 'Roxo Elétrico', hex: '#8B73FF' },
  { key: 'orange', label: 'Laranja Solar', hex: '#FF7047' },
  { key: 'blue', label: 'Azul Real', hex: '#4D7CFE' },
  { key: 'cyan', label: 'Ciano Claro', hex: '#38D9FF' },
  { key: 'turquoise', label: 'Turquesa', hex: '#2ED6A1' },
  { key: 'yellow', label: 'Amarelo Ouro', hex: '#FFD84D' },
  { key: 'pink', label: 'Rosa Shock', hex: '#FF5FA2' },
  { key: 'coral', label: 'Vermelho Coral', hex: '#FF4F5E' },
  { key: 'magenta', label: 'Magenta Neon', hex: '#D85CFF' },
]

export function formatWorkTypeMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h ${remainingMinutes}min`
}

export async function fetchWorkTypes(includeInactive = false): Promise<WorkType[]> {
  const response = await fetch(`/api/work-types${includeInactive ? '?include_inactive=true' : ''}`, { credentials: 'same-origin' })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(errorData?.error ?? 'Não foi possível carregar os tipos de trabalho.')
  }
  const data = await response.json() as { workTypes: WorkType[] }
  return data.workTypes ?? []
}

export async function createWorkType(input: {
  name: string
  defaultMinutes?: number
  colorKey?: WorkTypeColorKey
}): Promise<WorkType> {
  const response = await fetch('/api/work-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(errorData?.error ?? 'Não foi possível criar o tipo de trabalho.')
  }
  const data = await response.json() as { workType: WorkType }
  return data.workType
}

export async function updateWorkType(
  id: string,
  input: {
    name?: string
    defaultMinutes?: number
    colorKey?: WorkTypeColorKey
    isActive?: boolean
  }
): Promise<WorkType> {
  const response = await fetch(`/api/work-types/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(errorData?.error ?? 'Não foi possível atualizar o tipo de trabalho.')
  }
  const data = await response.json() as { workType: WorkType }
  return data.workType
}

export async function deleteWorkType(id: string): Promise<void> {
  const response = await fetch(`/api/work-types/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(errorData?.error ?? 'Não foi possível desativar o tipo de trabalho.')
  }
}
