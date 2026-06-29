import { useRef, useState, useEffect, useCallback } from 'react'
import { updateFileContent } from '../drive'

function getLargeThumbUrl(thumbnailLink, size = 1600) {
  if (!thumbnailLink) return null
  return thumbnailLink.replace(/=s\d+$/, `=s${size}`).replace(/=s\d+-/, `=s${size}-`)
}

const RATIOS = [
  { label: '9:16', w: 9, h: 16 },
  { label: '1:2',  w: 1, h: 2  },
  { label: '2:3',  w: 2, h: 3  },
  { label: '3:4',  w: 3, h: 4  },
  { label: '4:5',  w: 4, h: 5  },
  { label: '1:1',  w: 1, h: 1  },
  { label: '16:9', w: 16, h: 9 },
  { label: '2:1',  w: 2, h: 1  },
  { label: '3:2',  w: 3, h: 2  },
  { label: '4:3',  w: 4, h: 3  },
  { label: '5:4',  w: 5, h: 4  },
]

// Visual handle sizes in CSS pixels (not canvas pixels)
const HANDLE_CSS = 18   // corner square size
const HANDLE_HIT = 28   // corner hit zone
const MOVE_R_CSS = 32   // center circle radius

function RatioIcon({ w, h }) {
  const maxW = 16, maxH = 16
  const scale = Math.min(maxW / w, maxH / h)
  const rw = Math.round(w * scale), rh = Math.round(h * scale)
  const cx = 10, cy = 10
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x={cx - rw/2} y={cy - rh/2} width={rw} height={rh} stroke="currentColor" strokeWidth="1.5" rx="1"/>
    </svg>
  )
}

