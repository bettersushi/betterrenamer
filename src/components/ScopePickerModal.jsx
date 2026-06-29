import { useEffect, useState } from 'react'
import { getFolderAncestors } from '../drive'

export default function ScopePickerModal({ photo, accessToken, onConfirm, onClose }) {
  const [ancestors, setAncestors] = useState([]) // [immediate, grandparent, ...]
  const [counts, setCounts] = useState({})       // folderId → file count estimate
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [counting, setCounting] = useState(false)

  useEffect(() => {
    if (!photo.parents?.[0]) { setLoading(false); return }
    getFolderAncestors(accessToken, photo.parents[0], 5).then(list => {
      setAncestors(list)
      setSelected(list[0]?.id ?? null)
      setLoading(false)
      // fetch counts one by one without blocking UI
      list.forEach(({ id }) => {
        estimateCount(accessToken, id).then(n => {
          setCounts(c => ({ ...c, [id]: n }))
        })
      })
    }).catch(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          {photo.thumbnailLink && (
            <img src={photo.thumbnailLink} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Cerca simili per scope</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{photo.name}</div>
          </div>
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Carico gerarchia cartelle...</div>
        ) : ancestors.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Impossibile risalire la gerarchia.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {ancestors.map(({ id, name }, i) => {
              const count = counts[id]
              const label = i === 0 ? 'Cartella diretta' : i === 1 ? '1 livello su' : `${i} livelli su`
              return (
                <label key={id} style={row(selected === id)} onClick={() => setSelected(id)}>
                  <input
                    type="radio"
                    name="scope"
                    value={id}
                    checked={selected === id}
                    onChange={() => setSelected(id)}
                    style={{ accentColor: 'var(--primary)', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: selected === id ? 600 : 400, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📁 {name}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {count == null ? '...' : `~${count}+ file media`}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Annulla</button>
          <button
            onClick={() => {
              const scope = ancestors.find(a => a.id === selected)
              if (scope) onConfirm(scope)
            }}
            disabled={!selected || loading}
            style={{ ...btnPrimary, opacity: !selected || loading ? 0.5 : 1 }}
          >
            Cerca in questa cartella
          </button>
        </div>
      </div>
    </div>
  )
}

async function estimateCount(accessToken, folderId) {
  try {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,mimeType)',
      pageSize: 1000,
    })
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    const files = data.files || []
    const mediaCount = files.filter(f => f.mimeType?.includes('image') || f.mimeType?.includes('video')).length
    const folderCount = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder').length
    return mediaCount + folderCount * 5 // rough estimate for subfolders
  } catch {
    return null
  }
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(4px)',
}
const modal = {
  background: 'var(--surface)', borderRadius: 14, padding: '20px 22px',
  width: 360, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  border: '1px solid var(--border)',
}
const row = (active) => ({
  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
  borderRadius: 8, cursor: 'pointer',
  background: active ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
  border: `1px solid ${active ? 'color-mix(in srgb, var(--primary) 25%, transparent)' : 'transparent'}`,
  transition: 'background 0.12s',
})
const btnPrimary = {
  padding: '7px 16px', borderRadius: 8, border: 'none',
  background: 'var(--primary)', color: 'white', fontSize: 13,
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}
const btnSecondary = {
  padding: '7px 16px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
}
