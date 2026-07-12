import { useLocation } from 'react-router-dom'
import logoSearch from '../assets/logo-bs.svg'

const titleStyle = { fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }

// Search è la hp dell'app: Dashboard/Better Renamer non è più una route a sé,
// vive dentro BetterRenamerModal aperta da Search. Il brand qui è quindi fisso.
export default function AppHeaderBrand() {
  const location = useLocation()
  if (location.pathname !== '/search') return null

  return (
    <div style={{ position: 'fixed', top: 12, left: 24, zIndex: 20, display: 'flex', alignItems: 'center' }}>
      <h1 style={titleStyle}>
        <img src={logoSearch} alt="" style={{ height: '24px', width: 'auto' }} />
        BetterSearch
      </h1>
    </div>
  )
}
