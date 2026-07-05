import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateAuthUrl } from '../auth'
import logoRenamer from '../assets/logo-br.svg'
import logoSearch from '../assets/logo-bs.svg'
import { version as appVersion } from '../../package.json'
import './LoginPage.css'

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)
const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

export default function LoginPage({ onLogin, isDark, onToggleTheme }) {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const handleGoogleLogin = () => {
    try {
      const authUrl = generateAuthUrl()
      window.location.href = authUrl
    } catch (err) {
      setError('Errore durante l\'autenticazione: ' + err.message)
    }
  }

  return (
    <div className="login-container">
      {onToggleTheme && (
        <button onClick={onToggleTheme} className="login-theme-toggle" title="Tema">
          {isDark ? <IconSun /> : <IconMoon />}
        </button>
      )}
      <div className="login-card">
        <div className="login-header">
          <div className="login-logos">
            <img src={logoRenamer} alt="" className="login-logo" />
            <img src={logoSearch} alt="" className="login-logo" />
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="login-content">
          <button onClick={handleGoogleLogin} className="btn-google">
            Accedi con Google
          </button>
        </div>

        <div className="login-footer">
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Solo tu (betsushi) puoi accedere a questa applicazione.
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            v{appVersion}
          </p>
        </div>
      </div>
    </div>
  )
}
