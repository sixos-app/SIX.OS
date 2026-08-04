import { dashboardSeed, type DashboardData } from './dashboard'

const apiBase = '/api'

export async function getDashboard(): Promise<DashboardData> {
  try {
    const response = await fetch(`${apiBase}/dashboard`, { headers: { Accept: 'application/json' } })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Dashboard indisponível')

    const remoteDashboard = await response.json() as Omit<DashboardData, 'projects' | 'agenda' | 'team' | 'analytics' | 'library' | 'notifications'>
    return { ...dashboardSeed, ...remoteDashboard, projects: dashboardSeed.projects, agenda: dashboardSeed.agenda, team: dashboardSeed.team, analytics: dashboardSeed.analytics, library: dashboardSeed.library, notifications: dashboardSeed.notifications }
  } catch {
    return dashboardSeed
  }
}

export async function completeMission(missionId: string): Promise<void> {
  try {
    const response = await fetch(`${apiBase}/missions/${missionId}/complete`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) throw new Error('Não foi possível concluir a missão')
  } catch {}
}
