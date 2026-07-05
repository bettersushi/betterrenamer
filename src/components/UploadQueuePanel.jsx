import './UploadQueuePanel.css'

const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconXSmall = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

export default function UploadQueuePanel({ queue, onRetry, onDismiss }) {
  if (!queue || queue.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 3999,
      width: 340, maxWidth: 'calc(100vw - 40px)', maxHeight: '60vh',
      display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto',
    }}>
      {queue.map(item => {
        const pct = Math.round((item.progress || 0) * 100)
        return (
          <div key={item.id} className="upload-job">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, overflow: 'hidden' }}>
                {item.status === 'uploading' && <span style={{ display: 'flex', color: '#3b82f6' }}><IconRefresh /></span>}
                {item.status === 'done' && <span style={{ display: 'flex' }}><IconCheck /></span>}
                {item.status === 'error' && <span style={{ display: 'flex' }}><IconX /></span>}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }} title={item.name}>{item.name}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {item.status === 'uploading' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}%</span>}
                {item.status === 'error' && (
                  <button onClick={() => onRetry(item.id)} className="btn-primary" style={{ fontSize: 11, padding: '3px 8px' }}>Riprova</button>
                )}
                <button onClick={() => onDismiss(item.id)} className="btn-secondary" style={{ fontSize: 11, padding: '3px 6px' }} title="Rimuovi">
                  <IconXSmall />
                </button>
              </span>
            </div>
            {item.status === 'uploading' && (
              <div className="queue-progress-bg">
                <div style={{ background: '#3b82f6', height: '100%', width: `${pct}%`, transition: 'width 0.2s ease' }} />
              </div>
            )}
            {item.status === 'error' && (
              <div style={{ fontSize: 11, color: '#dc2626' }}>{item.error}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
