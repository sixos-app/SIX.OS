import { useCallback, useEffect, useRef, useState } from 'react'
import { AppShell } from './components/AppShell'
import { LoginPage } from './components/auth/LoginPage'
import { PermissionProvider } from './components/PermissionProvider'
import { getAccessSession, type AccessSession } from './data/accessRepository'

export default function App() {
  const [accessSession, setAccessSession] = useState<AccessSession | null>(null)
  const [loading, setLoading] = useState(true)
  const sessionRequestRef = useRef<Promise<AccessSession | null> | null>(null)
  const lastSessionResumeRef = useRef(0)

  const reloadSession = useCallback(async () => {
    if (sessionRequestRef.current) return sessionRequestRef.current

    const request = getAccessSession()
    sessionRequestRef.current = request
    try {
      const session = await request
      setAccessSession(session)
    } catch {
      // Mantém a sessão atual durante falhas transitórias de rede ou timeout.
    } finally {
      if (sessionRequestRef.current === request) sessionRequestRef.current = null
    }
  }, [])

  useEffect(() => {
    void reloadSession().finally(() => setLoading(false))
    const handleRefresh = () => { void reloadSession() }
    const handleResume = () => {
      if (document.hidden || Date.now() - lastSessionResumeRef.current < 1000) return
      lastSessionResumeRef.current = Date.now()
      void reloadSession()
    }
    const handleSessionExpired = () => setAccessSession(null)
    window.addEventListener('sixos:refresh-session', handleRefresh)
    window.addEventListener('pageshow', handleResume)
    document.addEventListener('visibilitychange', handleResume)
    window.addEventListener('sixos:session-expired', handleSessionExpired)
    return () => {
      window.removeEventListener('sixos:refresh-session', handleRefresh)
      window.removeEventListener('pageshow', handleResume)
      document.removeEventListener('visibilitychange', handleResume)
      window.removeEventListener('sixos:session-expired', handleSessionExpired)
    }
  }, [reloadSession])

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#171717', color: '#c6ff38', fontFamily: 'monospace', fontSize: '12px' }}>
        SIX.OS CARREGANDO...
      </div>
    )
  }

  if (!accessSession) return <LoginPage onLoginSuccess={(session) => setAccessSession(session)} />

  return (
    <PermissionProvider capabilities={accessSession?.capabilities}>
      <AppShell accessSession={accessSession} setAccessSession={setAccessSession} reloadSession={reloadSession} />
    </PermissionProvider>
  )
}
