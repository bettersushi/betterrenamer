import { useState } from 'react'

const IColor = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/>
    <circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/>
    <path d="M12 22c-4.4 0-8-2.5-8-7 0-3.6 2.3-6.5 5-8.5"/>
    <path d="M14.5 21.5c1.5-1 3.5-3 3.5-6 0-1-.5-2-1-2.5"/>
  </svg>
)

const IText = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
)

const IClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const ACTIVITIES = [
  {
    id: 'colorVidFolders',
    icon: IColor,
    title: 'Colora cartelle Vid/Gif',
    description: 'Applica il colore della cartella genitore a tutte le sottocartelle * Vid e * Gif create dalla funzione organizza media.',
  },
  {
    id: 'normalizeNames',
    icon: IText,
    title: 'Normalizza nomi file',
    description: 'Converti in minuscolo, sostituisci spazi con trattini e rimuovi caratteri speciali (mantenendo estensione e trattini esistenti).',
  },
]

export default function BatchOpsModal({ currentFolder, onClose, onAddJob }) {
  const [scopes, setScopes] = useState({ colorVidFolders: 'folder', normalizeNames: 'folder' })
  const [added, setAdded] = useState({})

  const setScope = (id, scope) => setScopes(s => ({ ...s, [id]: scope }))

  const handleAdd = (activity) => {
    const job = {
      id: Date.now() + Math.random(),
      type: activity.id,
      label: activity.title,
      scope: scopes[activity.id],
      folderId: currentFolder?.id || 'root',
      folderName: currentFolder?.name || 'My Drive',
      status: 'queued',
      progress: { current: 0, total: 0, currentFile: '', phase: '' },
      entries: [],
    }
    onAddJob(job)
    setAdded(a => ({ ...a, [activity.id]: true }))
    setTimeout(() => setAdded(a => ({ ...a, [activity.id]: false })), 2000)
  }

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  }
  const modal = {
    background: 'var(--surface)', borderRadius: 16, padding: '20px 22px',
    width: 400, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    border: '1px solid var(--border)',
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4V2m0 18v-2M8 12H2m18 0h-2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Operazioni Batch</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Attività preimpostate eseguite in coda in background</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
            <IClose />
          </button>
        </div>

        {/* Activity cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ACTIVITIES.map(act => {
            const scope = scopes[act.id]
            const isFolder = scope === 'folder'
            const isAdded = added[act.id]
            const noFolder = isFolder && !currentFolder
            return (
              <div key={act.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'color-mix(in srgb, var(--border) 25%, transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: 'color-mix(in srgb, var(--primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}>
                    <act.icon />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{act.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{act.description}</div>
                  </div>
                </div>

                {/* Scope toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['folder', 'drive'].map(s => (
                      <button
                        key={s}
                        onClick={() => setScope(act.id, s)}
                        style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                          background: scope === s ? 'var(--primary)' : 'transparent',
                          color: scope === s ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${scope === s ? 'var(--primary)' : 'var(--border)'}`,
                          transition: 'all 0.12s',
                        }}
                      >
                        {s === 'folder' ? (currentFolder ? currentFolder.name : 'Cartella corrente') : 'Tutto Drive'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handleAdd(act)}
                    disabled={noFolder}
                    style={{
                      fontSize: 11.5, padding: '4px 12px', borderRadius: 7, cursor: noFolder ? 'not-allowed' : 'pointer',
                      background: isAdded ? '#22c55e' : 'var(--primary)', color: '#fff',
                      border: 'none', fontFamily: 'inherit', fontWeight: 600,
                      opacity: noFolder ? 0.4 : 1, transition: 'background 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isAdded ? '✓ Aggiunto' : '+ Aggiungi alla coda'}
                  </button>
                </div>
                {noFolder && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 5 }}>Seleziona una cartella nella sidebar per usare lo scope cartella</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
