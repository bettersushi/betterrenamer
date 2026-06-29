import { useRef, useState, useEffect } from 'react'

export default function SimilarityBalloon({ state, index = 0, onViewResults, onCancel, onClose }) {
  const [pos, setPos] = useState(null) // null = usa bottom-right default
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const balloonRef = useRef(null)

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      setPos({ x: clientX - dragOffset.current.x, y: clientY - dragOffset.current.y })
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  const onDragStart = (e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    const rect = balloonRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top }
    dragging.current = true
    if (!pos) setPos({ x: rect.left, y: rect.top })
  }

  const defaultBottom = 24 + index * 188
  const style = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
    : { position: 'fixed', bottom: defaultBottom, right: 24 }

  const pct = state.total > 0 ? Math.round((state.progress / state.total) * 100) : 0

  return (
    <div
      ref={balloonRef}
      className="sim-balloon"
      style={{ ...style, cursor: dragging.current ? 'grabbing' : 'grab' }}
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
    >
      {/* Header con thumb foto di riferimento */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {state.refPhoto?.thumbnailLink && (
          <img src={state.refPhoto.thumbnailLink} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {state.status === 'listing' && 'Raccolta file in Drive...'}
          {state.status === 'scanning' && (state.type === 'folder' ? 'Similarità in cartella...' : 'Calcolo similarità...')}
          {state.status === 'done' && `${state.results.length} simili trovate`}
          {state.status === 'error' && 'Errore ricerca'}
        </span>
        {(state.status === 'done' || state.status === 'error') && (
          <button onClick={onClose} style={btnStyle} title="Chiudi">✕</button>
        )}
      </div>

      {/* Listing */}
      {state.status === 'listing' && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Scansione cartelle Drive in corso...
          </div>
          <button onClick={onCancel} style={{ ...btnStyle, fontSize: 11, padding: '3px 10px', width: '100%', background: 'color-mix(in srgb, var(--border) 60%, transparent)', borderRadius: 6 }}>
            Annulla
          </button>
        </>
      )}

      {/* Scanning */}
      {state.status === 'scanning' && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            {state.progress} / {state.total} foto analizzate
            {state.cached > 0 && <span style={{ marginLeft: 6, color: 'var(--primary)', opacity: 0.7 }}>{state.cached} dalla cache</span>}
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 2, transition: 'width 0.2s' }} />
          </div>
          <button onClick={onCancel} style={{ ...btnStyle, fontSize: 11, padding: '3px 10px', width: '100%', background: 'color-mix(in srgb, var(--border) 60%, transparent)', borderRadius: 6 }}>
            Annulla
          </button>
        </>
      )}

      {/* Done */}
      {state.status === 'done' && (
        <button onClick={onViewResults} style={{ ...btnStyle, fontSize: 12, padding: '5px 14px', width: '100%', background: 'var(--primary)', color: 'white', borderRadius: 6, fontWeight: 600 }}>
          Vedi risultati
        </button>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <div style={{ fontSize: 11, color: '#ef4444' }}>{state.message}</div>
      )}
    </div>
  )
}

const btnStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  padding: '2px 4px',
  lineHeight: 1,
  fontSize: 13,
}
