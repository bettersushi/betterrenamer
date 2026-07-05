import { useState } from 'react'

export default function UserMenu({ email, avatarUrl, onLogout }) {
  const [open, setOpen] = useState(false)
  const [imgError, setImgError] = useState(false)
  const initial = (email || '?')[0].toUpperCase()
  const showImg = avatarUrl && !imgError

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title={email}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: '50%', border: 'none', padding: 0,
          overflow: 'hidden',
          background: showImg ? 'transparent' : 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        {showImg
          ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initial}
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200,
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
            AUTENTICATO COME
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email}
          </div>
          <button
            onClick={onLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none',
              border: '1px solid var(--border)', borderRadius: 7, padding: '6px 8px',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              color: 'var(--danger, #dc2626)', marginTop: 2,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
