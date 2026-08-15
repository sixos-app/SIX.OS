import type { DashboardData } from './dashboard'

const apiBase = '/api'

export async function getDashboard(): Promise<DashboardData> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12000)
  let response: Response
  try {
    response = await fetch(`${apiBase}/dashboard`, { headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-store' })
  } finally {
    window.clearTimeout(timeout)
  }
  const payload = await response.json().catch(() => null) as (DashboardData & { error?: string }) | null
  if (!response.ok || !payload) throw new Error(payload?.error ?? 'Dashboard indisponível')
  return payload
}

export async function completeMission(missionId: string): Promise<void> {
  const response = await fetch(`${apiBase}/missions/${missionId}/complete`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('Não foi possível concluir a missão')
}
