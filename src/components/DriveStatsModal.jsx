import { useState, useEffect, useRef } from 'react'
import { listFilesRecursive } from '../drive'

const VIDEO_EXT = new Set(['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.bmp', '.tiff', '.tif'])

function getExt(name) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function computeStats(files) {
  const s = { total: 0, images: 0, videos: 0, gifs: 0, other: 0, totalSize: 0 }
  for (const f of files) {
    s.total++
    s.totalSize += Number(f.size) || 0
    const ext = getExt(f.name)
    const mime = f.mimeType || ''
    if (mime.includes('video') || VIDEO_EXT.has(ext)) s.videos++
    else if (ext === '.gif') s.gifs++
    else if (mime.includes('image') || IMAGE_EXT.has(ext)) s.images++
    else s.other++
  }
  return s
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export default function DriveStatsModal({ folderName, folderId, currentFiles, accessToken, onClose }) {
  const [scope, setScope] = useState('current') // 'current' | 'recursive'
  const [stats, setStats] = useState(() => computeStats(currentFiles))
  const [folderCount, setFolderCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ folder: '', files: 0 })
  const abortRef = useRef(false)

  useEffect(() => {
    if (scope === 'current') {
      setStats(computeStats(currentFiles))
      setFolderCount(0)
      setLoading(false)
    } else {
      runRecursive()
    }
    return () => { abortRef.current = true }
  }, [scope]) // eslint-disable-line react-hooks/exhaustive-deps

  const runRecursive = async () => {
    abortRef.current = false
    setLoading(true)
    setProgress({ folder: folderName, files: 0 })
    try {
      const folders = await listFilesRecursive(
        accessToken, folderId, folderName, true,
        (currentFolder, totalFiles) => {
          if (abortRef.current) return
          setProgress({ folder: currentFolder, files: totalFiles })
        }
      )
      if (abortRef.current) return
      const allFiles = folders.flatMap(f => f.files)
      setStats(computeStats(allFiles))
      setFolderCount(folders.length)
    } catch (e) {
      console.error('Stats error:', e)
    } finally {
      if (!abortRef.current) setLoading(false)
    }
  }

  const handleScopeChange = (s) => {
    abortRef.current = true
    setScope(s)
  }

  const handleCancel = () => {
    abortRef.current = true
    setScope('current')
    setStats(computeStats(currentFiles))
    setFolderCount(0)
    setLoading(false)
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Statistiche cartella</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📁 {folderName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>✕</button>
        </div>

        {/* Scope selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {[['current', 'Solo questa cartella'], ['recursive', 'Includi sottocartelle']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => handleScopeChange(val)}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                border: `1px solid ${scope === val ? 'var(--primary)' : 'var(--border)'}`,
                background: scope === val ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
                color: scope === val ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
              }}
            >{label}</button>
          ))}
        </div>

        {/* Progress */}
        {loading && (
          <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'color-mix(in srgb, var(--border) 40%, transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <svg style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Scansione in corso...</span>
              <button onClick={handleCancel} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--primary)', padding: 0, fontFamily: 'inherit' }}>Annulla</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📁 {progress.folder}
            </div>
            <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 2 }}>{progress.files} file trovati</div>
          </div>
        )}

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <StatCard label="File totali" value={stats.total} icon="📄" accent="var(--primary)" />
          <StatCard label="Peso totale" value={formatSize(stats.totalSize)} icon="💾" accent="#8b5cf6" />
          <StatCard label="Immagini" value={stats.images} icon="🖼️" accent="#3b82f6" />
          <StatCard label="Video" value={stats.videos} icon="🎬" accent="#ef4444" />
          <StatCard label="GIF" value={stats.gifs} icon="✨" accent="#f59e0b" />
          <StatCard label="Altri" value={stats.other} icon="📎" accent="#6b7280" />
        </div>

        {scope === 'recursive' && !loading && folderCount > 0 && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {folderCount} cartell{folderCount === 1 ? 'a' : 'e'} analizzat{folderCount === 1 ? 'a' : 'e'}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: 'color-mix(in srgb, var(--border) 30%, transparent)',
      border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(4px)',
}
const modal = {
  background: 'var(--surface)', borderRadius: 16, padding: '20px 22px',
  width: 360, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  border: '1px solid var(--border)',
}
