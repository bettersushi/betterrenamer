import { useEffect } from 'react'

const BtnIcon = ({ onClick, title, children }) => (
  <button
    onClick={e => { e.stopPropagation(); onClick() }}
    title={title}
    style={{
      width: 40, height: 40, borderRadius: 10,
      background: 'rgba(20,20,20,0.72)', backdropFilter: 'blur(6px)',
      border: '1px solid rgba(255,255,255,0.12)',
      color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.12s, color 0.12s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(60,60,60,0.92)'; e.currentTarget.style.color = '#fff' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(20,20,20,0.72)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' }}
  >
    {children}
  </button>
)

const ICrop = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>
  </svg>
)
const IEdit = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
  </svg>
)
const IDownload = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const ITrash = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const ICopy = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

export default function QuickLookModal({ files, onClose, onPrev, onNext, currentIndex, total, onCrop, onRename, onDownload, onDelete, onDuplicate }) {
  const hasNav = onPrev && onNext && total > 1
  const hasActions = onCrop || onRename || onDownload || onDelete || onDuplicate

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
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
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
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
        style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {files.length === 1 ? (
          <div style={{ position: 'relative', width: '100%', maxWidth: '900px' }}>
            <iframe
              src={`https://drive.google.com/file/d/${files[0].id}/preview`}
              style={{ width: '100%', height: 'calc(100vh - 100px)', border: 'none', borderRadius: '8px', background: '#111', display: 'block' }}
              allow="autoplay"
              title={files[0].name}
            />
            {hasActions && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', top: 12, right: 12,
                  display: 'flex', flexDirection: 'column', gap: 8,
                  zIndex: 10,
                }}
              >
                {onCrop && <BtnIcon onClick={onCrop} title="Ritaglia"><ICrop /></BtnIcon>}
                {onRename && <BtnIcon onClick={onRename} title="Rinomina"><IEdit /></BtnIcon>}
                {onDownload && <BtnIcon onClick={onDownload} title="Scarica"><IDownload /></BtnIcon>}
                {onDuplicate && <BtnIcon onClick={onDuplicate} title="Duplica"><ICopy /></BtnIcon>}
                {onDelete && <BtnIcon onClick={onDelete} title="Elimina"><ITrash /></BtnIcon>}
              </div>
            )}
          </div>
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

      {/* Side nav arrows */}
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
