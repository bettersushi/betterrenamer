import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateAuthUrl } from '../auth'
import logoRenamer from '../assets/logo-br.svg'
import logoSearch from '../assets/logo-bs.svg'
import { version as appVersion } from '../../package.json'
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
      <div className="login-logos">
        <img src={logoRenamer} alt="" className="login-logo" />
        <img src={logoSearch} alt="" className="login-logo" />
      </div>

      {error && <div className="error-message">{error}</div>}

      <button onClick={handleGoogleLogin} className="btn-google">
        Accedi con Google
      </button>

      <p className="login-version">v{appVersion}</p>
    </div>
  )
}
