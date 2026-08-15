import { type FormEvent, useState } from 'react'
import { LogoWhite } from '../../Logo'
import { loginWithPassword, type AccessSession } from '../../data/accessRepository'

export function LoginPage({ onLoginSuccess }: { onLoginSuccess?: (session: AccessSession) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const phrases = [
    'Tornar possível é viver o extraordinário.',
    'Ideias fortes merecem execução extraordinária.',
    'A próxima grande entrega começa por aqui.',
  ]
  const phrase = phrases[new Date().getDate() % phrases.length]

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedUsername = username.trim()

    if (!normalizedUsername || !password) {
      setMessage('Informe seu login e senha para continuar.')
      return
    }

    setIsSubmitting(true)
    setMessage('')
    const result = await loginWithPassword(normalizedUsername, password)
    setIsSubmitting(false)
    if (result.user) {
      if (onLoginSuccess) {
        onLoginSuccess(result.user)
      } else {
        window.location.assign('/')
      }
      return
    }

    setMessage(result.error ?? 'Não foi possível entrar.')
  }

  return (
    <main className="login-preview">
      <a className="login-back" href="/">← Voltar ao app</a>
      <div className="login-preview-shell">
        <section className="login-art">
          <div className="login-brand">
            <LogoWhite className="login-brand-logo" />
          </div>
          <p className="login-eyebrow">SISTEMA OPERACIONAL DA AGÊNCIA</p>
          <h1>Onde a operação encontra o <em>extraordinário.</em></h1>
          <p className="login-phrase">“{phrase}”</p>
          <div className="login-orbits" aria-hidden="true">
            <i className="login-orbit login-orbit-one" />
            <i className="login-orbit login-orbit-two" />
            <b>+</b>
          </div>
        </section>

        <section className="login-form-panel" aria-labelledby="login-title">
          <span className="login-panel-kicker">ACESSO SIX.OS</span>
          <h2 id="login-title">Entre para fazer o <em>impossível.</em></h2>
          <p>Use seu login profissional para acessar a operação da SIX.</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              <span>LOGIN OU E-MAIL</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="seu.login" />
            </label>
            <label>
              <span>SENHA</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Sua senha" />
            </label>
            <button className="login-primary-action" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : <>Continuar <span>→</span></>}</button>
          </form>
          {message && <p className="login-message" role="status">{message}</p>}
          <div className="login-divider"><span>OU, EM BREVE</span></div>
          <div className="login-provider-grid">
            <button className="login-provider-button" type="button" disabled>Google <small>EM BREVE</small></button>
            <button className="login-provider-button" type="button" disabled>Microsoft <small>EM BREVE</small></button>
          </div>
          <p className="login-notice">Use somente sua credencial individual. Tentativas repetidas de acesso são temporariamente bloqueadas.</p>
        </section>
      </div>
    </main>
  )
}
