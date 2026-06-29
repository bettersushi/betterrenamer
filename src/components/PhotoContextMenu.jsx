import { useEffect, useRef } from 'react'

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

  // Smart positioning: avoid going off-screen
  const menuW = 200
  const menuH = 320
  const adjustedX = x + menuW > window.innerWidth ? x - menuW : x
  const adjustedY = y + menuH > window.innerHeight ? y - menuH : y

  const item = (icon, label, onClick, danger = false) => (
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
      <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
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
      {item('👁', 'QuickLook', () => actions.onQuickLook(idx))}
      {item('◎', 'Cerca simili in cartella', () => actions.onSimilarity(photo))}
      {item('🌐', 'Cerca simili per scope', () => actions.onScopeSearch(photo))}
      {sep}
      {item('✏️', 'Rinomina', () => actions.onRename(photo))}
      {item('⧉', 'Duplica', () => actions.onDuplicate(photo))}
      {item('⬇', 'Download', () => actions.onDownload(photo))}
      {item('📂', 'Sposta in...', () => actions.onMove(photo))}
      {sep}
      {item('🗑', 'Elimina', () => actions.onDelete(photo), true)}
    </div>
  )
}
