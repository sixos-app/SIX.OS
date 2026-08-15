export type ClientIdentity = {
  id: string
  name: string
  shortCode: string | null
  imageUrl: string | null
  description: string | null
}

export async function getClientIdentities(): Promise<ClientIdentity[]> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch('/api/clients', { headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-store' })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Clientes indisponíveis')
    const payload = await response.json() as { clients?: ClientIdentity[] }
    return payload.clients ?? []
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('A consulta de clientes excedeu o tempo limite.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function updateClientDescription(clientId: string, description: string): Promise<string | null> {
  const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, {
    method: 'PATCH',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  })
  const payload = await response.json().catch(() => ({})) as { description?: string | null; error?: string }
  if (!response.ok || !Object.prototype.hasOwnProperty.call(payload, 'description')) {
    throw new Error(payload.error ?? 'Não foi possível salvar a descrição do cliente')
  }
  return payload.description ?? null
}
