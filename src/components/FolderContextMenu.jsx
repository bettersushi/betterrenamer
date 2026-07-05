import { useEffect, useRef, useState } from 'react'
import { FOLDER_COLORS } from '../driveFolderColors'

const IOpen = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
const INewFolder = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
const IPencil = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IMove = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
const ITrash = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
const IColor = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 22c-4.4 0-8-2.5-8-7 0-3.6 2.3-6.5 5-8.5"/><path d="M14.5 21.5c1.5-1 3.5-3 3.5-6 0-1-.5-2-1-2.5"/></svg>
const IBack = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>

export default function FolderContextMenu({ folder, x, y, onClose, actions }) {
  const menuRef = useRef(null)
  const [showColors, setShowColors] = useState(false)

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

  const menuW = 200
  const menuH = 220
  const adjustedX = Math.min(x, window.innerWidth - menuW)
  const adjustedY = Math.min(y, window.innerHeight - menuH)

  const item = (Icon, label, onClick, danger = false) => (
    <button
      key={label}
      onClick={() => { onClose(); onClick() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%',
        padding: '7px 12px', background: 'none', border: 'none',
        cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
        color: danger ? '#ef4444' : 'var(--text-primary)',
        borderRadius: 7, transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.08)' : 'var(--btn-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{ width: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: danger ? 1 : 0.65 }}><Icon /></span>
      {label}
    </button>
  )

  const sep = <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1500 }}
      onClick={onClose}
      onContextMenu={e => { e.preventDefault(); onClose() }}
    >
      <div
        ref={menuRef}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', left: adjustedX, top: adjustedY, zIndex: 1501,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
          padding: '5px', minWidth: 190,
        }}
      >
        {showColors ? (
          <>
            <button
              onClick={() => setShowColors(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '7px 12px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
                color: 'var(--text-primary)', borderRadius: 7, transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--btn-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ width: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.65 }}><IBack /></span>
              Indietro
            </button>
            {sep}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, padding: '8px 10px' }}>
              {FOLDER_COLORS.map(hex => (
                <button
                  key={hex}
                  onClick={() => { onClose(); actions.onColor(folder, hex) }}
                  title={hex}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', background: hex,
                    border: '1px solid rgba(0,0,0,0.15)', cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            {item(IOpen, 'Apri cartella', () => actions.onOpen(folder))}
            {item(INewFolder, 'Nuova sottocartella', () => actions.onNewSubfolder(folder))}
            {sep}
            {item(IPencil, 'Rinomina', () => actions.onRename(folder))}
            {item(IMove, 'Sposta in…', () => actions.onMove(folder))}
            <button
              onClick={() => setShowColors(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '7px 12px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
                color: 'var(--text-primary)', borderRadius: 7, transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--btn-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ width: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.65 }}><IColor /></span>
              Colore cartella
            </button>
            {sep}
            {item(ITrash, 'Elimina cartella', () => actions.onDelete(folder), true)}
          </>
        )}
      </div>
    </div>
  )
}
