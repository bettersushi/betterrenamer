import { useState, useCallback } from 'react'
import VideoTrimCrop from './VideoTrimCrop'
import { useFFmpeg } from '../hooks/useFFmpeg'
import { fetchFile } from '@ffmpeg/util'
import { updateFileContent } from '../drive'

function rotationFilter(rotation) {
  if (rotation === 90) return 'transpose=1'
  if (rotation === 180) return 'transpose=1,transpose=1'
  if (rotation === 270) return 'transpose=2'
  return ''
}

export default function VideoEditModal({ file, auth, onClose, onSaved }) {
  const [clip, setClip] = useState({ file, trim: null, crop: null, rotation: 0 })
  const { ffmpeg, loaded, load } = useFFmpeg()
  const [status, setStatus] = useState('idle') // idle | processing | error
  const [errorMsg, setErrorMsg] = useState('')

  const handleSave = useCallback(async () => {
    setStatus('processing')
    setErrorMsg('')
    try {
      let ff = ffmpeg
      if (!loaded) ff = await load()
      if (!ff) throw new Error('FFmpeg non disponibile')

      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      })
      if (!res.ok) throw new Error('Download del video fallito')
      const blob = await res.blob()
      await ff.writeFile('in.mp4', await fetchFile(blob))

      const filters = []
      const { crop, rotation, trim } = clip
      if (crop && crop.w > 4 && crop.h > 4) {
        const scaleX = file.videoMediaMetadata?.width ? file.videoMediaMetadata.width / crop.vw : 1
        const scaleY = file.videoMediaMetadata?.height ? file.videoMediaMetadata.height / crop.vh : 1
        const rawCx = Math.round(crop.x * scaleX)
        const rawCy = Math.round(crop.y * scaleY)
        const rawCw = Math.round(crop.w * scaleX)
        const rawCh = Math.round(crop.h * scaleY)
        const vidW = file.videoMediaMetadata?.width ?? rawCw
        const vidH = file.videoMediaMetadata?.height ?? rawCh
        const cx = Math.max(0, Math.min(rawCx, vidW - 2))
        const cy = Math.max(0, Math.min(rawCy, vidH - 2))
        const cw = Math.max(2, Math.min(rawCw, vidW - cx))
        const ch = Math.max(2, Math.min(rawCh, vidH - cy))
        filters.push(`crop=${cw}:${ch}:${cx}:${cy}`)
      }
      const rf = rotationFilter(rotation)
      if (rf) filters.push(rf)

      const args = ['-y']
      if (trim) { args.push('-ss', String(trim.start), '-to', String(trim.end)) }
      args.push('-i', 'in.mp4')
      if (filters.length) args.push('-vf', filters.join(','))
      args.push('-c:v', 'libx264', '-crf', '20', '-preset', 'fast', '-c:a', 'aac', 'out.mp4')
      await ff.exec(args)

      const data = await ff.readFile('out.mp4')
      const outBlob = new Blob([data], { type: 'video/mp4' })
      await updateFileContent(auth.accessToken, file.id, outBlob, 'video/mp4')

      try { await ff.deleteFile('in.mp4') } catch {}
      try { await ff.deleteFile('out.mp4') } catch {}

      setStatus('idle')
      onSaved?.()
      onClose()
    } catch (e) {
      console.error(e)
      setErrorMsg(e.message || 'Errore durante l\'elaborazione')
      setStatus('error')
    }
  }, [ffmpeg, loaded, load, clip, file, auth.accessToken, onSaved, onClose])

  const hasEdits = !!(clip.crop && clip.crop.w > 4 && clip.crop.h > 4) || !!clip.rotation

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && status !== 'processing') onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '18px 20px', width: 640, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Modifica video</div>
          <button onClick={onClose} disabled={status === 'processing'} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: status === 'processing' ? 'default' : 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <VideoTrimCrop clip={clip} auth={auth} onChange={setClip} />

        {errorMsg && <div style={{ marginTop: 10, fontSize: 12, color: '#ef4444' }}>{errorMsg}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} disabled={status === 'processing'} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: status === 'processing' ? 'default' : 'pointer', fontFamily: 'inherit' }}>Annulla</button>
          <button
            onClick={handleSave}
            disabled={status === 'processing' || !hasEdits}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 600, cursor: (status === 'processing' || !hasEdits) ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (status === 'processing' || !hasEdits) ? 0.6 : 1 }}
          >
            {status === 'processing' ? 'Elaborazione...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}
