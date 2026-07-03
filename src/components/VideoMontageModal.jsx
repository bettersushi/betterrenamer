// src/components/VideoMontageModal.jsx
import { useState, useRef } from 'react'
import './VideoMontageModal.css'
import VideoTrimCrop from './VideoTrimCrop'

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
          {stage === 2 && <RenderStage clips={clips} onClose={onClose} />}
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
      dragIdx.current = i
      return next
    })
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
            clip={clips[activeIdx]}
            auth={auth}
            onChange={updated => updateClip(activeIdx, updated)}
          />
        )}
      </div>
    </div>
  )
}

// Stub — implemented in Task 5
function RenderStage({ clips, onClose }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Render stage — Task 5</div>
}
