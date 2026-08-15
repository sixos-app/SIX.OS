import type { Project } from './dashboard'

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Não foi possível salvar o projeto')
  return payload
}

export async function createProject(input: { name: string; clientId: string; dueAt: string; tone: Project['tone'] }) {
  const payload = await requestJson<{ project: Project }>('/api/projects', { method: 'POST', body: JSON.stringify(input) })
  return payload.project
}

export function updateProject(id: string, input: { status: string; dueAt: string; nextStep: string }) {
  return requestJson<{ success: true; status: string; dueAt: string | null; nextStep: string; activity: string }>(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
