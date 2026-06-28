import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeCodeForToken } from '../auth'
import './CallbackPage.css'

export default function CallbackPage({ onLogin }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code')
        const state = searchParams.get('state')

        if (!code) {
          throw new Error('Codice di autorizzazione non trovato')
        }

        // Scambia il codice con il token
        const tokenData = await exchangeCodeForToken(code)

        onLogin({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          email: tokenData.email,
        })

        navigate('/')
      } catch (err) {
        setError('Errore durante l\'autenticazione: ' + err.message)
        setLoading(false)
      }
    }

    handleCallback()
  }, [searchParams, navigate, onLogin])

  if (loading) {
    return (
      <div className="callback-container">
        <div className="callback-card">
          <div className="spinner"></div>
          <p>Completamento dell'autenticazione...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="callback-container">
        <div className="callback-card">
          <h2>Errore di autenticazione</h2>
          <p className="error-text">{error}</p>
          <button onClick={() => navigate('/login')} className="btn-primary">
            Torna alla login
          </button>
        </div>
      </div>
    )
  }

  return null
}
