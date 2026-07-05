import { useRef, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import logoRenamer from '../assets/logo-br.svg'
import logoSearch from '../assets/logo-bs.svg'

// Duotone icon: shown while on Dashboard, toggles to Search (magnifier over a photo)
function IconToSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="2.5" y="4" width="14" height="14" rx="3" fill="var(--primary)" opacity="0.35"/>
      <circle cx="15.5" cy="15.5" r="6" fill="none" stroke="var(--primary)" strokeWidth="2"/>
      <line x1="19.8" y1="19.8" x2="22.5" y2="22.5" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// Duotone icon: shown while on Search, toggles back to Dashboard (folder/tag)
function IconToDashboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="var(--primary)" opacity="0.35"/>
      <path d="M8 12h8M8 16h5" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

const BRANDS = {
  dashboard: { logo: logoRenamer, title: 'BetterRenamer', subtitle: 'Batch rename per Google Drive' },
  search: { logo: logoSearch, title: 'BetterSearch', subtitle: 'Ricerca foto su Google Drive' },
}

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
    <div style={{ position: 'fixed', top: 12, left: 24, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', overflow: 'hidden', height: 40, width: 230, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
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
            <h1 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={brand.logo} alt="" style={{ height: '24px', width: 'auto' }} />
              {brand.title}
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{brand.subtitle}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <button
        onClick={() => navigate(isSearch ? '/' : '/search')}
        className="btn-secondary"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0 }}
        title={isSearch ? 'Torna a BetterRenamer' : 'Ricerca foto'}
      >
        {isSearch ? <IconToDashboard /> : <IconToSearch />}
      </button>
    </div>
  )
}
