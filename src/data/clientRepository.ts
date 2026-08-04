export type ClientIdentity = {
  id: string
  name: string
  shortCode: string | null
  imageUrl: string | null
}

export const clientIdentitySeed: ClientIdentity[] = [
  { id: 'client-shopping-uberaba', name: 'Shopping Uberaba', shortCode: 'SHO', imageUrl: null },
  { id: 'client-sicredi', name: 'Sicredi', shortCode: 'SIC', imageUrl: null },
  { id: 'client-radio-cultura', name: 'Rádio Cultura', shortCode: 'RDC', imageUrl: null },
]

export async function getClientIdentities(): Promise<ClientIdentity[]> {
  const response = await fetch('/api/clients', { headers: { Accept: 'application/json' } })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Clientes indisponíveis')
  const payload = await response.json() as { clients?: ClientIdentity[] }
  return payload.clients ?? []
}
