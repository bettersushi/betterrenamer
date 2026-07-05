import { useState, useEffect, useCallback, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import LoginPage from './pages/LoginPage'
import CallbackPage from './pages/CallbackPage'
import DashboardPage from './pages/DashboardPage'
import LogsPage from './pages/LogsPage'
import SearchPage from './pages/SearchPage'
import { VideoMontageProvider, useVideoMontage } from './context/VideoMontageContext'
import VideoMontageBalloon from './components/VideoMontageBalloon'
import { RenameQueueProvider } from './context/RenameQueueContext'
import RenameQueuePanel from './components/RenameQueuePanel'
import { SimilarityProvider } from './context/SimilarityContext'
import SimilarityBalloonStack from './components/SimilarityBalloonStack'
import AppHeaderBrand from './components/AppHeaderBrand'
import { refreshAccessToken } from './auth'
import './App.css'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('App crash:', error, info) }
  render() {
    if (this.state.error) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px', fontFamily: 'Sora, sans-serif' }}>
        <div style={{ fontSize: '15px', color: '#666' }}>Qualcosa è andato storto.</div>
        <button onClick={() => { this.setState({ error: null }); window.location.reload() }} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer', fontSize: '14px' }}>Ricarica</button>
      </div>
    )
    return this.props.children
  }
}

function VideoMontageWizardGuard() {
  const location = useLocation()
  const { wizardOpen, closeWizard } = useVideoMontage()
  useEffect(() => {
    if (location.pathname !== '/search' && wizardOpen) closeWizard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
  return null
}

function PageFade({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{ height: '100%' }}
    >
      {children}
    </motion.div>
  )
}

function AnimatedRoutes({ auth, handleLogin, handleLogout, isDark, setIsDark, colorScheme, handleScheme, handleTokenRefresh }) {
  const location = useLocation()
  return (
    <AnimatePresence mode="sync">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PageFade><LoginPage onLogin={handleLogin} /></PageFade>} />
        <Route path="/callback" element={<PageFade><CallbackPage onLogin={handleLogin} /></PageFade>} />
        <Route path="/" element={auth ? <PageFade><DashboardPage auth={auth} onLogout={handleLogout} isDark={isDark} onToggleTheme={() => setIsDark(d => !d)} colorScheme={colorScheme} onChangeScheme={handleScheme} onTokenRefresh={handleTokenRefresh} /></PageFade> : <Navigate to="/login" />} />
        <Route path="/logs" element={auth ? <PageFade><LogsPage onLogout={handleLogout} /></PageFade> : <Navigate to="/login" />} />
        <Route path="/search" element={auth ? <PageFade><SearchPage auth={auth} onLogout={handleLogout} isDark={isDark} onToggleTheme={() => setIsDark(d => !d)} colorScheme={colorScheme} onChangeScheme={handleScheme} onTokenRefresh={handleTokenRefresh} /></PageFade> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AnimatePresence>
  )
}

const PALETTES = {
  blue: {
    dark:  { '--primary':'#7c6fcd','--primary-dark':'#5c50a8','--bg':'#0f0f14','--surface':'#17161f','--surface-2':'#1f1e2a','--border':'#2a2835','--input-bg':'#1c1b27','--btn-hover':'#242233','--body-bg':'linear-gradient(135deg,#0f0f14 0%,#13121c 60%,#0f0f14 100%)' },
    light: { '--primary':'#378add','--primary-dark':'#185fa5','--bg':'#f5f5f5','--surface':'#ffffff','--surface-2':'#f0f0f8','--border':'#d3d1c7','--input-bg':'#ffffff','--btn-hover':'#f0f0f0','--body-bg':'#f5f5f5' },
  },
  red: {
    dark:  { '--primary':'#b85c8a','--primary-dark':'#8f3a68','--bg':'#130f12','--surface':'#1e1419','--surface-2':'#261820','--border':'#352030','--input-bg':'#221620','--btn-hover':'#2a1a22','--body-bg':'linear-gradient(135deg,#130f12 0%,#1a1018 60%,#130f12 100%)' },
    light: { '--primary':'#b85c8a','--primary-dark':'#8f3a68','--bg':'#f8f2f5','--surface':'#fdfafe','--surface-2':'#f5eef2','--border':'#e2ccd8','--input-bg':'#fdf8fb','--btn-hover':'#f3eaf0','--body-bg':'#f8f2f5' },
  },
  green: {
    dark:  { '--primary':'#4a9e6e','--primary-dark':'#2f7a50','--bg':'#0c1210','--surface':'#131a16','--surface-2':'#182319','--border':'#1e2f24','--input-bg':'#161f18','--btn-hover':'#182420','--body-bg':'linear-gradient(135deg,#0c1210 0%,#111a14 60%,#0c1210 100%)' },
    light: { '--primary':'#2e8b57','--primary-dark':'#1a6640','--bg':'#f2f7f4','--surface':'#fafdfb','--surface-2':'#eef7f2','--border':'#c8ddd1','--input-bg':'#f6fcf8','--btn-hover':'#eaf4ee','--body-bg':'#f2f7f4' },
  },
}

function applyPalette(scheme, dark) {
  const vars = PALETTES[scheme]?.[dark ? 'dark' : 'light'] || {}
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => {
    if (k === '--body-bg') document.body.style.background = v
    else root.style.setProperty(k, v)
  })
}

function App() {
  const [auth, setAuth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(() => localStorage.getItem('br_theme') === 'dark')
  const [colorScheme, setColorScheme] = useState(() => localStorage.getItem('br_scheme') || 'blue')

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    localStorage.setItem('br_theme', isDark ? 'dark' : 'light')
    applyPalette(colorScheme, isDark)
  }, [isDark, colorScheme])

  const handleScheme = (s) => {
    setColorScheme(s)
    localStorage.setItem('br_scheme', s)
  }

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
    <ErrorBoundary>
    <BrowserRouter>
      <VideoMontageProvider auth={auth} onTokenRefresh={handleTokenRefresh}>
      <RenameQueueProvider auth={auth}>
      <SimilarityProvider auth={auth}>
        <VideoMontageWizardGuard />
        <AppHeaderBrand />
        <AnimatedRoutes
          auth={auth}
          handleLogin={handleLogin}
          handleLogout={handleLogout}
          isDark={isDark}
          setIsDark={setIsDark}
          colorScheme={colorScheme}
          handleScheme={handleScheme}
          handleTokenRefresh={handleTokenRefresh}
        />
        <VideoMontageBalloon />
        <RenameQueuePanel />
        <SimilarityBalloonStack />
      </SimilarityProvider>
      </RenameQueueProvider>
      </VideoMontageProvider>
    </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
