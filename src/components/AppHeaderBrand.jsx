import { useRef, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import logoRenamer from '../assets/logo-br.svg'
import logoSearch from '../assets/logo-bs.svg'

// Flat outline icon: shown while on Dashboard, toggles to Search (magnifying glass)
function IconToSearch() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/>
      <line x1="21" y1="21" x2="16.2" y2="16.2"/>
    </svg>
  )
}

// Flat outline icon: shown while on Search, toggles back to Dashboard (folder)
function IconToDashboard() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
    </svg>
  )
}

const BRANDS = {
  dashboard: { logo: logoRenamer, title: 'BetterRenamer' },
  search: { logo: logoSearch, title: 'BetterSearch' },
}

const titleStyle = { fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }

export default function AppHeaderBrand() {
  const location = useLocation()
  const navigate = useNavigate()
  const isSearch = location.pathname === '/search'
  const key = isSearch ? 'search' : 'dashboard'
  const prevKeyRef = useRef(key)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    if (prevKeyRef.current !== key) {
      setDirection(key === 'search' ? 1 : -1)
      prevKeyRef.current = key
    }
  }, [key])

  if (!['/', '/search'].includes(location.pathname)) return null

  const brand = BRANDS[key]

  return (
    <div style={{ position: 'fixed', top: 12, left: 24, zIndex: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        {/* Ghost sizer: in-flow, invisible, sets the container's intrinsic width/height to match the current brand's content exactly */}
        <h1 style={{ ...titleStyle, visibility: 'hidden' }} aria-hidden="true">
          <img src={brand.logo} alt="" style={{ height: '24px', width: 'auto' }} />
          {brand.title}
        </h1>
        <AnimatePresence mode="sync" custom={direction} initial={false}>
          <motion.div
            key={key}
            custom={direction}
            initial={{ y: direction > 0 ? 40 : -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: direction > 0 ? -40 : 40, opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: 'absolute', left: 0, top: 0 }}
          >
            <h1 style={titleStyle}>
              <img src={brand.logo} alt="" style={{ height: '24px', width: 'auto' }} />
              {brand.title}
            </h1>
          </motion.div>
        </AnimatePresence>
      </div>
      <button
        onClick={() => navigate(isSearch ? '/' : '/search')}
        className="btn-secondary"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0, flexShrink: 0 }}
        title={isSearch ? 'Torna a BetterRenamer' : 'Ricerca foto'}
      >
        {isSearch ? <IconToDashboard /> : <IconToSearch />}
      </button>
    </div>
  )
}
