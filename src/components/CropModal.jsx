import { useRef, useState } from 'react'
import { updateFileContent, getFileMetadata, patchFileMetadata } from '../drive'
import CropEditor from './CropEditor'

export default function CropModal({ photo, accessToken, onClose, onDone }) {
  const editorRef = useRef(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')

  const handleApply = async () => {
    setApplying(true); setApplyError('')
    try {
      const blob = await editorRef.current?.getCroppedBlob()
      if (!blob) throw new Error('Nessun ritaglio selezionato')
      await updateFileContent(accessToken, photo.id, blob, photo.mimeType || 'image/jpeg')
      if (photo.modifiedTime) {
        try { await patchFileMetadata(accessToken, photo.id, { modifiedTime: photo.modifiedTime }) } catch {}
      }
      // Fetch updated metadata to get fresh thumbnailLink from Drive
      let updatedMeta = null
      try { updatedMeta = await getFileMetadata(accessToken, photo.id) } catch {}
      onDone(photo.id, updatedMeta)
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

        <div style={{ flex: 1, minHeight: 0, borderBottom: '1px solid var(--border)' }}>
          <CropEditor ref={editorRef} photo={photo} maxWidth={1100} maxHeight={760} />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '10px 16px', flexShrink: 0, gap: 10 }}>
          {applyError && <span style={{ fontSize: 12, color: '#ef4444', flex: 1 }}>{applyError}</span>}
          <button onClick={onClose} disabled={applying} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            Annulla
          </button>
          <button
            onClick={handleApply}
            disabled={applying}
            style={{ padding: '6px 18px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', cursor: applying ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {applying ? 'Salvataggio...' : 'Applica crop'}
          </button>
        </div>
      </div>
    </div>
  )
}
