import { useEffect, useRef, useState } from 'react'

const IconWandSmall = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4V2m0 18v-2M8 12H2m18 0h-2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const ITEMS = [
  { key: 'renamer', label: 'Better Renamer', desc: 'Rename batch a pattern con spostamento media' },
  { key: 'batch', label: 'Better Batch', desc: 'Operazioni batch (ex "Operazioni batch")' },
  { key: 'rules', label: 'Better Rules', desc: 'Regole automatiche di rename (ex "Regole")' },
]

// Pulsante header "macro funzioni": apre una tendina con le tre funzioni
// batch (Better Renamer / Better Batch / Better Rules), a corredo della
// ricerca Drive. Allineato a sinistra del toggle tema in SearchPage.
export default function MacroToolsMenu({ onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-secondary"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0 }}
        title="Macro funzioni"
      >
        <IconWandSmall />
      </button>
      {open && (
        <div style={dropdown}>
          {ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => { setOpen(false); onSelect(item.key) }}
              style={dropdownItem}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--border) 50%, transparent)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const dropdown = {
  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 4500,
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
  boxShadow: '0 12px 32px rgba(0,0,0,0.18)', padding: 6, minWidth: 220,
}
const dropdownItem = {
  display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
  cursor: 'pointer', padding: '8px 10px', borderRadius: 7, fontFamily: 'inherit',
}
