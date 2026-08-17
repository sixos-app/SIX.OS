import type { ClientIdentity } from '../data/clientRepository'
import type { Mission, Project, TeamMember } from '../data/dashboard'

export const readNotificationsStorageKey = 'six-os:read-notifications'

export function deadlineToMissionDate(value: string): string {
  if (!value) return new Date().toISOString()
  const directDate = Date.parse(value)
  if (!Number.isNaN(directDate)) return new Date(directDate).toISOString()
  const date = new Date()
  const time = value.match(/(\d{1,2})(?::(\d{2}))?\s*h?/i)
  if (value.toLocaleLowerCase('pt-BR').includes('amanhã')) date.setDate(date.getDate() + 1)
  if (time) date.setHours(Number(time[1]), Number(time[2] ?? 0), 0, 0)
  return date.toISOString()
}

export function missionDateTimeInputValue(value: string): string {
  const date = new Date(deadlineToMissionDate(value))
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function formatMissionDeadline(value: string): string {
  const date = new Date(deadlineToMissionDate(value))
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  const dateStr = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const todayStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  if (dateStr === todayStr) return `Hoje · ${time}`
  if (dateStr === tomorrowStr) return `Amanhã · ${time}`
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} · ${time}`
}

export function isMissionCompleted(mission: Mission, locallyCompleted: string[]): boolean {
  return mission.status === 'completed' || locallyCompleted.includes(mission.id)
}

export function formatElapsedTimer(startedAt: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000))
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

export function getStoredReadNotifications(userId?: string): string[] {
  try {
    const key = userId ? `${readNotificationsStorageKey}:${userId}` : readNotificationsStorageKey
    let storedNotifications = window.localStorage.getItem(key)
    if (!storedNotifications && userId) {
      // Safe migration: check if old un-scoped key exists and migrate it
      const legacyStored = window.localStorage.getItem(readNotificationsStorageKey)
      if (legacyStored) {
        window.localStorage.setItem(key, legacyStored)
        window.localStorage.removeItem(readNotificationsStorageKey)
        storedNotifications = legacyStored
      }
    }
    if (!storedNotifications) return []

    const parsedNotifications = JSON.parse(storedNotifications)
    return Array.isArray(parsedNotifications) && parsedNotifications.every((notificationId) => typeof notificationId === 'string') ? parsedNotifications : []
  } catch {
    return []
  }
}

export function saveReadNotifications(notificationIds: string[], userId?: string): void {
  try {
    const key = userId ? `${readNotificationsStorageKey}:${userId}` : readNotificationsStorageKey
    window.localStorage.setItem(key, JSON.stringify(notificationIds))
  } catch {}
}

export function enrichProjectClientIdentity(project: Project, clients: ClientIdentity[]): Project {
  const client = clients.find((item) => item.name === project.client)
  if (!client) return project
  return { ...project, code: client.shortCode ?? project.code, clientImageUrl: client.imageUrl }
}

export function getInitials(name: string): string {
  return name.split(/\s+/).map((part) => part.charAt(0)).join('').slice(0, 2).toLocaleUpperCase('pt-BR') || 'SIX'
}

export function getProjectCollaborators(project: Project, missions: Mission[], team: TeamMember[]): TeamMember[] {
  const assigneeIds = new Set(missions.filter((mission) => mission.projectId === project.id).flatMap((mission) => mission.assigneeId ? [mission.assigneeId] : []))
  const assignedMembers = team.filter((member) => assigneeIds.has(member.id))
  return assignedMembers.length > 0 ? assignedMembers : team.filter((member) => project.members.includes(member.initials))
}

export function getProjectHealth(project: Project, missions: Mission[], completed: string[]): { label: string; tone: 'neutral' | 'healthy' | 'attention' } {
  const projectMissions = missions.filter((mission) => mission.projectId === project.id)
  const openMissions = projectMissions.filter((mission) => !completed.includes(mission.id))
  if (projectMissions.length === 0) return { label: 'A INICIAR', tone: 'neutral' }
  if (openMissions.length === 0) return { label: 'CONCLUÍDO', tone: 'healthy' }
  if (openMissions.some((mission) => mission.urgent)) return { label: 'ATENÇÃO', tone: 'attention' }
  return { label: 'NO RITMO', tone: 'healthy' }
}
