import { useVideoMontage } from '../context/VideoMontageContext'

export default function VideoMontageJobPanel() {
  const { job, setQuality, startExport, saveToDrive, ffmpegProgress } = useVideoMontage()

  if (!job) return null
  const { clips, quality, status, currentClip, errorMsg, outputUrl, saveStatus, folderName } = job
  const displayProgress = ffmpegProgress

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
              disabled={status !== 'idle'}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: `1px solid ${quality === q ? 'var(--primary)' : 'var(--border)'}`,
                background: quality === q ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                color: quality === q ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: status !== 'idle' ? 'default' : 'pointer', fontFamily: 'inherit',
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
            <div className="vmm-progress-fill" style={{ width: `${Math.round(displayProgress * 100)}%` }} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>✓ Montaggio completato</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a
              href={outputUrl}
              download={`00_${(folderName || 'reel').replace(/\s+/g, '-').toLowerCase()}-reel.mp4`}
              style={{ padding: '9px 20px', borderRadius: 9, background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              ⬇ Scarica MP4
            </a>
            <button
              onClick={saveToDrive}
              disabled={saveStatus === 'saving' || saveStatus === 'saved'}
              style={{
                padding: '9px 20px', borderRadius: 9, border: '1px solid var(--border)',
                background: saveStatus === 'saved' ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                color: saveStatus === 'saved' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: 13, cursor: saveStatus === 'saving' || saveStatus === 'saved' ? 'default' : 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7,
              }}
            >
              {saveStatus === 'saving' ? '⏳ Salvataggio...' : saveStatus === 'saved' ? '✓ Salvato su Drive' : saveStatus === 'error' ? '✕ Errore salvataggio' : '☁ Salva su Drive'}
            </button>
          </div>
          {saveStatus === 'saved' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Salvato come <code style={{ background: 'var(--surface-2,var(--border))', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>
                00_{(folderName || 'reel').replace(/\s+/g, '-').toLowerCase()}-reel.mp4
              </code> nella cartella corrente
            </div>
          )}
        </div>
      )}

      {/* Action button */}
      {(status === 'idle' || status === 'error') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={startExport}
            style={{ padding: '9px 24px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}
          >
            🎬 Genera montaggio
          </button>
        </div>
      )}
    </div>
  )
}
