export type AgendaScope = 'mine' | 'team'
export type CalendarEventType = 'meeting' | 'deadline' | 'appointment' | 'vacation'
export type CalendarVisibility = 'personal' | 'team'

export type CalendarEventRecord = {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  eventType: CalendarEventType
  visibility: CalendarVisibility
  description: string
  location: string | null
  projectId: string | null
  projectName: string | null
  clientId: string | null
  clientName: string | null
  ownerUserId: string | null
  ownerName: string | null
}

export type AgendaPermissions = { canViewTeam: boolean; canCreateTeam: boolean }

export type AgendaData = { events: CalendarEventRecord[]; permissions: AgendaPermissions }

export type CreateCalendarEventInput = {
  title: string
  startsAt: string
  endsAt?: string
  eventType: CalendarEventType
  visibility: CalendarVisibility
  description?: string
  location?: string
  projectId?: string
}

export type UpdateCalendarEventInput = CreateCalendarEventInput

async function readJson<T>(response: Response) {
  const payload = await response.json().catch(() => null) as T | { error?: string } | null
  if (!response.ok) throw new Error(payload && typeof payload === 'object' && 'error' in payload ? payload.error ?? 'Não foi possível carregar a agenda.' : 'Não foi possível carregar a agenda.')
  return payload as T
}

export async function getAgenda(scope: AgendaScope): Promise<AgendaData> {
  const response = await fetch(`/api/agenda?scope=${scope}`, { headers: { Accept: 'application/json' } })
  return readJson<AgendaData>(response)
}

export async function createCalendarEvent(input: CreateCalendarEventInput) {
  const response = await fetch('/api/agenda', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  return readJson<{ event: CalendarEventRecord }>(response)
}

export async function updateCalendarEvent(id: string, input: UpdateCalendarEventInput) {
  const response = await fetch(`/api/agenda/${id}`, { method: 'PATCH', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  return readJson<{ ok: true }>(response)
}

export async function deleteCalendarEvent(id: string) {
  const response = await fetch(`/api/agenda/${id}`, { method: 'DELETE', headers: { Accept: 'application/json' } })
  if (!response.ok) await readJson<{ ok: true }>(response)
}
