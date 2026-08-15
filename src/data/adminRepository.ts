import type { ClientIdentity } from './clientRepository'

export type AdminTeamMember = {
  id: string
  name: string
  email: string
  username: string | null
  role: string
  roles: string[]
}

export type AdminRole = {
  code: string
  name: string
  description: string
  permissionCount: number
}

export type AdminOverview = {
  team: AdminTeamMember[]
  roles: AdminRole[]
  clientCount: number
}

export type CreateAdminUserInput = {
  name: string
  email: string
  roles: string[]
  username: string
  initialPassword: string
  department: string
  status: 'active' | 'blocked' | 'inactive'
}

export type CreateAdminClientInput = {
  name: string
  shortCode: string
  imageDataUrl: string | null
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const response = await fetch('/api/admin/overview', { headers: { Accept: 'application/json' } })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(response.status === 403 ? 'Você não tem permissão para acessar a administração.' : 'Administração indisponível.')
  }
  return await response.json() as AdminOverview
}

async function requestAdmin<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() as T & { error?: string } : null
  if (!response.ok) throw new Error(payload?.error ?? 'Não foi possível salvar o cadastro.')
  return payload as T
}

export async function createAdminUser(input: CreateAdminUserInput): Promise<AdminTeamMember> {
  const payload = await requestAdmin<{ member: AdminTeamMember }>('/api/admin/users', input)
  return payload.member
}

export async function createAdminClient(input: CreateAdminClientInput): Promise<ClientIdentity> {
  const payload = await requestAdmin<{ client: ClientIdentity }>('/api/admin/clients', input)
  return payload.client
}