export default function CropModal({ photo, accessToken, onClose, onDone }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const imgRef = useRef(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [rect, setRect] = useState(null)      // in canvas pixels
  const [cssRect, setCssRect] = useState(null) // in CSS pixels (for overlay)
  const [activeRatio, setActiveRatio] = useState(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')
  const dragState = useRef(null)
  const canvasDims = useRef({ w: 0, h: 0 })
  const activeRatioRef = useRef(null)
  const rectRef = useRef(null)

  useEffect(() => { activeRatioRef.current = activeRatio }, [activeRatio])
  useEffect(() => { rectRef.current = rect }, [rect])

  // Load image
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; setImgLoaded(true) }
    img.onerror = () => setImgError(true)
    img.src = `/api/proxy-image?url=${encodeURIComponent(getLargeThumbUrl(photo.thumbnailLink, 1600))}`
  }, [photo.thumbnailLink])

  // Init canvas size when image loads
  useEffect(() => {
    if (!imgLoaded || !canvasRef.current) return
    const canvas = canvasRef.current
    const img = imgRef.current
    const maxW = Math.min(window.innerWidth * 0.82, 1100)
    const maxH = Math.min(window.innerHeight * 0.68, 760)
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
    const cw = Math.round(img.naturalWidth * scale)
    const ch = Math.round(img.naturalHeight * scale)
    canvas.width = cw
    canvas.height = ch
    canvasDims.current = { w: cw, h: ch }
    const margin = 20
    const initialRect = { x: margin, y: margin, w: cw - margin * 2, h: ch - margin * 2 }
    setRect(initialRect)
  }, [imgLoaded])

  // Compute cssRect whenever rect changes (for overlay positioning)
  const syncCssRect = useCallback(() => {
    if (!canvasRef.current || !rectRef.current) return
    const r = rectRef.current
    const b = canvasRef.current.getBoundingClientRect()
    const wrapB = wrapRef.current.getBoundingClientRect()
    const pr = canvasDims.current.w / b.width
    setCssRect({
      left:   b.left - wrapB.left + r.x / pr,
      top:    b.top  - wrapB.top  + r.y / pr,
      width:  r.w / pr,
      height: r.h / pr,
    })
  }, [])

  // Draw canvas whenever rect/activeRatio changes
  useEffect(() => {
    if (!imgLoaded || !rect || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = imgRef.current
    const { w: cw, h: ch } = canvasDims.current
    const { x, y, w, h } = rect

    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, 0, 0, cw, ch)

    // Darken outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.52)'
    ctx.fillRect(0, 0, cw, y)
    ctx.fillRect(0, y + h, cw, ch - y - h)
    ctx.fillRect(0, y, x, h)
    ctx.fillRect(x + w, y, cw - x - w, h)

    // Rule-of-thirds grid
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 1
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(x + w * i / 3, y); ctx.lineTo(x + w * i / 3, y + h); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x, y + h * i / 3); ctx.lineTo(x + w, y + h * i / 3); ctx.stroke()
    }

    // Border
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)

    syncCssRect()
  }, [imgLoaded, rect, activeRatio, syncCssRect])

  const clampRect = useCallback((r) => {
    const { w: cw, h: ch } = canvasDims.current
    const w = Math.min(Math.max(20, r.w), cw)
    const h = Math.min(Math.max(20, r.h), ch)
    return {
      x: Math.max(0, Math.min(r.x, cw - w)),
      y: Math.max(0, Math.min(r.y, ch - h)),
      w, h,
    }
  }, [])

  const handleRatioClick = useCallback((ratio) => {
    const toggling = activeRatioRef.current?.label === ratio.label
    setActiveRatio(toggling ? null : ratio)
    if (!toggling) {
      setRect(() => {
        const { w: cw, h: ch } = canvasDims.current
        if (!cw) return null
        const targetR = ratio.w / ratio.h
        let rw, rh
        if (cw / ch >= targetR) { rh = ch; rw = rh * targetR }
        else { rw = cw; rh = rw / targetR }
        rw = Math.round(rw); rh = Math.round(rh)
        if (rw >= cw - 1) rw = cw
        if (rh >= ch - 1) rh = ch
        const rx = rw === cw ? 0 : Math.round((cw - rw) / 2)
        const ry = rh === ch ? 0 : Math.round((ch - rh) / 2)
        return clampRect({ x: rx, y: ry, w: rw, h: rh })
      })
    }
  }, [clampRect])

  const getCanvasXY = (e) => {
    const canvas = canvasRef.current
    const b = canvas.getBoundingClientRect()
    const pr = canvas.width / b.width
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX - b.left) * pr, y: (clientY - b.top) * pr }
  }

  const getPixelRatio = () => {
    if (!canvasRef.current) return 1
    const b = canvasRef.current.getBoundingClientRect()
    return b.width > 0 ? canvasRef.current.width / b.width : 1
  }

  // Expose for overlay drag handlers
  const startDrag = useCallback((type, handle, e) => {
    e.preventDefault()
    const { x, y } = getCanvasXY(e)
    const r = rectRef.current
    dragState.current = { type, handle: handle || type, startX: x, startY: y, origRect: { ...r } }
  }, [])

  const onCanvasMouseDown = (e) => {
    if (!rect) return
    e.preventDefault()
    const { x, y } = getCanvasXY(e)
    const r = rect
    const ratio = activeRatioRef.current

    if (ratio) {
      // In ratio mode: only allow drag from inside to move (corners handled by HTML overlay)
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        dragState.current = { type: 'move', handle: 'move', startX: x, startY: y, origRect: { ...r } }
      }
      return
    }

    // Free mode: check for resize handles (8 zones) or new draw
    const hw = 20  // hit window in canvas px (scaled)
    const handles8 = [
      { id: 'tl', cx: r.x,       cy: r.y       },
      { id: 'tm', cx: r.x+r.w/2, cy: r.y       },
      { id: 'tr', cx: r.x+r.w,   cy: r.y       },
      { id: 'ml', cx: r.x,       cy: r.y+r.h/2 },
      { id: 'mr', cx: r.x+r.w,   cy: r.y+r.h/2 },
      { id: 'bl', cx: r.x,       cy: r.y+r.h   },
      { id: 'bm', cx: r.x+r.w/2, cy: r.y+r.h   },
      { id: 'br', cx: r.x+r.w,   cy: r.y+r.h   },
    ]
    const hit = handles8.find(h => Math.abs(x - h.cx) <= hw && Math.abs(y - h.cy) <= hw)
    if (hit) {
      dragState.current = { type: 'handle', handle: hit.id, startX: x, startY: y, origRect: { ...r } }
    } else if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      dragState.current = { type: 'move', handle: 'move', startX: x, startY: y, origRect: { ...r } }
    } else {
      dragState.current = { type: 'new', startX: x, startY: y }
    }
  }

  const onMouseMove = useCallback((e) => {
    if (!dragState.current) return
    const { x, y } = getCanvasXY(e)
    const ds = dragState.current
    const dx = x - ds.startX, dy = y - ds.startY
    const ratio = activeRatioRef.current

    if (ds.type === 'new') {
      const rx = Math.min(ds.startX, x), ry = Math.min(ds.startY, y)
      setRect(clampRect({ x: rx, y: ry, w: Math.abs(x - ds.startX), h: Math.abs(y - ds.startY) }))
      return
    }

    if (ds.type === 'move') {
      setRect(clampRect({ ...ds.origRect, x: ds.origRect.x + dx, y: ds.origRect.y + dy }))
      return
    }

    // Handle resize
    let { x: rx, y: ry, w: rw, h: rh } = ds.origRect
    const h = ds.handle

    if (ratio) {
      const targetR = ratio.w / ratio.h
      // Project drag onto ratio diagonal for proportional resize
      const diagLen = Math.sqrt(ratio.w ** 2 + ratio.h ** 2)
      const signX = (h === 'tr' || h === 'br') ? 1 : -1
      const signY = (h === 'bl' || h === 'br') ? 1 : -1
      const delta = dx * (ratio.w / diagLen) * signX + dy * (ratio.h / diagLen) * signY
      const newW = Math.max(20, rw + delta)
      const newH = newW / targetR
      if (h === 'tl' || h === 'tr') ry = (ry + rh) - newH
      if (h === 'tl' || h === 'bl') rx = (rx + rw) - newW
      setRect(clampRect({ x: rx, y: ry, w: newW, h: newH }))
      return
    }

    if (h === 'tl') { rx+=dx; ry+=dy; rw-=dx; rh-=dy }
    else if (h === 'tm') { ry+=dy; rh-=dy }
    else if (h === 'tr') { ry+=dy; rw+=dx; rh-=dy }
    else if (h === 'ml') { rx+=dx; rw-=dx }
    else if (h === 'mr') { rw+=dx }
    else if (h === 'bl') { rx+=dx; rw-=dx; rh+=dy }
    else if (h === 'bm') { rh+=dy }
    else if (h === 'br') { rw+=dx; rh+=dy }
    setRect(clampRect({ x: rx, y: ry, w: rw, h: rh }))
  }, [clampRect])

  const onMouseUp = useCallback(() => { dragState.current = null }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const handleApply = async () => {
    if (!rect || !imgRef.current) return
    setApplying(true); setApplyError('')
    try {
      const img = imgRef.current
      const { w: cw, h: ch } = canvasDims.current
      const scaleX = img.naturalWidth / cw
      const scaleY = img.naturalHeight / ch
      const offscreen = new OffscreenCanvas(Math.round(rect.w * scaleX), Math.round(rect.h * scaleY))
      const ctx2 = offscreen.getContext('2d')
      ctx2.drawImage(img, rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY, 0, 0, offscreen.width, offscreen.height)
      const blob = await offscreen.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
      await updateFileContent(accessToken, photo.id, blob, photo.mimeType || 'image/jpeg')
      onDone(photo.id)
    } catch (e) {
      setApplyError(e.message)
      setApplying(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxWidth: '92vw', maxHeight: '96vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{photo.name}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Ratio bar */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
          {RATIOS.map(r => (
            <button key={r.label} title={r.label} onClick={() => handleRatioClick(r)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '4px 6px', borderRadius: 6, border: '1px solid',
              borderColor: activeRatio?.label === r.label ? 'var(--primary)' : 'var(--border)',
              background: activeRatio?.label === r.label ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
              color: activeRatio?.label === r.label ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 9, fontWeight: 600, transition: 'all 0.12s',
            }}>
              <RatioIcon w={r.w} h={r.h} />
              {r.label}
            </button>
          ))}
        </div>

        {/* Canvas + overlay */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, minHeight: 200 }}>
          {imgError ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Impossibile caricare l'immagine</div>
          ) : !imgLoaded ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Caricamento immagine...</div>
          ) : (
            <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
              <canvas
                ref={canvasRef}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '68vh', cursor: 'crosshair', userSelect: 'none' }}
                onMouseDown={onCanvasMouseDown}
              />

              {/* HTML overlay handles — positioned in CSS pixels */}
              {cssRect && (
                <>
                  {/* Dark overlay around crop (4 divs) drawn by canvas — just handles here */}

                  {/* Corner handles (always 4 in ratio mode, 8 in free mode) */}
                  {(activeRatio ? [
                    { id: 'tl', left: cssRect.left - HANDLE_CSS/2, top: cssRect.top - HANDLE_CSS/2 },
                    { id: 'tr', left: cssRect.left + cssRect.width - HANDLE_CSS/2, top: cssRect.top - HANDLE_CSS/2 },
                    { id: 'bl', left: cssRect.left - HANDLE_CSS/2, top: cssRect.top + cssRect.height - HANDLE_CSS/2 },
                    { id: 'br', left: cssRect.left + cssRect.width - HANDLE_CSS/2, top: cssRect.top + cssRect.height - HANDLE_CSS/2 },
                  ] : [
                    { id: 'tl', left: cssRect.left - HANDLE_CSS/2, top: cssRect.top - HANDLE_CSS/2 },
                    { id: 'tm', left: cssRect.left + cssRect.width/2 - HANDLE_CSS/2, top: cssRect.top - HANDLE_CSS/2 },
                    { id: 'tr', left: cssRect.left + cssRect.width - HANDLE_CSS/2, top: cssRect.top - HANDLE_CSS/2 },
                    { id: 'ml', left: cssRect.left - HANDLE_CSS/2, top: cssRect.top + cssRect.height/2 - HANDLE_CSS/2 },
                    { id: 'mr', left: cssRect.left + cssRect.width - HANDLE_CSS/2, top: cssRect.top + cssRect.height/2 - HANDLE_CSS/2 },
                    { id: 'bl', left: cssRect.left - HANDLE_CSS/2, top: cssRect.top + cssRect.height - HANDLE_CSS/2 },
                    { id: 'bm', left: cssRect.left + cssRect.width/2 - HANDLE_CSS/2, top: cssRect.top + cssRect.height - HANDLE_CSS/2 },
                    { id: 'br', left: cssRect.left + cssRect.width - HANDLE_CSS/2, top: cssRect.top + cssRect.height - HANDLE_CSS/2 },
                  ]).map(({ id, left, top }) => (
                    <div
                      key={id}
                      onMouseDown={e => startDrag('handle', id, e)}
                      style={{
                        position: 'absolute',
                        left, top,
                        width: HANDLE_CSS, height: HANDLE_CSS,
                        background: 'white',
                        border: '2px solid rgba(0,0,0,0.4)',
                        borderRadius: 3,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                        cursor: getCursor(id),
                        zIndex: 10,
                        touchAction: 'none',
                      }}
                    />
                  ))}

                  {/* Center move button (only in ratio mode) */}
                  {activeRatio && (
                    <div
                      onMouseDown={e => startDrag('move', 'move', e)}
                      style={{
                        position: 'absolute',
                        left: cssRect.left + cssRect.width/2 - MOVE_R_CSS,
                        top:  cssRect.top  + cssRect.height/2 - MOVE_R_CSS,
                        width: MOVE_R_CSS * 2, height: MOVE_R_CSS * 2,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.22)',
                        border: '2px solid white',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        cursor: 'move',
                        zIndex: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: MOVE_R_CSS * 0.8,
                        color: 'white',
                        userSelect: 'none',
                      }}
                    >
                      ⠿
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0, gap: 10 }}>
          {applyError && <span style={{ fontSize: 12, color: '#ef4444', flex: 1 }}>{applyError}</span>}
          {rect && !applyError && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
              {Math.round(rect.w)} × {Math.round(rect.h)} px canvas
            </span>
          )}
          <button onClick={onClose} disabled={applying} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            Annulla
          </button>
          <button
            onClick={handleApply}
            disabled={applying || !rect || !imgLoaded}
            style={{ padding: '6px 18px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', cursor: applying ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, opacity: (!rect || !imgLoaded) ? 0.5 : 1 }}
          >
            {applying ? 'Salvataggio...' : 'Applica crop'}
          </button>
        </div>
      </div>
    </div>
  )
}

function getCursor(id) {
  if (id === 'tl' || id === 'br') return 'nwse-resize'
  if (id === 'tr' || id === 'bl') return 'nesw-resize'
  if (id === 'tm' || id === 'bm') return 'ns-resize'
  if (id === 'ml' || id === 'mr') return 'ew-resize'
  return 'move'
}
