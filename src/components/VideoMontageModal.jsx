// src/components/VideoMontageModal.jsx
import { useState } from 'react'
import './VideoMontageModal.css'

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
        </div>
      </div>
    </div>
  )
}

// Stubs — implemented in Tasks 4 and 5
function EditStage({ clips, setClips, auth }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Edit stage — Task 4</div>
}
function RenderStage({ clips, onClose }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Render stage — Task 5</div>
}
