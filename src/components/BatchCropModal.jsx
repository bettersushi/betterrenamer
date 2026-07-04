import { useRef, useState } from 'react'
import { updateFileContent, getFileMetadata, patchFileMetadata } from '../drive'
import CropEditor from './CropEditor'

export default function BatchCropModal({ photos, accessToken, onClose, onDone }) {
  const editorRefs = useRef({})
  const [saving, setSaving] = useState(false)
  const [cellStatus, setCellStatus] = useState({}) // { [photoId]: 'saving' | 'done' | 'error' }
  const [cellError, setCellError] = useState({})   // { [photoId]: message }

  const handleSaveAll = async () => {
    setSaving(true)
    setCellStatus(Object.fromEntries(photos.map(p => [p.id, 'saving'])))
    setCellError({})

    const results = await Promise.all(photos.map(async photo => {
      try {
        const blob = await editorRefs.current[photo.id]?.getCroppedBlob()
        if (!blob) throw new Error('Nessun ritaglio selezionato')
        await updateFileContent(accessToken, photo.id, blob, photo.mimeType || 'image/jpeg')
        if (photo.modifiedTime) {
          try { await patchFileMetadata(accessToken, photo.id, { modifiedTime: photo.modifiedTime }) } catch {}
        }
        const updatedMeta = await getFileMetadata(accessToken, photo.id).catch(() => null)
        setCellStatus(s => ({ ...s, [photo.id]: 'done' }))
        return { photoId: photo.id, updatedMeta }
      } catch (e) {
        setCellStatus(s => ({ ...s, [photo.id]: 'error' }))
        setCellError(s => ({ ...s, [photo.id]: e.message }))
        return { photoId: photo.id, error: e.message }
      }
    }))

    setSaving(false)
    onDone(results)
  }

  const allDone = photos.length > 0 && photos.every(p => cellStatus[p.id] === 'done')

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', width: '92vw', maxWidth: 1300, maxHeight: '94vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1, color: 'var(--text-primary)' }}>Crop multiplo — {photos.length} foto</span>
          <button onClick={onClose} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Grid of editors */}
        <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {photos.map(photo => {
              const status = cellStatus[photo.id]
              return (
                <div key={photo.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 340, position: 'relative', opacity: status === 'saving' ? 0.6 : 1 }}>
                  <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: '1px solid var(--border)' }}>
                    {photo.name}
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <CropEditor
                      ref={el => { editorRefs.current[photo.id] = el }}
                      photo={photo}
                      maxWidth={280}
                      maxHeight={240}
                      compact
                    />
                  </div>
                  {status === 'done' && (
                    <div style={{ position: 'absolute', top: 6, right: 6, background: '#22c55e', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✓</div>
                  )}
                  {status === 'error' && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(239,68,68,0.9)', color: 'white', fontSize: 10, padding: '3px 6px' }}>
                      {cellError[photo.id] || 'Errore'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0, gap: 10 }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            {allDone ? 'Chiudi' : 'Annulla'}
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            style={{ padding: '6px 18px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {saving ? 'Salvataggio...' : `Salva tutte (${photos.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
