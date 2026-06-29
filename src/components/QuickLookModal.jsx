import { useEffect } from 'react'

export default function QuickLookModal({ files, onClose, onPrev, onNext, currentIndex, total }) {
  const hasNav = onPrev && onNext && total > 1

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); onClose() }
      if (hasNav && e.key === 'ArrowLeft') { e.preventDefault(); onPrev() }
      if (hasNav && e.key === 'ArrowRight') { e.preventDefault(); onNext() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, onPrev, onNext, hasNav])

  if (!files || files.length === 0) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: 'rgba(0,0,0,0.6)', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {hasNav && (
            <button onClick={onPrev} style={{ background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer', opacity: currentIndex === 0 ? 0.3 : 0.8, padding: '0 4px' }}>←</button>
          )}
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>
            {files[0]?.name}
            {hasNav && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>{currentIndex + 1} / {total}</span>}
          </span>
          {hasNav && (
            <button onClick={onNext} style={{ background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer', opacity: currentIndex === total - 1 ? 0.3 : 0.8, padding: '0 4px' }}>→</button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>ESC per chiudere{hasNav ? ' · ← → naviga' : ''}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>✕</button>
        </div>
      </div>

      {/* Content */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {files.length === 1 ? (
          <iframe
            src={`https://drive.google.com/file/d/${files[0].id}/preview`}
            style={{ width: '100%', maxWidth: '900px', height: 'calc(100vh - 100px)', border: 'none', borderRadius: '8px', background: '#111' }}
            allow="autoplay"
            title={files[0].name}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', width: '100%' }}>
            {files.map(file => (
              <div key={file.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <iframe
                  src={`https://drive.google.com/file/d/${file.id}/preview`}
                  style={{ width: '100%', height: '340px', border: 'none', borderRadius: '8px', background: '#111' }}
                  allow="autoplay"
                  title={file.name}
                />
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', textAlign: 'center', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Side nav arrows (large, clickable on sides) */}
      {hasNav && (
        <>
          <button
            onClick={e => { e.stopPropagation(); onPrev() }}
            style={{ position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', border: 'none', color: 'white', fontSize: '28px', padding: '20px 14px', cursor: 'pointer', opacity: currentIndex === 0 ? 0.2 : 0.7, borderRadius: '0 8px 8px 0', transition: 'opacity 0.15s' }}
          >‹</button>
          <button
            onClick={e => { e.stopPropagation(); onNext() }}
            style={{ position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', border: 'none', color: 'white', fontSize: '28px', padding: '20px 14px', cursor: 'pointer', opacity: currentIndex === total - 1 ? 0.2 : 0.7, borderRadius: '8px 0 0 8px', transition: 'opacity 0.15s' }}
          >›</button>
        </>
      )}
    </div>
  )
}
