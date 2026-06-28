import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { verifyTwoFA } from '../auth'
import './TwoFAPage.css'

export default function TwoFAPage({ auth, onLogin }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('setup') // setup o verify
  const [secret, setSecret] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Genera il secret 2FA al caricamento
    const generateSecret = async () => {
      try {
        const response = await fetch('/.netlify/functions/generate-2fa')
        const data = await response.json()
        setSecret(data.secret)
        setQrCode(data.qrCode)
      } catch (err) {
        setError('Errore nella generazione del 2FA: ' + err.message)
      }
    }

    generateSecret()
  }, [])

  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await verifyTwoFA(secret, code)

      if (result.valid) {
        // Salva il secret 2FA e vai al dashboard
        onLogin({
          ...auth,
          twoFASecret: secret,
          twoFAEnabled: true,
        })
        navigate('/')
      } else {
        setError('Codice non valido. Riprova.')
      }
    } catch (err) {
      setError('Errore nella verifica: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!secret) {
    return (
      <div className="twofa-container">
        <div className="twofa-card">
          <div className="spinner"></div>
          <p>Generazione del 2FA...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="twofa-container">
      <div className="twofa-card">
        <div className="twofa-header">
          <h1>🔐 Configura l'autenticazione a due fattori</h1>
          <p>Aumenta la sicurezza del tuo account</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="twofa-content">
          <div className="setup-step">
            <h3>Passo 1: Scansiona il QR code</h3>
            <p>Usa un'app come Google Authenticator, Microsoft Authenticator o Authy</p>
            {qrCode && (
              <div className="qr-container">
                <img src={qrCode} alt="QR Code 2FA" />
              </div>
            )}
          </div>

          <div className="setup-step">
            <h3>Passo 2: Verifica il codice</h3>
            <p>Inserisci il codice a 6 cifre dall'app</p>
            <form onSubmit={handleVerify}>
              <div className="form-group">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.slice(0, 6))}
                  maxLength="6"
                  pattern="[0-9]{6}"
                  required
                  autoComplete="off"
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loading || code.length !== 6}>
                {loading ? 'Verifica in corso...' : 'Verifica e accedi'}
              </button>
            </form>
          </div>

          <div className="setup-info">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              💡 Salva il codice segreto in un posto sicuro come backup.
            </p>
            <div className="secret-backup">
              <strong>Codice segreto:</strong>
              <code>{secret}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
