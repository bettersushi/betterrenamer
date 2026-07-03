import { useState } from 'react'
import { updateFileContent, getFileMetadata, patchFileMetadata, uploadFile } from '../drive'
import { useReplicate } from '../hooks/useReplicate'
import FolderPickerModal from './FolderPickerModal'

function getLargeThumbUrl(thumbnailLink, size = 1600) {
  if (!thumbnailLink) return null
  return thumbnailLink.replace(/=s\d+$/, `=s${size}`).replace(/=s\d+-/, `=s${size}-`)
}

const SCALES = [2, 4]

export default function EnhanceModal({ photo, accessToken, onClose, onDone }) {
  const { loading, error, enhance } = useReplicate()
  const [scale, setScale] = useState(4)
  const [resultUrl, setResultUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showFolderPicker, setShowFolderPicker] = useState(false)

  const originalSrc = `/api/proxy-image?url=${encodeURIComponent(getLargeThumbUrl(photo.thumbnailLink, 1200))}`
  const previewSrc = resultUrl ? `/api/proxy-image?url=${encodeURIComponent(resultUrl)}` : null

  const handleRun = async () => {
    setResultUrl(null)
    setSaveError('')
    try {
      const url = await enhance(photo.id, accessToken, scale)
      setResultUrl(url)
    } catch {
      // error already surfaced via hook state
    }
  }

  const fetchResultBlob = async () => {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(resultUrl)}`)
    if (!res.ok) throw new Error('Impossibile scaricare il risultato')
    return res.blob()
  }

  const handleSaveOverwrite = async () => {
    setSaving(true); setSaveError('')
    try {
      const blob = await fetchResultBlob()
      await updateFileContent(accessToken, photo.id, blob, photo.mimeType || 'image/jpeg')
      if (photo.modifiedTime) {
        try { await patchFileMetadata(accessToken, photo.id, { modifiedTime: photo.modifiedTime }) } catch {}
      }
      let updatedMeta = null
      try { updatedMeta = await getFileMetadata(accessToken, photo.id) } catch {}
      onDone(photo.id, updatedMeta)
    } catch (e) {
      setSaveError(e.message)
      setSaving(false)
    }
  }

  const handleSaveAs = async (folder) => {
    setShowFolderPicker(false)
    setSaving(true); setSaveError('')
    try {
      const blob = await fetchResultBlob()
      const dot = photo.name.lastIndexOf('.')
      const base = dot > 0 ? photo.name.slice(0, dot) : photo.name
      const ext = dot > 0 ? photo.name.slice(dot) : '.jpg'
      const newName = `${base}_enhanced${ext}`
      await uploadFile(accessToken, blob, newName, photo.mimeType || 'image/jpeg', folder.id)
      onDone(null, null)
    } catch (e) {
      setSaveError(e.message)
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxWidth: '92vw', maxHeight: '96vh', overflow: 'hidden', width: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>Enhance — {photo.name}</span>
          <button onClick={onClose} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '8px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 8 }}>Scala:</span>
          {SCALES.map(s => (
            <button key={s} onClick={() => setScale(s)} disabled={loading} style={{
              padding: '4px 12px', borderRadius: 6, border: '1px solid',
              borderColor: scale === s ? 'var(--primary)' : 'var(--border)',
              background: scale === s ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
              color: scale === s ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>{s}x</button>
          ))}
          <button
            onClick={handleRun}
            disabled={loading}
            style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', cursor: loading ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            {loading ? 'Elaborazione...' : 'Applica enhance'}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', gap: 12, padding: 16, minHeight: 200 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Originale</span>
            <img src={originalSrc} alt={photo.name} style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', borderRadius: 8, background: 'rgba(0,0,0,0.2)' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Risultato</span>
            {previewSrc ? (
              <img src={previewSrc} alt="Risultato" style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', borderRadius: 8, background: 'rgba(0,0,0,0.2)' }} />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8, minHeight: 200 }}>
                {loading ? 'Elaborazione in corso...' : 'Premi "Applica enhance" per generare il risultato'}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0, gap: 10 }}>
          {(error || saveError) && <span style={{ fontSize: 12, color: '#ef4444', flex: 1 }}>{error || saveError}</span>}
          <button onClick={onClose} disabled={saving} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            Annulla
          </button>
          <button
            onClick={() => setShowFolderPicker(true)}
            disabled={!resultUrl || saving}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, opacity: !resultUrl ? 0.5 : 1 }}
          >
            Salva come...
          </button>
          <button
            onClick={handleSaveOverwrite}
            disabled={!resultUrl || saving}
            style={{ padding: '6px 18px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, opacity: !resultUrl ? 0.5 : 1 }}
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>

      {showFolderPicker && (
        <FolderPickerModal
          accessToken={accessToken}
          title="Salva come in..."
          onClose={() => setShowFolderPicker(false)}
          onConfirm={handleSaveAs}
        />
      )}
    </div>
  )
}
