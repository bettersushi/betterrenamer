import { useState, useEffect } from 'react'

const IColor = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/>
    <circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/>
    <path d="M12 22c-4.4 0-8-2.5-8-7 0-3.6 2.3-6.5 5-8.5"/>
    <path d="M14.5 21.5c1.5-1 3.5-3 3.5-6 0-1-.5-2-1-2.5"/>
  </svg>
)

const IText = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
)

const IClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const FALLBACK_COLORS = [
  '#ac725e', '#d06b64', '#f83a22', '#ff7537', '#ffad46',
  '#16a765', '#7bd148', '#42d692', '#4986e7', '#9a9cff',
  '#b99aff', '#cd74e6',
]

const DEFAULT_RULES = [
  { keyword: 'Vid', color: '#4986e7' },
  { keyword: 'Gif', color: '#ff7537' },
]

const SIMPLE_ACTIVITIES = [
  {
    id: 'colorAllSubfolders',
    icon: IColor,
    title: 'Colora tutte le sottocartelle',
    description: 'Propaga il colore di ogni cartella a tutte le sue sottocartelle ricorsivamente.',
  },
  {
    id: 'normalizeNames',
    icon: IText,
    title: 'Normalizza nomi file',
    description: 'Lowercase + trattini, rimuove caratteri speciali dai nomi file.',
  },
]

function ScopeToggle({ id, scope, setScope, currentFolder }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {['folder', 'drive'].map(s => (
        <button
          key={s}
          onClick={() => setScope(id, s)}
          style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
            background: scope === s ? 'var(--primary)' : 'transparent',
            color: scope === s ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${scope === s ? 'var(--primary)' : 'var(--border)'}`,
            transition: 'all 0.12s', whiteSpace: 'nowrap',
          }}
        >
          {s === 'folder' ? (currentFolder ? currentFolder.name : 'Cartella corrente') : 'Tutto Drive'}
        </button>
      ))}
    </div>
  )
}

function AddButton({ onClick, disabled, added }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 11.5, padding: '4px 12px', borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer',
        background: added ? '#22c55e' : 'var(--primary)', color: '#fff',
        border: 'none', fontFamily: 'inherit', fontWeight: 600,
        opacity: disabled ? 0.4 : 1, transition: 'background 0.2s', whiteSpace: 'nowrap',
      }}
    >
      {added ? '✓ Aggiunto' : '+ Aggiungi alla coda'}
    </button>
  )
}

export default function BatchOpsModal({ currentFolder, onClose, onAddJob, accessToken }) {
  const [scopes, setScopes] = useState({ colorByKeyword: 'folder', colorAllSubfolders: 'folder', normalizeNames: 'folder' })
  const [added, setAdded] = useState({})
  const [kwRules, setKwRules] = useState(DEFAULT_RULES)
  const [palette, setPalette] = useState(FALLBACK_COLORS)

  useEffect(() => {
    if (!accessToken) return
    fetch('https://www.googleapis.com/drive/v3/about?fields=folderColorPalette', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(data => { if (data.folderColorPalette?.length) setPalette(data.folderColorPalette) })
      .catch(() => {})
  }, [accessToken])

  const setScope = (id, scope) => setScopes(s => ({ ...s, [id]: scope }))

  const markAdded = (id) => {
    setAdded(a => ({ ...a, [id]: true }))
    setTimeout(() => setAdded(a => ({ ...a, [id]: false })), 2000)
  }

  const handleAddSimple = (act) => {
    const isFolder = scopes[act.id] === 'folder'
    if (isFolder && !currentFolder) return
    onAddJob({
      id: Date.now() + Math.random(),
      type: act.id,
      label: act.title,
      scope: scopes[act.id],
      folderId: currentFolder?.id || 'root',
      folderName: currentFolder?.name || 'My Drive',
      status: 'queued',
      progress: { current: 0, total: 0, currentFile: '', phase: '' },
      entries: [],
    })
    markAdded(act.id)
  }

  const handleAddKw = () => {
    const isFolder = scopes.colorByKeyword === 'folder'
    if (isFolder && !currentFolder) return
    if (kwRules.length === 0 || kwRules.every(r => !r.keyword.trim())) return
    onAddJob({
      id: Date.now() + Math.random(),
      type: 'colorByKeyword',
      label: 'Colora per parola chiave',
      rules: kwRules.filter(r => r.keyword.trim()),
      scope: scopes.colorByKeyword,
      folderId: currentFolder?.id || 'root',
      folderName: currentFolder?.name || 'My Drive',
      status: 'queued',
      progress: { current: 0, total: 0, currentFile: '', phase: '' },
      entries: [],
    })
    markAdded('colorByKeyword')
  }

  const updateRule = (i, patch) => setKwRules(rules => rules.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const removeRule = (i) => setKwRules(rules => rules.filter((_, idx) => idx !== i))
  const addRule = () => setKwRules(rules => [...rules, { keyword: '', color: DRIVE_COLORS[0] }])

  const cardStyle = { border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', background: 'color-mix(in srgb, var(--border) 25%, transparent)' }
  const iconBox = { width: 28, height: 28, borderRadius: 7, background: 'color-mix(in srgb, var(--primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '20px 22px', width: '92vw', maxWidth: 1024, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Colora per parola chiave — card espansa */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={iconBox}><IColor /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Colora per parola chiave</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Assegna un colore alle cartelle il cui nome contiene la parola chiave.</div>
              </div>
            </div>

            {/* Regole */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {kwRules.map((rule, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    value={rule.keyword}
                    onChange={e => updateRule(i, { keyword: e.target.value })}
                    placeholder="parola chiave"
                    style={{ width: 110, fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {palette.map(c => (
                      <button
                        key={c}
                        onClick={() => updateRule(i, { color: c })}
                        title={c}
                        style={{
                          width: 16, height: 16, borderRadius: '50%', background: c, padding: 0, cursor: 'pointer',
                          border: rule.color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                          outline: rule.color === c ? '1px solid var(--surface)' : 'none',
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => removeRule(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, borderRadius: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <IClose />
                  </button>
                </div>
              ))}
              <button
                onClick={addRule}
                style={{ alignSelf: 'flex-start', fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                + Aggiungi regola
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <ScopeToggle id="colorByKeyword" scope={scopes.colorByKeyword} setScope={setScope} currentFolder={currentFolder} />
              <AddButton onClick={handleAddKw} disabled={scopes.colorByKeyword === 'folder' && !currentFolder} added={added.colorByKeyword} />
            </div>
          </div>

          {/* Attività semplici */}
          {SIMPLE_ACTIVITIES.map(act => {
            const scope = scopes[act.id]
            const noFolder = scope === 'folder' && !currentFolder
            return (
              <div key={act.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={iconBox}><act.icon /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginRight: 8 }}>{act.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{act.description}</span>
                  </div>
                  <ScopeToggle id={act.id} scope={scope} setScope={setScope} currentFolder={currentFolder} />
                  <AddButton onClick={() => handleAddSimple(act)} disabled={noFolder} added={added[act.id]} />
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
