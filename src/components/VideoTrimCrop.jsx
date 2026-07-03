// src/components/VideoTrimCrop.jsx
import { useRef, useState, useEffect, useCallback } from 'react'
import './VideoTrimCrop.css'

function fmt(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function VideoTrimCrop({ clip, auth, onChange }) {
  const { file, trim, crop } = clip
  const videoRef = useRef(null)
  const timelineRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(trim?.start ?? 0)
  const [end, setEnd] = useState(trim?.end ?? null)  // null = use full length
  const [cropMode, setCropMode] = useState(!!crop)
  const [cropRect, setCropRect] = useState(crop || null)  // {x,y,w,h} in CSS px over video element
  const dragRef = useRef(null)

  // Drive video URL (authenticated)
  const videoSrc = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onMeta = () => {
      setDuration(v.duration)
      setEnd(e => e ?? v.duration)
    }
    v.addEventListener('loadedmetadata', onMeta)
    return () => v.removeEventListener('loadedmetadata', onMeta)
  }, [])

  // Sync changes up to parent
  useEffect(() => {
    onChange({
      ...clip,
      trim: duration > 0 ? { start, end: end ?? duration } : null,
      crop: cropMode && cropRect ? { ...cropRect } : null,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, cropMode, cropRect])

  // Timeline drag
  const startTimelineDrag = useCallback((handle, e) => {
    e.preventDefault()
    dragRef.current = { handle, startX: e.clientX, startStart: start, startEnd: end ?? duration }
    const onMove = (ev) => {
      const tl = timelineRef.current
      if (!tl || !dragRef.current) return
      const { handle, startX, startStart, startEnd } = dragRef.current
      const dx = ev.clientX - startX
      const pct = dx / tl.getBoundingClientRect().width
      const dt = pct * duration
      if (handle === 'start') {
        setStart(Math.max(0, Math.min(startStart + dt, (end ?? duration) - 0.5)))
        videoRef.current.currentTime = Math.max(0, startStart + dt)
      } else {
        setEnd(Math.max(start + 0.5, Math.min(startEnd + dt, duration)))
        videoRef.current.currentTime = Math.max(start + 0.5, startEnd + dt)
      }
    }
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [start, end, duration])

  // Crop overlay drag (simple new-rect draw on video element)
  const cropDragRef = useRef(null)

  const onVideoCropMouseDown = useCallback((e) => {
    if (!cropMode) return
    e.preventDefault()
    const v = videoRef.current
    const b = v.getBoundingClientRect()
    const sx = e.clientX - b.left, sy = e.clientY - b.top
    cropDragRef.current = { sx, sy }
    const onMove = (ev) => {
      if (!cropDragRef.current) return
      const ex = ev.clientX - b.left, ey = ev.clientY - b.top
      setCropRect({
        x: Math.min(sx, ex), y: Math.min(sy, ey),
        w: Math.abs(ex - sx), h: Math.abs(ey - sy),
        vw: b.width, vh: b.height,
      })
    }
    const onUp = () => { cropDragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [cropMode])

  const startPct = duration > 0 ? (start / duration) * 100 : 0
  const endPct   = duration > 0 ? ((end ?? duration) / duration) * 100 : 100

  return (
    <div className="vtc-wrap">
      {/* Video preview */}
      <div className="vtc-video-wrap">
        <video
          ref={videoRef}
          src={videoSrc}
          className="vtc-video"
          controls
          crossOrigin="use-credentials"
          style={{ pointerEvents: cropMode ? 'none' : 'auto' }}
        />
        {/* Crop mode: draw overlay on top */}
        {cropMode && (
          <div
            className={`vtc-crop-overlay${cropMode ? ' active' : ''}`}
            onMouseDown={onVideoCropMouseDown}
          >
            {cropRect && cropRect.w > 4 && cropRect.h > 4 && (
              <div className="vtc-crop-rect" style={{
                left: cropRect.x, top: cropRect.y,
                width: cropRect.w, height: cropRect.h,
              }}>
                {/* Corner handles (visual only — resize handled by re-draw) */}
                {[
                  { id:'tl', style:{top:-5,left:-5,cursor:'nwse-resize'} },
                  { id:'tr', style:{top:-5,right:-5,cursor:'nesw-resize'} },
                  { id:'bl', style:{bottom:-5,left:-5,cursor:'nesw-resize'} },
                  { id:'br', style:{bottom:-5,right:-5,cursor:'nwse-resize'} },
                ].map(h => <div key={h.id} className="vtc-crop-handle" style={h.style} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trim section */}
      <div className="vtc-timeline-wrap">
        <div className="vtc-section-label">Taglia clip</div>
        <div className="vtc-timeline" ref={timelineRef}>
          <div className="vtc-timeline-fill" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
          <div className="vtc-timeline-handle" style={{ left: `${startPct}%` }} onMouseDown={e => startTimelineDrag('start', e)} />
          <div className="vtc-timeline-handle" style={{ left: `${endPct}%` }} onMouseDown={e => startTimelineDrag('end', e)} />
        </div>
        <div className="vtc-timeline-labels">
          <span>▶ {fmt(start)}</span>
          <span>{fmt(end ?? duration)} ■</span>
        </div>
      </div>

      {/* Crop toggle */}
      <div>
        <div className="vtc-section-label">Crop spaziale</div>
        <div className="vtc-toggle-row">
          <button className={`vtc-toggle-btn${!cropMode ? ' active' : ''}`} onClick={() => { setCropMode(false); setCropRect(null) }}>Nessun crop</button>
          <button className={`vtc-toggle-btn${cropMode ? ' active' : ''}`} onClick={() => setCropMode(true)}>Disegna area</button>
        </div>
        {cropMode && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Trascina sull'anteprima per definire l'area da tagliare</p>}
      </div>
    </div>
  )
}
