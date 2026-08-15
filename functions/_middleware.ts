import type { Bindings } from './api/_access'

const ALLOWED_ORIGINS = [
  'https://sixos.app',
  'https://www.sixos.app'
]

// Extra allowed origins for preview/dev if configured via environment variables
function getAllowedOrigins(env: Bindings) {
  const origins = [...ALLOWED_ORIGINS]
  // Add CF Pages branch preview domains if applicable
  // Since we don't have access to CF_PAGES_URL safely in all contexts securely without spoofing, 
  // we rely on an explicit environment whitelist if needed.
  if ((env as any).EXTRA_CORS_ORIGINS) {
    origins.push(...(env as any).EXTRA_CORS_ORIGINS.split(',').map((s: string) => s.trim()))
  }
  return origins
}

export const onRequest: PagesFunction<Bindings> = async ({ request, env, next }) => {
  // CORS & CSRF Origin Check
  const origin = request.headers.get('Origin')
  const allowedOrigins = getAllowedOrigins(env)
  
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  
  if (isStateChanging && request.url.includes('/api/')) {
    // CSRF Protection: Require valid Origin for state-changing API requests
    const referer = request.headers.get('Referer')
    const requestOrigin = new URL(request.url).origin
    
    let originValid = false
    
    if (origin) {
      if (allowedOrigins.includes(origin) || origin === requestOrigin) {
        originValid = true
      }
    } else if (referer) {
      try {
        if (new URL(referer).origin === requestOrigin || allowedOrigins.includes(new URL(referer).origin)) {
          originValid = true
        }
      } catch {
        originValid = false
      }
    } else {
      return new Response('CSRF Protection: Missing Origin', { status: 403 })
    }

    if (!originValid) {
      return new Response('CSRF Protection: Untrusted Origin', { status: 403 })
    }
  }

  // Preflight
  if (request.method === 'OPTIONS') {
    if (origin && allowedOrigins.includes(origin)) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      })
    }
    return new Response(null, { status: 204 })
  }

  // Process the actual request
  const response = await next()

  // Inject Security Headers
  const secureHeaders = new Headers(response.headers)
  
  // CORS Response Header
  if (origin && allowedOrigins.includes(origin)) {
    secureHeaders.set('Access-Control-Allow-Origin', origin)
    secureHeaders.append('Vary', 'Origin')
  }

  secureHeaders.set('X-Content-Type-Options', 'nosniff')
  secureHeaders.set('X-Frame-Options', 'DENY')
  secureHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  secureHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // CSP with frame-ancestors none
  secureHeaders.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.cloudflareaccess.com; frame-ancestors 'none';")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: secureHeaders
  })
}
