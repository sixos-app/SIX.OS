export type ClientIdentity = {
  id: string
  name: string
  shortCode: string | null
  imageUrl: string | null
  description: string | null
}

export type ClientAddress = {
  zipCode: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  country: string | null
}

export type ClientMaster = ClientIdentity & {
  corporateName: string | null
  tradeName: string | null
  cnpj: string | null
  stateRegistration: string | null
  municipalRegistration: string | null
  segment: string | null
  units: string | null
  accountManagerId: string | null
  status: 'active' | 'paused' | 'archived'
  brandbookUrl: string | null
  website: string | null
  address: ClientAddress
  createdAt: string
}

export type ClientContact = {
  id: string
  name: string
  roleTitle: string | null
  email: string | null
  phone: string | null
  isPrimary: number
  isActive: number
}

export type ClientContract = {
  id: string
  clientId: string
  monthlyDeliverables: number
  hourLimit: number
  agreedDeadlineDays: number
  revisionRounds: number
  monthlyBalance?: number
  contractValue?: number
  startDate: string
  endDate: string | null
  status: string
  renewalType: 'manual' | 'automatic' | null
  renewalDate: string | null
  billingFrequency: string | null
  billingDay: number | null
  commercialTerms: string | null
  notes: string | null
  clientName?: string
}

type ErrorPayload = { error?: string }

async function requestClient<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) }, ...init })
  const payload = await response.json().catch(() => ({})) as T & ErrorPayload
  if (!response.ok) throw new Error(payload.error ?? (response.status === 403 ? 'Você não tem permissão para acessar este cliente.' : 'Não foi possível concluir a operação.'))
  return payload
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

export async function getClient(clientId: string): Promise<ClientMaster> {
  const payload = await requestClient<{ client: ClientMaster }>(`/api/clients/${encodeURIComponent(clientId)}`)
  return payload.client
}

export async function updateClient(clientId: string, input: Record<string, unknown>): Promise<ClientMaster> {
  const payload = await requestClient<{ client: ClientMaster }>(`/api/clients/${encodeURIComponent(clientId)}`, { method: 'PATCH', body: JSON.stringify(input) })
  return payload.client
}

export async function getClientContacts(clientId: string): Promise<ClientContact[]> {
  return (await requestClient<{ contacts: ClientContact[] }>(`/api/clients/${encodeURIComponent(clientId)}/contacts`)).contacts
}

export async function createClientContact(clientId: string, input: Record<string, unknown>): Promise<ClientContact> {
  return (await requestClient<{ contact: ClientContact }>(`/api/clients/${encodeURIComponent(clientId)}/contacts`, { method: 'POST', body: JSON.stringify(input) })).contact
}

export async function updateClientContact(clientId: string, contactId: string, input: Record<string, unknown>): Promise<ClientContact> {
  return (await requestClient<{ contact: ClientContact }>(`/api/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contactId)}`, { method: 'PATCH', body: JSON.stringify(input) })).contact
}

export async function deactivateClientContact(clientId: string, contactId: string): Promise<void> {
  await requestClient<Record<string, never>>(`/api/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contactId)}`, { method: 'DELETE' })
}

export async function getClientContracts(): Promise<ClientContract[]> {
  return requestClient<ClientContract[]>('/api/contracts')
}

export async function createClientContract(input: Record<string, unknown>): Promise<ClientContract> {
  return requestClient<ClientContract>('/api/contracts', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateClientContract(contractId: string, input: Record<string, unknown>): Promise<void> {
  await requestClient<Record<string, never>>(`/api/contracts/${encodeURIComponent(contractId)}`, { method: 'PATCH', body: JSON.stringify(input) })
}
