import type { Bindings } from './api/_access'

function refererMatchesOrigin(referer: string, expectedOrigin: string) {
  try {
    return new URL(referer).origin === expectedOrigin
  } catch {
    return false
  }
}

export const onRequest: PagesFunction<Bindings> = async ({ request, next }) => {
  // CORS & CSRF Origin Check
  const origin = request.headers.get('Origin')
  const requestOrigin = new URL(request.url).origin
  const originMatchesRequest = origin === requestOrigin
  
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  
  if (isStateChanging && request.url.includes('/api/')) {
    // CSRF Protection: Require valid Origin for state-changing API requests
    const referer = request.headers.get('Referer')
    let originValid: boolean

    if (origin !== null) {
      originValid = originMatchesRequest
    } else if (referer !== null) {
      originValid = refererMatchesOrigin(referer, requestOrigin)
    } else {
      return new Response('CSRF Protection: Missing Origin', { status: 403 })
    }

    if (!originValid) {
      return new Response('CSRF Protection: Untrusted Origin', { status: 403 })
    }
  }

  // Preflight
  if (request.method === 'OPTIONS') {
    if (originMatchesRequest) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': requestOrigin,
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
  if (originMatchesRequest) {
    secureHeaders.set('Access-Control-Allow-Origin', requestOrigin)
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
