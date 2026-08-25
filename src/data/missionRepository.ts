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

export type MissionWorkflowStep = {
  id: string
  position: number
  departmentName: string
  status: 'pending' | 'active' | 'completed' | 'returned'
  responsibleUserId: string | null
  responsibleName: string | null
  completedByUserId: string | null
  completedByName: string | null
  completedAt: string | null
  stepType?: string | null
  expectedMinutes?: number | null
  reviewNotes?: string | null
}

export type MissionTimeTracking = {
  totalSeconds: number
  entriesCount: number
  recentEntries: Array<{
    id: string
    userId: string
    userName: string
    durationSeconds: number
    startedAt: string | null
    endedAt: string | null
    entryType: string
  }>
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
    expectedMinutes?: number | null
    xpReward: number
    ideasReward: number
    rewardLabel: string | null
    approvalStatus: string
    realizedCost?: number
    billingValue?: number
    costCenterId?: string | null
    currentWorkflowPosition?: number
    createdAt: string
    completedAt: string | null
    approvedAt: string | null
    startedAt: string | null
    boardId: string | null
    stageId: string | null
    stageName: string | null
    stageType: 'backlog' | 'ready' | 'doing' | 'review' | 'approval' | 'done' | null
    workTypeId?: string | null
  }
  checklist: MissionChecklistItem[]
  comments: MissionComment[]
  attachments: MissionAttachment[]
  history: MissionHistoryItem[]
  workflowSteps?: MissionWorkflowStep[]
  timeTracking?: MissionTimeTracking
  activeTimer: { id: string; startedAt: string } | null
  permissions: { canInteract: boolean; canManage: boolean; canApprove: boolean; canTrackTime: boolean }
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
  return requestJson<{ missionId: string; status?: string; currentDepartment?: string | null; nextDepartment?: string | null; awards?: Array<{ userId: string; userName: string; xp: number }> }>(`/api/missions/${encodeURIComponent(missionId)}/complete`, { method: 'POST' })
}

export async function deleteMission(missionId: string) {
  const response = await fetch(`/api/missions/${encodeURIComponent(missionId)}`, { method: 'DELETE', headers: { Accept: 'application/json' } })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error ?? 'Não foi possível excluir a missão')
  }
}

export function returnMissionWorkflow(missionId: string, targetPosition: number, reason?: string) {
  return requestJson<{ missionId: string; status: string; currentDepartment: string; nextDepartment: string | null }>(`/api/missions/${encodeURIComponent(missionId)}/workflow`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetPosition, reason }) })
}

export class TimerConflictError extends Error {
  constructor(message: string, public activeTimer: { missionTitle: string; missionId: string; id: string; startedAt: string }) {
    super(message)
    this.name = 'TimerConflictError'
  }
}

export async function startMissionTimer(missionId: string) {
  const response = await fetch(`/api/missions/${encodeURIComponent(missionId)}/timer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ action: 'start' })
  })
  const payload = await response.json().catch(() => ({})) as any
  if (!response.ok) {
    if (response.status === 409 && payload.activeTimer) {
      throw new TimerConflictError(payload.error, payload.activeTimer)
    }
    throw new Error(payload.error ?? 'Não foi possível iniciar o cronômetro')
  }
  return payload as { active: true; id: string; missionId: string; missionTitle: string; startedAt: string; elapsedSeconds: number }
}

export function stopMissionTimer(missionId: string) {
  return requestJson<{ active: false; missionId: string; elapsedSeconds?: number }>(`/api/missions/${encodeURIComponent(missionId)}/timer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) })
}

export type SaveMissionInput = {
  title: string
  projectId: string
  assigneeId: string
  dueAt: string
  expectedMinutes?: number | null
  priority: 'normal' | 'urgent'
  description?: string
  xpReward?: number
  xpRuleId?: string | null
  workTypeId?: string | null
  costCenterId?: string | null
  billingValue?: number
  workflowDepartments?: string[]
  workflowSteps?: Array<{ departmentName: string; responsibleUserId: string; stepType?: string; expectedMinutes?: number | null }>
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
  xpRuleId?: string | null
  workTypeId?: string | null
  boardId?: string | null
  stageId?: string | null
  stageName?: string | null
  stageType?: 'backlog' | 'ready' | 'doing' | 'review' | 'approval' | 'done' | null
  currentDepartment?: string | null
  nextDepartment?: string | null
  currentResponsibleUserId?: string | null
  nextResponsibleUserId?: string | null
  rewardLabel?: string | null
  costCenterId?: string | null
  billingValue?: number
}

export function createMission(input: SaveMissionInput) {
  return requestJson<SavedMission>('/api/missions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
}

export function updateMission(missionId: string, input: Partial<SaveMissionInput>) {
  return requestJson<{ mission: SavedMission }>(`/api/missions/${encodeURIComponent(missionId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
}
