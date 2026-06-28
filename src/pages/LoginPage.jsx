import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateAuthUrl } from '../auth'
import './LoginPage.css'

export default function LoginPage({ onLogin }) {
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
      <div className="login-card">
        <div className="login-header">
          <h1>🔄 BetterRenamer</h1>
          <p>Batch rename per Google Drive</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="login-content">
          <p className="description">
            Rinomina in batch i file del tuo Google Drive con pattern personalizzati.
          </p>

          <button onClick={handleGoogleLogin} className="btn-google">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
            Accedi con Google
          </button>

          <div className="login-features">
            <h3>Funzionalità</h3>
            <ul>
              <li>✓ Rinominazioni in batch con pattern personalizzati</li>
              <li>✓ Protezione con autenticazione Google</li>
              <li>✓ Verifica in due passaggi (2FA)</li>
              <li>✓ Preview prima di applicare i cambiamenti</li>
              <li>✓ Log dettagliato di tutte le operazioni</li>
            </ul>
          </div>
        </div>

        <div className="login-footer">
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Solo tu (betsushi) puoi accedere a questa applicazione.
          </p>
        </div>
      </div>
    </div>
  )
}
