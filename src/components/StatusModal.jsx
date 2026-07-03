import { useState, useEffect } from 'react'

const IClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const ICheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IWarn = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const ISpin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
)

function Badge({ ok, loading, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: loading ? 'var(--surface-2)' : ok ? 'rgba(74,158,110,0.15)' : 'rgba(239,68,68,0.15)',
      color: loading ? 'var(--text-muted)' : ok ? '#4a9e6e' : '#ef4444',
      animation: loading ? 'spin 1s linear infinite' : 'none',
    }}>
      {loading ? <ISpin /> : ok ? <ICheck /> : <IWarn />}
      {children}
    </span>
  )
}

function Row({ label, value, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right' }}>
        {badge !== undefined ? badge : value}
      </span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  )
}

function formatBytes(b) {
  b = Number(b)
  if (b >= 1e12) return `${(b/1e12).toFixed(2)} TB`
  if (b >= 1e9)  return `${(b/1e9).toFixed(1)} GB`
  return `${(b/1e6).toFixed(0)} MB`
}

export default function StatusModal({ auth, onClose }) {
  const [driveStatus, setDriveStatus] = useState({ loading: true })

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await fetch(
          'https://www.googleapis.com/drive/v3/about?fields=storageQuota,user',
          { headers: { Authorization: `Bearer ${auth.accessToken}` } }
        )
        if (cancelled) return
        if (!res.ok) {
          setDriveStatus({ loading: false, ok: false, error: `HTTP ${res.status}` })
          return
        }
        const data = await res.json()
        setDriveStatus({
          loading: false, ok: true,
          user: data.user?.displayName || auth.email,
          usageInDrive: data.storageQuota?.usageInDrive,
          usage: data.storageQuota?.usage,
          limit: data.storageQuota?.limit,
        })
      } catch (e) {
        if (!cancelled) setDriveStatus({ loading: false, ok: false, error: e.message })
      }
    }
    check()
    return () => { cancelled = true }
  }, [auth.accessToken])

  const quotaPct = driveStatus.limit && driveStatus.usage
    ? Math.round((Number(driveStatus.usage) / Number(driveStatus.limit)) * 100)
    : null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: '22px 24px',
        width: 420, maxWidth: '94vw', maxHeight: '86vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)', border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Stato sistema</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>BetterRenamer · BetterSearch</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><IClose /></button>
        </div>

        {/* Drive API */}
        <Section title="Google Drive API">
          <Row label="Token OAuth" badge={
            <Badge ok={true} loading={false}>Valido</Badge>
          } />
          <Row label="Account" value={driveStatus.user || auth.email} />
          <Row label="Connessione API" badge={
            driveStatus.loading
              ? <Badge loading>Test in corso…</Badge>
              : driveStatus.ok
                ? <Badge ok>Connessa</Badge>
                : <Badge ok={false}>{driveStatus.error}</Badge>
          } />
          {driveStatus.ok && driveStatus.usage && (
            <Row label="Storage usato" value={
              driveStatus.limit
                ? `${formatBytes(driveStatus.usage)} / ${formatBytes(driveStatus.limit)} (${quotaPct}%)`
                : formatBytes(driveStatus.usage)
            } />
          )}
          {driveStatus.ok && driveStatus.usageInDrive && (
            <Row label="Di cui su Drive" value={formatBytes(driveStatus.usageInDrive)} />
          )}
        </Section>

        {/* App */}
        <Section title="Applicazione">
          <Row label="Versione" value="2.0 (luglio 2025)" />
          <Row label="Stack" value="React 18 · Vite 5 · Vercel" />
          <Row label="Linee di codice" value="~8 300 (src/)" />
          <Row label="Moduli" value="32 file (jsx/js/css)" />
          <Row label="Funzionalità" value="Rename · Search · Montaggio video · Crop" />
          <Row label="Storage locale" value="OAuth token · Tema · Schema colore · Cache pHash" />
        </Section>

        {/* FFmpeg */}
        <Section title="FFmpeg / Processing">
          <Row label="Libreria" value="@ffmpeg/ffmpeg 0.12 (WASM)" />
          <Row label="Core" value="@ffmpeg/core 0.12.6 · single-thread" />
          <Row label="File WASM" value="~31 MB (serviti da /public/)" />
          <Row label="SharedArrayBuffer" badge={<Badge ok>Abilitato (COOP/COEP)</Badge>} />
          <Row label="Video proxy" value="Vercel function /api/proxy-video" />
          <Row label="Formati export" value="MP4 H.264 · 480p / 720p / 1080p" />
        </Section>

        {/* Security */}
        <Section title="Sicurezza">
          <Row label="Token storage" value="localStorage (session only)" />
          <Row label="Credenziali" value="Non trasmesse a server propri" />
          <Row label="Proxy immagini" value="/api/proxy-image — token lato server" />
          <Row label="CORS headers" value="COOP: same-origin · COEP: credentialless" />
          <Row label="Scopes OAuth" value="drive (read/write), no accesso email" />
          <Row label="Dati utente" value="Zero persistence su backend" />
        </Section>

        {/* Ecosystem */}
        <Section title="Ecosistema">
          <Row label="Drive API" value="v3 · REST · OAuth 2.0 PKCE" />
          <Row label="Thumbnail proxy" value="/api/proxy-image (bypass CORS)" />
          <Row label="Upload Drive" value="Multipart · drive/v3/files?uploadType=multipart" />
          <Row label="Ricerca globale" value="fullText contains · Drive search" />
          <Row label="pHash similarity" value="Hamming distance ≤ 22 · canvas" />
          <Row label="Hosting" value="Vercel Edge Network" />
        </Section>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
