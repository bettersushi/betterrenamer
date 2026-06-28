import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import CallbackPage from './pages/CallbackPage'
import TwoFAPage from './pages/TwoFAPage'
import DashboardPage from './pages/DashboardPage'
import './App.css'

function App() {
  const [auth, setAuth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Controlla se l'utente è già autenticato
    const storedAuth = localStorage.getItem('betterrenamer_auth')
    if (storedAuth) {
      try {
        setAuth(JSON.parse(storedAuth))
      } catch (e) {
        localStorage.removeItem('betterrenamer_auth')
      }
    }
    setLoading(false)
  }, [])

  const handleLogin = (authData) => {
    setAuth(authData)
    localStorage.setItem('betterrenamer_auth', JSON.stringify(authData))
  }

  const handleLogout = () => {
    setAuth(null)
    localStorage.removeItem('betterrenamer_auth')
  }

  if (loading) {
    return <div className="loading">Caricamento...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="/callback" element={<CallbackPage onLogin={handleLogin} />} />
        <Route path="/2fa" element={auth ? <TwoFAPage auth={auth} onLogin={handleLogin} /> : <Navigate to="/login" />} />
        <Route path="/" element={auth ? <DashboardPage auth={auth} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
