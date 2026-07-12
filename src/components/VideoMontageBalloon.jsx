import { useVideoMontage } from '../context/VideoMontageContext'
import VideoMontageJobPanel from './VideoMontageJobPanel'

export default function VideoMontageBalloon() {
  const { job, wizardOpen, expanded, toggleExpanded, dismiss, ffmpegProgress } = useVideoMontage()

  // Don't show while the full wizard modal is open (job is already visible there)
  if (!job || wizardOpen) return null

  const statusLabel = {
    idle: 'Pronto',
    loading: 'Caricamento FFmpeg…',
    processing: `Elaborazione clip ${job.currentClip}/${job.clips.length}…`,
    done: '✓ Montaggio completato',
    error: '✕ Errore',
  }[job.status]

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 6000 }}>
      {expanded ? (
        <div style={{ width: 380, maxHeight: '70vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.35)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 13, flex: 1, color: 'var(--text-primary)' }}>🎬 Monta video</span>
            <button onClick={toggleExpanded} title="Minimizza" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>—</button>
            {(job.status === 'done' || job.status === 'error') && (
              <button onClick={dismiss} title="Chiudi" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
            )}
          </div>
          <VideoMontageJobPanel />
        </div>
      ) : (
        <button
          onClick={toggleExpanded}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 999,
            background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit',
          }}
        >
          <span>🎬</span>
          <span style={{ fontWeight: 600 }}>{statusLabel}</span>
          {(job.status === 'loading' || job.status === 'processing') && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(ffmpegProgress * 100)}%</span>
          )}
        </button>
      )}
    </div>
  )
}
