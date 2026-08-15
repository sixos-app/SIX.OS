import type { Bindings } from './_access'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToBase64(bytes: Uint8Array) {
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value)
}

function base64ToBytes(value: string) {
  const decoded = atob(value)
  return Uint8Array.from(decoded, character => character.charCodeAt(0))
}

async function encryptionKey(env: Bindings) {
  if (!env.INTEGRATIONS_ENCRYPTION_KEY) throw new Error('INTEGRATIONS_ENCRYPTION_KEY is not configured')
  const rawKey = base64ToBytes(env.INTEGRATIONS_ENCRYPTION_KEY.trim())
  if (rawKey.byteLength !== 32) throw new Error('INTEGRATIONS_ENCRYPTION_KEY must contain exactly 32 bytes in base64')
  return crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptIntegrationConfig(env: Bindings, config: Record<string, unknown>) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(env),
    encoder.encode(JSON.stringify(config)),
  )
  return `enc:v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`
}

export async function decryptIntegrationConfig<T extends Record<string, unknown>>(env: Bindings, value: string): Promise<T> {
  const [prefix, version, ivValue, encryptedValue] = value.split(':')
  if (prefix !== 'enc' || version !== 'v1' || !ivValue || !encryptedValue) throw new Error('Integration configuration is not encrypted')
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivValue) },
    await encryptionKey(env),
    base64ToBytes(encryptedValue),
  )
  return JSON.parse(decoder.decode(decrypted)) as T
}

export function isAllowedSlackWebhook(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'hooks.slack.com' && url.pathname.startsWith('/services/')
  } catch {
    return false
  }
}
