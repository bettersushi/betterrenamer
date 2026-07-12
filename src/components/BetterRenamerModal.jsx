import DashboardPage from '../pages/DashboardPage'

// Mega-modale che ospita l'intera UI di DashboardPage (rename batch a pattern,
// coda, spostamento media) come "sotto-app" di Search, invece che come pagina
// a sé stante. initialFolder, se presente, fa navigare la Dashboard dentro quella
// cartella e avvia subito la preview (selezione fatta da Search prima di aprire).
export default function BetterRenamerModal({ auth, onLogout, isDark, onToggleTheme, colorScheme, onChangeScheme, onTokenRefresh, initialFolder = null, onClose }) {
  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={frame}>
        <DashboardPage
          auth={auth}
          onLogout={onLogout}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
          colorScheme={colorScheme}
          onChangeScheme={onChangeScheme}
          onTokenRefresh={onTokenRefresh}
          embedded
          initialFolder={initialFolder}
          onClose={onClose}
        />
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0, zIndex: 5000,
  background: 'rgba(0,0,0,0.86)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const frame = {
  width: '99vw', height: '99vh',
  background: 'var(--bg, #0b0b0c)',
  borderRadius: 12, overflow: 'hidden',
  boxShadow: '0 30px 90px rgba(0,0,0,0.5)',
  display: 'flex', flexDirection: 'column',
}
