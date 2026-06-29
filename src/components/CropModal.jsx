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

const HANDLE_SIZE = 14
const HANDLE_HIT = 24
const MOVE_HANDLE_R = 30

function RatioIcon({ w, h }) {
  const maxW = 16, maxH = 16
  const scale = Math.min(maxW / w, maxH / h)
  const rw = Math.round(w * scale)
  const rh = Math.round(h * scale)
  const cx = 10, cy = 10
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x={cx - rw/2} y={cy - rh/2} width={rw} height={rh} stroke="currentColor" strokeWidth="1.5" rx="1"/>
    </svg>
  )
}

function getHitZone(x, y, rect) {
  const { x: rx, y: ry, w: rw, h: rh } = rect
  const handles = [
    { id: 'tl', cx: rx,      cy: ry      },
    { id: 'tm', cx: rx+rw/2, cy: ry      },
    { id: 'tr', cx: rx+rw,   cy: ry      },
    { id: 'ml', cx: rx,      cy: ry+rh/2 },
    { id: 'mr', cx: rx+rw,   cy: ry+rh/2 },
    { id: 'bl', cx: rx,      cy: ry+rh   },
    { id: 'bm', cx: rx+rw/2, cy: ry+rh   },
    { id: 'br', cx: rx+rw,   cy: ry+rh   },
  ]
  for (const h of handles) {
    if (Math.abs(x - h.cx) <= HANDLE_HIT && Math.abs(y - h.cy) <= HANDLE_HIT) return h.id
  }
  if (x >= rx && x <= rx+rw && y >= ry && y <= ry+rh) return 'move'
  return null
}

function getCornerHitZone(x, y, rect) {
  const { x: rx, y: ry, w: rw, h: rh } = rect
  const corners = [
    { id: 'tl', cx: rx,    cy: ry    },
    { id: 'tr', cx: rx+rw, cy: ry    },
    { id: 'bl', cx: rx,    cy: ry+rh },
    { id: 'br', cx: rx+rw, cy: ry+rh },
  ]
  for (const c of corners) {
    if (Math.abs(x - c.cx) <= HANDLE_HIT && Math.abs(y - c.cy) <= HANDLE_HIT) return c.id
  }
  return null
}

function applyHandleDrag(handle, rect, dx, dy, ratio) {
  let { x, y, w, h } = rect
  if (handle === 'move') { return { x: x+dx, y: y+dy, w, h } }

  if (ratio) {
    const targetR = ratio.w / ratio.h
    if (['tl','tr','bl','br'].includes(handle)) {
      // Project drag onto the ratio diagonal to get a single scale delta
      const diagLen = Math.sqrt(ratio.w ** 2 + ratio.h ** 2)
      const signX = ['tr','br'].includes(handle) ? 1 : -1
      const signY = ['bl','br'].includes(handle) ? 1 : -1
      const delta = dx * (ratio.w / diagLen) * signX + dy * (ratio.h / diagLen) * signY
      const newW = Math.max(10, w + delta)
      const newH = newW / targetR
      if (['tl','tr'].includes(handle)) y = (y + h) - newH
      if (['tl','bl'].includes(handle)) x = (x + w) - newW
      w = newW; h = newH
    } else if (['tm','bm'].includes(handle)) {
      if (handle === 'tm') { y += dy; h -= dy } else { h += dy }
      const newW = h * targetR
      x = x + (w - newW) / 2
      w = newW
    } else {
      if (handle === 'ml') { x += dx; w -= dx } else { w += dx }
      h = w / targetR
    }
    return { x, y, w: Math.max(10, w), h: Math.max(10, h) }
  }

  if (handle === 'tl') { x+=dx; y+=dy; w-=dx; h-=dy }
  else if (handle === 'tm') { y+=dy; h-=dy }
  else if (handle === 'tr') { y+=dy; w+=dx; h-=dy }
  else if (handle === 'ml') { x+=dx; w-=dx }
  else if (handle === 'mr') { w+=dx }
  else if (handle === 'bl') { x+=dx; w-=dx; h+=dy }
  else if (handle === 'bm') { h+=dy }
  else if (handle === 'br') { w+=dx; h+=dy }
  return { x, y, w: Math.max(10, w), h: Math.max(10, h) }
}

