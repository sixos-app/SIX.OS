export type AccessCapabilities = Record<string, string[]>

export type AccessSession = {
  id: string
  name: string
  email: string
  role: string
  capabilities?: AccessCapabilities
}

type LoginResult = { user?: AccessSession; capabilities?: AccessCapabilities; error?: string }

const SESSION_TIMEOUT_MS = 10000
const LOGIN_TIMEOUT_MS = 15000

export async function getAccessSession(): Promise<AccessSession | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS)
  try {
    const response = await fetch('/api/session', { headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-store' })
    if (response.status === 401) return null
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Não foi possível validar a sessão.')
    }

    const payload = await response.json() as { user?: AccessSession; capabilities?: AccessCapabilities }
    if (!payload.user) throw new Error('A resposta da sessão é inválida.')
    return { ...payload.user, capabilities: payload.capabilities }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('A validação da sessão excedeu o tempo limite.')
    }
    throw error
  }
  finally { window.clearTimeout(timeout) }
}

export async function loginWithPassword(username: string, password: string): Promise<LoginResult> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS)
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    })

    if (response.headers.get('content-type')?.includes('application/json')) {
      const payload = await response.json() as LoginResult
      if (response.ok && payload.user) {
        return { user: { ...payload.user, capabilities: payload.capabilities } }
      }
      return { error: payload.error || 'Login ou senha inválidos' }
    }
    return { error: 'Login ou senha inválidos' }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { error: 'O login demorou mais que o esperado. Verifique sua conexão e tente novamente.' }
    }
    return { error: 'O serviço de acesso não está disponível neste ambiente.' }
  } finally {
    window.clearTimeout(timeout)
  }
}
