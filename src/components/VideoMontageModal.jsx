// src/components/VideoMontageModal.jsx
import { useState, useRef, useEffect } from 'react'
import './VideoMontageModal.css'
import VideoTrimCrop from './VideoTrimCrop'
import { useFFmpeg } from '../hooks/useFFmpeg'
import { fetchFile } from '@ffmpeg/util'

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function IconFilm() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>
    </svg>
  )
}

const STAGES = ['Selezione', 'Modifica clip', 'Esporta']

export default function VideoMontageModal({ videos, auth, onClose }) {
  const [stage, setStage] = useState(0)          // 0=select, 1=edit, 2=render
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [clips, setClips] = useState([])         // ordered array of clip objects {file, trim, crop}

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function goToEdit() {
    const ordered = videos.filter(v => selectedIds.has(v.id))
    setClips(ordered.map(f => ({ file: f, trim: null, crop: null })))
    setStage(1)
  }

  return (
    <div className="vmm-overlay" onClick={e => { if (e.target.classList.contains('vmm-overlay')) onClose() }}>
      <div className="vmm-modal">
        {/* Header */}
        <div className="vmm-header">
          <IconFilm />
          <span className="vmm-title">Monta video</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {/* Step indicators */}
        <div className="vmm-steps">
          {STAGES.map((s, i) => (
            <div key={s} className={`vmm-step${i === stage ? ' active' : i < stage ? ' done' : ''}`}>{i + 1}. {s}</div>
          ))}
        </div>

        {/* Body */}
        <div className="vmm-body">
          {stage === 0 && (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                Seleziona i video da includere nel montaggio ({videos.length} disponibili)
              </p>
              <div className="vmm-clip-grid">
                {videos.map(v => (
                  <div
                    key={v.id}
                    className={`vmm-clip-item${selectedIds.has(v.id) ? ' selected' : ''}`}
                    onClick={() => toggleSelect(v.id)}
                    title={v.name}
                  >
                    {v.thumbnailLink
                      ? <img src={v.thumbnailLink.replace(/=s\d+$/, '=s220')} alt="" loading="lazy" />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 22 }}>▶</div>
                    }
                    <div className="vmm-clip-check">✓</div>
                    <div className="vmm-clip-badge">{formatSize(v.size ? parseInt(v.size) : 0)}</div>
                    <div className="vmm-clip-name">{v.name}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {stage === 1 && <EditStage clips={clips} setClips={setClips} auth={auth} />}
          {stage === 2 && <RenderStage clips={clips} auth={auth} onClose={onClose} />}
        </div>

        {/* Footer */}
        <div className="vmm-footer">
          {stage > 0 && (
            <button onClick={() => setStage(s => s - 1)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
              Indietro
            </button>
          )}
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            Annulla
          </button>
          {stage === 0 && (
            <button
              onClick={goToEdit}
              disabled={selectedIds.size < 1}
              style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', cursor: selectedIds.size < 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: 13, opacity: selectedIds.size < 1 ? 0.45 : 1 }}
            >
              Avanti ({selectedIds.size} clip)
            </button>
          )}
          {stage === 1 && (
            <button
              onClick={() => setStage(2)}
              style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              Esporta →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function EditStage({ clips, setClips, auth }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const dragIdx = useRef(null)

  function updateClip(idx, updated) {
    setClips(prev => prev.map((c, i) => i === idx ? updated : c))
  }

  // Drag-to-reorder
  function onDragStart(i) { dragIdx.current = i }
  function onDragOver(e, i) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === i) return
    setClips(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx.current, 1)
      next.splice(i, 0, moved)
      return next
    })
    dragIdx.current = i
  }
  function onDragEnd() { dragIdx.current = null }

  return (
    <div style={{ display: 'flex', gap: 18 }}>
      {/* Left: ordered list */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>ORDINE CLIP</div>
        <div className="vmm-edit-list">
          {clips.map((c, i) => (
            <div
              key={c.file.id}
              className={`vmm-edit-item${i === activeIdx ? ' selected' : ''}`}
              style={{ borderColor: i === activeIdx ? 'var(--primary)' : 'var(--border)', opacity: 1 }}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={e => onDragOver(e, i)}
              onDragEnd={onDragEnd}
              onClick={() => setActiveIdx(i)}
            >
              {c.file.thumbnailLink
                ? <img className="vmm-edit-thumb" src={c.file.thumbnailLink.replace(/=s\d+$/, '=s160')} alt="" />
                : <div className="vmm-edit-thumb" style={{ background: 'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:18 }}>▶</div>
              }
              <div className="vmm-edit-info">
                <div className="vmm-edit-name">{i + 1}. {c.file.name}</div>
                <div className="vmm-edit-meta">
                  {c.trim ? `✂ ${c.trim.start.toFixed(1)}s–${c.trim.end.toFixed(1)}s` : 'Clip intera'}
                  {c.crop ? ' · Crop ✓' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: trim+crop editor for active clip */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
          MODIFICA: {clips[activeIdx]?.file.name}
        </div>
        {clips[activeIdx] && (
          <VideoTrimCrop
            key={clips[activeIdx].file.id}
            clip={clips[activeIdx]}
            auth={auth}
            onChange={updated => updateClip(activeIdx, updated)}
          />
        )}
      </div>
    </div>
  )
}

function RenderStage({ clips, auth, onClose }) {
  const { ffmpeg, loaded, load, progress } = useFFmpeg()
  const [quality, setQuality] = useState(() => {
    const totalMB = clips.reduce((s, c) => s + (parseInt(c.file.size) || 0), 0) / (1024 * 1024)
    if (totalMB < 100) return '1080p'
    if (totalMB < 400) return '720p'
    return '480p'
  })
  const [status, setStatus] = useState('idle')  // idle | loading | processing | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [outputUrl, setOutputUrl] = useState(null)
  const [currentClip, setCurrentClip] = useState(0)

  useEffect(() => {
    return () => { if (outputUrl) URL.revokeObjectURL(outputUrl) }
  }, [outputUrl])

  const QUALITY = {
    '480p':  { scale: 'scale=-2:480',  crf: 28 },
    '720p':  { scale: 'scale=-2:720',  crf: 26 },
    '1080p': { scale: 'scale=-2:1080', crf: 24 },
  }

  async function handleRender() {
    setStatus('loading')
    setErrorMsg('')
    try {
      let ff = ffmpeg
      if (!loaded) ff = await load()
      if (!ff) throw new Error('FFmpeg non disponibile')
      setStatus('processing')
      const { scale, crf } = QUALITY[quality]
      const concatLines = []

      for (let i = 0; i < clips.length; i++) {
        setCurrentClip(i + 1)
        const { file, trim, crop } = clips[i]
        // Download from Drive
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
          { headers: { Authorization: `Bearer ${auth.accessToken}` } }
        )
        if (!res.ok) throw new Error(`Download fallito: ${file.name}`)
        const blob = await res.blob()
        const inName = `in_${i}.mp4`
        await ff.writeFile(inName, await fetchFile(blob))

        // Build vf filter
        let vf = ''
        if (crop && crop.w > 4 && crop.h > 4) {
          // Convert CSS px crop to video pixel coords
          const scaleX = file.videoMediaMetadata?.width  ? file.videoMediaMetadata.width  / crop.vw : 1
          const scaleY = file.videoMediaMetadata?.height ? file.videoMediaMetadata.height / crop.vh : 1
          const rawCx = Math.round(crop.x * scaleX)
          const rawCy = Math.round(crop.y * scaleY)
          const rawCw = Math.round(crop.w * scaleX)
          const rawCh = Math.round(crop.h * scaleY)
          const vidW = file.videoMediaMetadata?.width  ?? rawCw
          const vidH = file.videoMediaMetadata?.height ?? rawCh
          const cx = Math.max(0, Math.min(rawCx, vidW - 2))
          const cy = Math.max(0, Math.min(rawCy, vidH - 2))
          const cw = Math.max(2, Math.min(rawCw, vidW - cx))
          const ch = Math.max(2, Math.min(rawCh, vidH - cy))
          vf = `crop=${cw}:${ch}:${cx}:${cy},${scale}`
        } else {
          vf = scale
        }

        const args = ['-y']
        if (trim) { args.push('-ss', String(trim.start), '-to', String(trim.end)) }
        args.push('-i', inName)
        args.push('-vf', vf, '-c:v', 'libx264', '-crf', String(crf), '-preset', 'fast', '-c:a', 'aac')
        const outName = `clip_${i}.mp4`
        args.push(outName)
        await ff.exec(args)
        await ff.deleteFile(inName)
        concatLines.push(`file '${outName}'`)
      }

      // Write concat list
      const concatTxt = concatLines.join('\n')
      await ff.writeFile('concat.txt', concatTxt)
      await ff.exec(['-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'output.mp4'])

      const data = await ff.readFile('output.mp4')
      const url = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }))
      setOutputUrl(url)
      setStatus('done')

      // Cleanup
      for (let i = 0; i < clips.length; i++) { try { await ff.deleteFile(`clip_${i}.mp4`) } catch {} }
      try { await ff.deleteFile('output.mp4') } catch {}
      try { await ff.deleteFile('concat.txt') } catch {}
    } catch (e) {
      console.error(e)
      setErrorMsg(e.message || 'Errore durante l\'elaborazione')
      setStatus('error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Quality picker */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>QUALITÀ OUTPUT</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['480p', '720p', '1080p'].map(q => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              disabled={status === 'processing'}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: `1px solid ${quality === q ? 'var(--primary)' : 'var(--border)'}`,
                background: quality === q ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                color: quality === q ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: status === 'processing' ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {q}
              {quality === q && <span style={{ display: 'block', fontSize: 9, fontWeight: 400, color: 'var(--text-muted)' }}>Consigliato</span>}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          {clips.length} clip · {(clips.reduce((s,c) => s + (parseInt(c.file.size)||0), 0) / (1024*1024)).toFixed(0)} MB totali
        </p>
      </div>

      {/* Clip summary */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>RIEPILOGO</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {clips.map((c, i) => (
            <div key={c.file.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--surface-2, var(--bg))', borderRadius: 7, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-muted)', width: 16, textAlign: 'right' }}>{i+1}.</span>
              <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.file.name}</span>
              {c.trim && <span>✂ {c.trim.start.toFixed(1)}s–{c.trim.end.toFixed(1)}s</span>}
              {c.crop && <span>crop ✓</span>}
              {status === 'processing' && currentClip === i + 1 && <span style={{ color: 'var(--primary)' }}>elaborazione…</span>}
              {status === 'processing' && currentClip > i + 1 && <span style={{ color: 'var(--success, green)' }}>✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Progress */}
      {(status === 'loading' || status === 'processing') && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {status === 'loading' ? 'Caricamento FFmpeg…' : `Elaborazione clip ${currentClip}/${clips.length}…`}
          </div>
          <div className="vmm-progress-bar">
            <div className="vmm-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{ padding: '10px 14px', background: 'color-mix(in srgb, #ef4444 10%, transparent)', border: '1px solid #ef4444', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
          {errorMsg}
        </div>
      )}

      {/* Done */}
      {status === 'done' && outputUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>✓ Montaggio completato</div>
          <a
            href={outputUrl}
            download="montaggio.mp4"
            style={{ padding: '9px 24px', borderRadius: 9, background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            ⬇ Scarica MP4
          </a>
        </div>
      )}

      {/* Action button */}
      {(status === 'idle' || status === 'error') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleRender}
            style={{ padding: '9px 24px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}
          >
            🎬 Genera montaggio
          </button>
        </div>
      )}
    </div>
  )
}