export default function CropModal({ photo, accessToken, onClose, onDone }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [rect, setRect] = useState(null)
  const [activeRatio, setActiveRatio] = useState(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')
  const dragState = useRef(null)
  const canvasDims = useRef({ w: 0, h: 0 })

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; setImgLoaded(true) }
    img.onerror = () => setImgError(true)
    img.src = `/api/proxy-image?url=${encodeURIComponent(getLargeThumbUrl(photo.thumbnailLink, 1600))}`
  }, [photo.thumbnailLink])

  useEffect(() => {
    if (!imgLoaded || !canvasRef.current) return
    const canvas = canvasRef.current
    const img = imgRef.current
    const maxW = Math.min(window.innerWidth * 0.82, 1100)
    const maxH = Math.min(window.innerHeight * 0.72, 800)
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
    const cw = Math.round(img.naturalWidth * scale)
    const ch = Math.round(img.naturalHeight * scale)
    canvas.width = cw; canvas.height = ch
    canvasDims.current = { w: cw, h: ch }
    const margin = 20
    setRect({ x: margin, y: margin, w: cw - margin*2, h: ch - margin*2 })
  }, [imgLoaded])

  useEffect(() => {
    if (!imgLoaded || !rect || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = imgRef.current
    const { w: cw, h: ch } = canvasDims.current
    const { x, y, w, h } = rect

    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, 0, 0, cw, ch)

    ctx.fillStyle = 'rgba(0,0,0,0.52)'
    ctx.fillRect(0, 0, cw, y)
    ctx.fillRect(0, y+h, cw, ch-y-h)
    ctx.fillRect(0, y, x, h)
    ctx.fillRect(x+w, y, cw-x-w, h)

    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 0.5
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(x + w*i/3, y); ctx.lineTo(x + w*i/3, y+h); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x, y + h*i/3); ctx.lineTo(x+w, y + h*i/3); ctx.stroke()
    }

    ctx.strokeStyle = 'white'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, y, w, h)

    if (activeRatio) {
      // 4 corner handles
      [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([hx,hy]) => {
        ctx.fillStyle = 'white'
        ctx.fillRect(hx - HANDLE_SIZE/2, hy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE)
        ctx.strokeStyle = '#444'; ctx.lineWidth = 0.5
        ctx.strokeRect(hx - HANDLE_SIZE/2, hy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE)
      })
      // Move handle circle
      const hcx = x + w/2, hcy = y + h/2
      ctx.beginPath(); ctx.arc(hcx, hcy, MOVE_HANDLE_R, 0, Math.PI*2)
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill()
      ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.fillStyle = 'white'
      ctx.font = `${Math.round(MOVE_HANDLE_R * 0.9)}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('⠿', hcx, hcy)
    } else {
      const handles = [
        [x,   y],   [x+w/2, y],   [x+w, y],
        [x,   y+h/2],             [x+w, y+h/2],
        [x,   y+h],  [x+w/2, y+h], [x+w, y+h],
      ]
      handles.forEach(([hx, hy]) => {
        ctx.fillStyle = 'white'
        ctx.fillRect(hx - HANDLE_SIZE/2, hy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE)
        ctx.strokeStyle = '#333'; ctx.lineWidth = 0.5
        ctx.strokeRect(hx - HANDLE_SIZE/2, hy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE)
      })
    }
  }, [imgLoaded, rect, activeRatio])

  const clampRect = useCallback((r) => {
    const { w: cw, h: ch } = canvasDims.current
    return {
      x: Math.max(0, Math.min(r.x, cw - r.w)),
      y: Math.max(0, Math.min(r.y, ch - r.h)),
      w: Math.min(r.w, cw),
      h: Math.min(r.h, ch),
    }
  }, [])

  const handleRatioClick = useCallback((ratio) => {
    setActiveRatio(r => r?.label === ratio.label ? null : ratio)
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
  }, [clampRect])

  const getCanvasXY = (e) => {
    const canvas = canvasRef.current
    const bounds = canvas.getBoundingClientRect()
    const scaleX = canvas.width / bounds.width
    const scaleY = canvas.height / bounds.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX - bounds.left) * scaleX, y: (clientY - bounds.top) * scaleY }
  }

  const onMouseDown = (e) => {
    if (!rect) return
    e.preventDefault()
    const { x, y } = getCanvasXY(e)

    if (activeRatio) {
      const cx = rect.x + rect.w/2, cy = rect.y + rect.h/2
      if (Math.hypot(x - cx, y - cy) <= MOVE_HANDLE_R + 6) {
        dragState.current = { type: 'move', startX: x, startY: y, origRect: { ...rect } }
        return
      }
      const cornerZone = getCornerHitZone(x, y, rect)
      if (cornerZone) {
        dragState.current = { type: 'handle', handle: cornerZone, startX: x, startY: y, origRect: { ...rect } }
        return
      }
      if (x >= rect.x && x <= rect.x+rect.w && y >= rect.y && y <= rect.y+rect.h) {
        dragState.current = { type: 'move', startX: x, startY: y, origRect: { ...rect } }
      }
      return
    }

    const zone = getHitZone(x, y, rect)
    if (zone) {
      dragState.current = { type: 'handle', handle: zone, startX: x, startY: y, origRect: { ...rect } }
    } else {
      dragState.current = { type: 'new', startX: x, startY: y }
    }
  }

  const onMouseMove = (e) => {
    if (!dragState.current) return
    const { x, y } = getCanvasXY(e)
    const ds = dragState.current
    const dx = x - ds.startX, dy = y - ds.startY

    if (ds.type === 'new') {
      const rx = Math.min(ds.startX, x), ry = Math.min(ds.startY, y)
      const rw = Math.abs(x - ds.startX), rh = Math.abs(y - ds.startY)
      setRect(clampRect({ x: rx, y: ry, w: Math.max(10, rw), h: Math.max(10, rh) }))
    } else if (ds.type === 'move') {
      setRect(clampRect({ ...ds.origRect, x: ds.origRect.x + dx, y: ds.origRect.y + dy }))
    } else if (ds.type === 'handle') {
      const newRect = applyHandleDrag(ds.handle, { ...ds.origRect }, dx, dy, activeRatio)
      setRect(clampRect(newRect))
    }
  }

  const onMouseUp = () => { dragState.current = null }

  const handleApply = async () => {
    if (!rect || !imgRef.current) return
    setApplying(true); setApplyError('')
    try {
      const img = imgRef.current
      const { w: cw, h: ch } = canvasDims.current
      const scaleX = img.naturalWidth / cw
      const scaleY = img.naturalHeight / ch
      const offscreen = new OffscreenCanvas(
        Math.round(rect.w * scaleX),
        Math.round(rect.h * scaleY)
      )
      const ctx2 = offscreen.getContext('2d')
      ctx2.drawImage(
        img,
        rect.x * scaleX, rect.y * scaleY,
        rect.w * scaleX, rect.h * scaleY,
        0, 0, offscreen.width, offscreen.height
      )
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
      <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxWidth: '90vw', maxHeight: '96vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{photo.name}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Ratio bar */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
          {RATIOS.map(r => (
            <button
              key={r.label}
              title={r.label}
              onClick={() => handleRatioClick(r)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '4px 6px', borderRadius: 6, border: '1px solid',
                borderColor: activeRatio?.label === r.label ? 'var(--primary)' : 'var(--border)',
                background: activeRatio?.label === r.label ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                color: activeRatio?.label === r.label ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 9, fontWeight: 600, transition: 'all 0.12s',
              }}
            >
              <RatioIcon w={r.w} h={r.h} />
              {r.label}
            </button>
          ))}
        </div>

        {/* Canvas area */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 200 }}>
          {imgError ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Impossibile caricare l'immagine</div>
          ) : !imgLoaded ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Caricamento immagine...</div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '72vh', cursor: activeRatio ? 'default' : 'crosshair', userSelect: 'none' }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0, gap: 10 }}>
          {applyError && <span style={{ fontSize: 12, color: '#ef4444', flex: 1 }}>{applyError}</span>}
          {rect && !applyError && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
              {Math.round(rect.w)} × {Math.round(rect.h)} px (display)
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
