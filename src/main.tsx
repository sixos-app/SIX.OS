import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const originalFetch = window.fetch
window.fetch = async (...args) => {
  const response = await originalFetch(...args)
  const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '')
  const isProtectedApi = url.includes('/api/') && !url.includes('/api/auth/login') && !url.includes('/api/session')
  if (response.status === 401 && isProtectedApi) {
    window.dispatchEvent(new CustomEvent('sixos:session-expired'))
  } else if (response.status === 403) {
    if (url.includes('/api/') && !url.includes('/api/auth/login') && !url.includes('/api/session')) {
      window.dispatchEvent(new CustomEvent('sixos:access-denied'))
    }
  }
  return response
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
