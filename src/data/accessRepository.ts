export type AccessSession = {
  id: string
  name: string
  email: string
  role: string
}

type LoginResult = { user?: AccessSession; error?: string }

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

export async function loginWithPassword(username: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!response.headers.get('content-type')?.includes('application/json')) return { error: 'O serviço de acesso não está disponível neste ambiente.' }

    const payload = await response.json() as LoginResult
    return response.ok ? payload : { error: payload.error ?? 'Não foi possível entrar.' }
  } catch {
    return { error: 'O serviço de acesso não está disponível neste ambiente.' }
  }
}
