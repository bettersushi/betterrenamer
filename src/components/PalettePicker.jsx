import { useState } from 'react'

export const SCHEME_DOTS = { blue: '#7c6fcd', red: '#b85c8a', green: '#4a9e6e' }
const SCHEME_LABELS = { blue: 'Blu-viola', red: 'Rosso-viola', green: 'Verde' }

export default function PalettePicker({ colorScheme, onChangeScheme, isDark }) {
  const [open, setOpen] = useState(false)
  const current = SCHEME_DOTS[colorScheme]
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn-secondary"
        onClick={() => setOpen(v => !v)}
        title="Combinazione colori"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0 }}
      >
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: current, display: 'block', boxShadow: '0 0 0 1.5px rgba(128,128,128,0.3)' }} />
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140,
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 2 }}>
            {isDark ? 'DARK' : 'LIGHT'}
          </div>
          {Object.entries(SCHEME_DOTS).map(([key, color]) => (
            <button key={key} onClick={() => { onChangeScheme(key); setOpen(false) }} style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
              cursor: 'pointer', padding: '3px 4px', borderRadius: 7, fontFamily: 'inherit',
              color: colorScheme === key ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: colorScheme === key ? 700 : 400, fontSize: 12,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', background: color, flexShrink: 0,
                boxShadow: colorScheme === key
                  ? `0 0 0 2px var(--surface), 0 0 0 3.5px ${color}`
                  : '0 0 0 1.5px rgba(128,128,128,0.25)',
              }} />
              {SCHEME_LABELS[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
