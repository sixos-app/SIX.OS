export type MissionChecklistItem = {
  id: string
  label: string
  isCompleted: number
  position: number
}

export type MissionComment = {
  id: string
  body: string
  author: string
  createdAt: string
}

export type MissionAttachment = {
  id: string
  libraryFileId: string
  fileName: string
  fileVersion: number
  createdAt: string
}

export type MissionHistoryItem = {
  id: string
  action: string
  detail: string | null
  actor: string | null
  createdAt: string
}

export type MissionDetails = {
  mission: {
    id: string
    title: string
    description: string
    client: string
    projectId: string
    project: string
    assigneeId: string | null
    assignee: string | null
    status: string
    priority: string
    dueAt: string | null
    xpReward: number
    ideasReward: number
    rewardLabel: string | null
    approvalStatus: string
    createdAt: string
    completedAt: string | null
    approvedAt: string | null
  }
  checklist: MissionChecklistItem[]
  comments: MissionComment[]
  attachments: MissionAttachment[]
  history: MissionHistoryItem[]
  permissions: { canManage: boolean; canApprove: boolean }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json', ...(init?.headers ?? {}) }, ...init })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Não foi possível atualizar a missão')
  return payload
}

export function getMissionDetails(missionId: string) {
  return requestJson<MissionDetails>(`/api/missions/${encodeURIComponent(missionId)}`)
}

export function addMissionChecklistItem(missionId: string, label: string) {
  return requestJson<{ item: MissionChecklistItem }>(`/api/missions/${encodeURIComponent(missionId)}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }) })
}

export function setMissionChecklistItem(missionId: string, itemId: string, isCompleted: boolean) {
  return requestJson<{ id: string; isCompleted: number }>(`/api/missions/${encodeURIComponent(missionId)}/checklist`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: itemId, isCompleted }) })
}

export function addMissionComment(missionId: string, body: string) {
  return requestJson<{ comment: MissionComment }>(`/api/missions/${encodeURIComponent(missionId)}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) })
}

export function attachProjectLibraryFile(missionId: string, libraryFileId: string) {
  return requestJson<{ attachment: MissionAttachment }>(`/api/missions/${encodeURIComponent(missionId)}/attachments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ libraryFileId }) })
}

export function requestMissionCompletion(missionId: string) {
  return requestJson<{ missionId: string; status?: string }>(`/api/missions/${encodeURIComponent(missionId)}/complete`, { method: 'POST' })
}

export type SaveMissionInput = {
  title: string
  projectId: string
  assigneeId: string
  dueAt: string
  priority: 'normal' | 'urgent'
  description?: string
  xpReward?: number
}

export type SavedMission = {
  id: string
  title: string
  projectId: string
  assigneeId: string
  dueAt: string
  priority: string
  description: string
  xpReward: number
  rewardLabel: string | null
}

export function createMission(input: SaveMissionInput) {
  return requestJson<SavedMission>('/api/missions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
}

export function updateMission(missionId: string, input: Partial<SaveMissionInput>) {
  return requestJson<{ mission: SavedMission }>(`/api/missions/${encodeURIComponent(missionId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
}
