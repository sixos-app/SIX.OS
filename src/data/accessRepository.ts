export type AccessSession = {
  id: string
  name: string
  email: string
  role: string
}

export async function getAccessSession(): Promise<AccessSession | null> {
  try {
    const response = await fetch('/api/session', { headers: { Accept: 'application/json' } })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null

    const payload = await response.json() as { user?: AccessSession }
    return payload.user ?? null
  } catch {
    return null
  }
}
