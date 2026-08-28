import type { Bindings } from '../_access'

export const CLIENT_LIBRARY_FOLDERS = [
  ['logo', 'Logo'],
  ['brandbook', 'Brandbook'],
  ['briefing', 'Briefing'],
  ['contrato', 'Contrato'],
  ['referencias', 'Referências'],
  ['outros', 'Outros'],
] as const

export function normalizeOptionalString(value: unknown, limit: number, field: string) {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`${field} inválido`)
  const normalized = value.trim()
  if (normalized.length > limit) throw new Error(`${field} excede o limite permitido`)
  return normalized || null
}

export function normalizeCnpj(value: unknown) {
  const normalized = normalizeOptionalString(value, 64, 'CNPJ')
  if (normalized === null) return null
  const digits = normalized.replace(/[.\-/\s]/g, '')
  if (!/^\d{14}$/.test(digits)) throw new Error('CNPJ deve conter exatamente 14 dígitos')
  return digits
}

export function normalizeWebsite(value: unknown) {
  const normalized = normalizeOptionalString(value, 500, 'Website')
  if (normalized === null) return null
  try {
    const url = new URL(normalized)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
  } catch {
    throw new Error('Website deve usar http ou https')
  }
  return normalized
}

export function normalizeCountry(value: unknown) {
  const normalized = normalizeOptionalString(value, 2, 'País')
  if (normalized === null) return null
  const country = normalized.toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('País deve usar código ISO de duas letras')
  return country
}

export function clientLibraryFolderStatements(env: Bindings, clientId: string) {
  return CLIENT_LIBRARY_FOLDERS.map(([slug, name], position) => env.DB.prepare(`
    INSERT OR IGNORE INTO client_library_folders (id, client_id, name, slug, position)
    VALUES (?, ?, ?, ?, ?)
  `).bind(`client-folder-${clientId}-${slug}`, clientId, name, slug, position + 1))
}

export async function provisionClientLibraryFolders(env: Bindings, clientId: string) {
  const statements = clientLibraryFolderStatements(env, clientId)
  await env.DB.batch(statements)
}
