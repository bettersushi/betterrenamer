import { useEffect, useRef } from 'react'

const IEye = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
const ISimilar = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
const IGlobe = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
const IPencil = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const ICopy = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
const IDownload = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
const IFolder = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
const ITrash = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>

export default function PhotoContextMenu({ photo, idx, x, y, onClose, actions }) {
  const menuRef = useRef(null)

  useEffect(() => {
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const menuW = 210
  const menuH = 330
  const adjustedX = x + menuW > window.innerWidth ? x - menuW : x
  const adjustedY = y + menuH > window.innerHeight ? y - menuH : y

  const item = (Icon, label, onClick, danger = false) => (
    <button
      key={label}
      onClick={() => { onClose(); onClick() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%',
        padding: '7px 12px', background: 'none', border: 'none',
        cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
        color: danger ? '#ef4444' : 'var(--text-primary)',
        borderRadius: 6, transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.08)' : 'color-mix(in srgb, var(--border) 60%, transparent)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: danger ? 1 : 0.65 }}><Icon /></span>
      {label}
    </button>
  )

  const sep = <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', left: adjustedX, top: adjustedY, zIndex: 3000,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '5px', minWidth: menuW,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        animation: 'contextMenuIn 0.1s ease',
      }}
    >
      {item(IEye, 'QuickLook', () => actions.onQuickLook(idx))}
      {item(ISimilar, 'Cerca simili in cartella', () => actions.onSimilarity(photo))}
      {item(IGlobe, 'Cerca simili per scope', () => actions.onScopeSearch(photo))}
      {sep}
      {item(IPencil, 'Rinomina', () => actions.onRename(photo))}
      {item(ICopy, 'Duplica', () => actions.onDuplicate(photo))}
      {item(IDownload, 'Download', () => actions.onDownload(photo))}
      {item(IFolder, 'Sposta in...', () => actions.onMove(photo))}
      {sep}
      {item(ITrash, 'Elimina', () => actions.onDelete(photo), true)}
    </div>
  )
}
