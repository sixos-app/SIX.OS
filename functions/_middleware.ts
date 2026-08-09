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
    const host = request.headers.get('Host')
    const referer = request.headers.get('Referer')
    
    let originValid = false
    
    if (origin) {
      if (allowedOrigins.includes(origin) || (host && origin.includes(host))) {
        originValid = true
      }
    } else if (referer) {
      if (host && referer.includes(host)) {
        originValid = true
      }
    } else {
      // Missing both Origin and Referer on a state-changing API request
      // We fail conservative for security (CSRF defense)
      if ((env as any).ALLOW_DEV_AUTH_BYPASS !== 'true') {
        return new Response('CSRF Protection: Missing Origin', { status: 403 })
      } else {
        // Only allow bypass locally
        originValid = true
      }
    }

    if (!originValid && (env as any).ALLOW_DEV_AUTH_BYPASS !== 'true') {
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
  }

  secureHeaders.set('X-Content-Type-Options', 'nosniff')
  secureHeaders.set('X-Frame-Options', 'DENY')
  secureHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  secureHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // CSP with frame-ancestors none
  secureHeaders.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.cloudflareaccess.com; frame-ancestors 'none';")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: secureHeaders
  })
}
