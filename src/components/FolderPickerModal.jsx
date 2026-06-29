import { useEffect, useState } from 'react'
import { listFiles } from '../drive'

export default function FolderPickerModal({ accessToken, title = 'Sposta in...', onConfirm, onClose }) {
  const [stack, setStack] = useState([{ id: 'root', name: 'My Drive' }])
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(false)

  const current = stack[stack.length - 1]

  useEffect(() => {
    setLoading(true)
    listFiles(accessToken, current.id).then(data => {
      const folders = (data.files || []).filter(f => f.mimeType === 'application/vnd.google-apps.folder')
        .sort((a, b) => a.name.localeCompare(b.name))
      setChildren(folders)
    }).catch(console.error).finally(() => setLoading(false))
  }, [current.id, accessToken])

  const navigate = (folder) => setStack(s => [...s, { id: folder.id, name: folder.name }])
  const goBack = () => setStack(s => s.slice(0, -1))

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
          {stack.map((s, i) => (
            <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>›</span>}
              <button
                onClick={() => setStack(prev => prev.slice(0, i + 1))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: i === stack.length - 1 ? 'var(--primary)' : 'var(--text-muted)', fontFamily: 'inherit', padding: '1px 2px' }}
              >{s.name}</button>
            </span>
          ))}
        </div>

        {/* Folder list */}
        <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 14, minHeight: 80 }}>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>Carico...</div>
          ) : children.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>Nessuna sottocartella</div>
          ) : children.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--border) 50%, transparent)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                onClick={() => onConfirm(f)}
              >{f.name}</span>
              <button onClick={() => navigate(f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit' }}>
                Apri →
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sposta in: <strong style={{ color: 'var(--text-primary)' }}>{current.name}</strong></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btnSecondary}>Annulla</button>
            <button onClick={() => onConfirm(current)} style={btnPrimary}>Sposta qui</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }
const modal = { background: 'var(--surface)', borderRadius: 14, padding: '20px 22px', width: 380, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid var(--border)' }
const btnPrimary = { padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnSecondary = { padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
