import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import CallbackPage from './pages/CallbackPage'
import DashboardPage from './pages/DashboardPage'
import LogsPage from './pages/LogsPage'
import { refreshAccessToken } from './auth'
import './App.css'

function App() {
  const [auth, setAuth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(() => localStorage.getItem('br_theme') === 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    localStorage.setItem('br_theme', isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
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

  const handleTokenRefresh = useCallback(async () => {
    if (!auth?.refreshToken) { handleLogout(); return null }
    try {
      const data = await refreshAccessToken(auth.refreshToken)
      const updated = { ...auth, accessToken: data.access_token }
      setAuth(updated)
      localStorage.setItem('betterrenamer_auth', JSON.stringify(updated))
      return data.access_token
    } catch {
      handleLogout()
      return null
    }
  }, [auth])

  if (loading) {
    return <div className="loading">Caricamento...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="/callback" element={<CallbackPage onLogin={handleLogin} />} />
        <Route path="/" element={auth ? <DashboardPage auth={auth} onLogout={handleLogout} isDark={isDark} onToggleTheme={() => setIsDark(d => !d)} onTokenRefresh={handleTokenRefresh} /> : <Navigate to="/login" />} />
        <Route path="/logs" element={auth ? <LogsPage onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
