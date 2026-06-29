import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import logoSrc from '../assets/logo-br.svg'
import { listFiles } from '../drive'
import QuickLookModal from '../components/QuickLookModal'
import './SearchPage.css'

const MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp', '.tiff', '.tif', '.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])
const SEARCH_QUERIES_KEY = 'betterrenamer_search_queries'
const THUMB_SIZES = { sm: 72, md: 120, lg: 200, masonry: 0 }
const GRID_MODES = [
  { key: 'sm', icon: IconGridSm, label: 'Piccolo' },
  { key: 'md', icon: IconGridMd, label: 'Medio' },
  { key: 'lg', icon: IconGridLg, label: 'Grande' },
  { key: 'masonry', icon: IconMasonry, label: 'Proporzioni originali' },
]

function getExt(name) {
  return name.includes('.') ? name.substring(name.lastIndexOf('.')).toLowerCase() : ''
}
function isMediaFile(f) {
  if (f.mimeType === 'application/vnd.google-apps.shortcut') return false
  const ext = getExt(f.name)
  if (MEDIA_EXTENSIONS.has(ext)) return true
  if (f.mimeType && ['image/', 'video/'].some(m => f.mimeType.startsWith(m))) return true
  return false
}
function isVideoFile(f) {
  if (f.mimeType && f.mimeType.includes('video')) return true
  return VIDEO_EXTENSIONS.has(getExt(f.name))
}

async function computePHash(imgUrl) {
  const proxied = `/api/proxy-image?url=${encodeURIComponent(imgUrl)}`
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 8; canvas.height = 8
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 8, 8)
        const data = ctx.getImageData(0, 0, 8, 8).data
        const grays = []
        for (let i = 0; i < 64; i++) grays.push((data[i*4] + data[i*4+1] + data[i*4+2]) / 3)
        const avg = grays.reduce((a, b) => a + b) / 64
        resolve(grays.map(g => g >= avg ? 1 : 0))
      } catch (e) { reject(e) }
    }
    img.onerror = reject
    img.src = proxied
  })
}
function hammingDistance(a, b) {
  return a.reduce((d, v, i) => d + (v !== b[i] ? 1 : 0), 0)
}

const IconFolder = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
  </svg>
)
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconEye = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconSimilar = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="4"/><circle cx="17" cy="15" r="4"/>
    <path d="M13 9h5M17 5v8"/>
  </svg>
)
const IconX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconGridSm = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="2" width="4" height="4" rx="0.5"/><rect x="8" y="2" width="4" height="4" rx="0.5"/><rect x="14" y="2" width="4" height="4" rx="0.5"/><rect x="20" y="2" width="2" height="4" rx="0.5"/>
    <rect x="2" y="8" width="4" height="4" rx="0.5"/><rect x="8" y="8" width="4" height="4" rx="0.5"/><rect x="14" y="8" width="4" height="4" rx="0.5"/><rect x="20" y="8" width="2" height="4" rx="0.5"/>
    <rect x="2" y="14" width="4" height="4" rx="0.5"/><rect x="8" y="14" width="4" height="4" rx="0.5"/><rect x="14" y="14" width="4" height="4" rx="0.5"/><rect x="20" y="14" width="2" height="4" rx="0.5"/>
  </svg>
)
const IconGridMd = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="2" width="9" height="9" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/>
    <rect x="2" y="13" width="9" height="9" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/>
  </svg>
)
const IconGridLg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="2" width="20" height="20" rx="2"/>
  </svg>
)
const IconMasonry = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="2" width="9" height="13" rx="1"/><rect x="13" y="2" width="9" height="8" rx="1"/>
    <rect x="2" y="17" width="9" height="5" rx="1"/><rect x="13" y="12" width="9" height="10" rx="1"/>
  </svg>
)
const IconChevronLeft = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const IconSun = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)
const IconMoon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

export default function SearchPage({ auth, onLogout, isDark, onToggleTheme }) {
  const navigate = useNavigate()
  const [folderPath, setFolderPath] = useState([{ id: 'root', name: 'My Drive' }])
  const [folders, setFolders] = useState([])
  const [allPhotos, setAllPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [recentQueries, setRecentQueries] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SEARCH_QUERIES_KEY)) || [] } catch { return [] }
  })
  const [similarTo, setSimilarTo] = useState(null)
  const [similarResults, setSimilarResults] = useState([])
  const [similarLoading, setSimilarLoading] = useState(false)
  const [slideshowIdx, setSlideshowIdx] = useState(null)
  const [thumbSize, setThumbSize] = useState('md')
  const pHashCache = useRef({})

  const currentFolder = folderPath[folderPath.length - 1]

  const loadFolder = useCallback(async (folderId) => {
    setLoading(true)
    setSimilarTo(null)
    setSimilarResults([])
    try {
      const data = await listFiles(auth.accessToken, folderId)
      const files = data.files || []
      setFolders(files.filter(f => f.mimeType === 'application/vnd.google-apps.folder'))
      setAllPhotos(files.filter(isMediaFile))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [auth.accessToken])

  useEffect(() => {
    loadFolder(currentFolder.id)
  }, [currentFolder.id])

  const handleFolderClick = (folder) => {
    setFolderPath(p => [...p, folder])
  }
  const handleBack = () => {
    if (folderPath.length > 1) setFolderPath(p => p.slice(0, -1))
  }
  const handleBreadcrumb = (idx) => {
    setFolderPath(p => p.slice(0, idx + 1))
  }

  const handleSearch = (q) => {
    setQuery(q)
    setSimilarTo(null)
    if (q.trim() && !recentQueries.includes(q.trim())) {
      const updated = [q.trim(), ...recentQueries].slice(0, 8)
      setRecentQueries(updated)
      localStorage.setItem(SEARCH_QUERIES_KEY, JSON.stringify(updated))
    }
  }

  const handleSimilarity = useCallback(async (photo) => {
    if (!photo.thumbnailLink) return
    setSimilarLoading(true)
    setSimilarTo(photo)
    setQuery('')
    try {
      if (!pHashCache.current[photo.id]) {
        pHashCache.current[photo.id] = await computePHash(photo.thumbnailLink)
      }
      const refHash = pHashCache.current[photo.id]
      const withDist = []
      for (const p of allPhotos) {
        if (!p.thumbnailLink) continue
        try {
          if (!pHashCache.current[p.id]) {
            pHashCache.current[p.id] = await computePHash(p.thumbnailLink)
          }
          withDist.push({ ...p, _dist: hammingDistance(refHash, pHashCache.current[p.id]) })
        } catch { /* skip if crossOrigin fails */ }
      }
      withDist.sort((a, b) => a._dist - b._dist)
      setSimilarResults(withDist.filter(p => p._dist <= 12))
    } catch (e) {
      alert('Similarità non disponibile: ' + e.message)
      setSimilarTo(null)
    } finally {
      setSimilarLoading(false)
    }
  }, [allPhotos])

  const results = useMemo(() => {
    let list = similarTo ? similarResults : allPhotos
    if (query) list = list.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
    return list
  }, [allPhotos, query, similarTo, similarResults])

  return (
    <div className="search-page-bg">
      {/* Header */}
      <div className="header" style={{ padding: '10px 20px', flexShrink: 0, marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/')} className="nav-icon-btn" title="Torna al rename">
            <IconChevronLeft />
          </button>
          <img src={logoSrc} alt="" style={{ height: '20px', width: 'auto' }} />
          <span style={{ fontSize: '15px', fontWeight: 600 }}>Ricerca foto</span>
        </div>
        <div className="header-actions">
          <button onClick={onToggleTheme} className="nav-icon-btn" title="Tema">
            {isDark ? <IconSun /> : <IconMoon />}
          </button>
          <button onClick={onLogout} className="btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>Logout</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div className="search-sidebar">
          {/* Breadcrumb */}
          {folderPath.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <button onClick={handleBack} className="nav-icon-btn" style={{ width: 20, height: 20 }}>
                <IconChevronLeft />
              </button>
              {folderPath.map((f, i) => (
                <span key={f.id} style={{ fontSize: '10px', color: 'var(--text-muted)', cursor: i < folderPath.length - 1 ? 'pointer' : 'default', fontWeight: i === folderPath.length - 1 ? 600 : 400 }}
                  onClick={() => i < folderPath.length - 1 && handleBreadcrumb(i)}>
                  {i > 0 && <span style={{ marginRight: '2px' }}>/</span>}{f.name}
                </span>
              ))}
            </div>
          )}

          {/* Folder list */}
          {folders.map(f => (
            <div key={f.id} className="search-folder-item" onClick={() => handleFolderClick(f)}>
              <IconFolder /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
            </div>
          ))}

          {folders.length === 0 && !loading && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px', textAlign: 'center' }}>Nessuna sottocartella</div>
          )}

          {/* Recent queries */}
          {recentQueries.length > 0 && (
            <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Ricerche recenti</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {recentQueries.map((q, i) => (
                  <button key={i} onClick={() => setQuery(q)} style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)', padding: '3px 4px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--border) 50%, transparent)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div className="search-main">
          {/* Search bar */}
          <div className="search-bar-row">
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                <IconSearch />
              </span>
              <input
                className="search-input"
                style={{ paddingLeft: '32px' }}
                placeholder={`Cerca in ${currentFolder.name}...`}
                value={query}
                onChange={e => handleSearch(e.target.value)}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                  <IconX />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
              {GRID_MODES.map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setThumbSize(key)} className={`thumb-size-btn${thumbSize === key ? ' active' : ''}`} title={label}>
                  <Icon />
                </button>
              ))}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
              {loading ? 'Caricamento...' : `${results.length} foto`}
            </span>
          </div>

          {/* Similarity banner */}
          {similarTo && (
            <div className="similarity-active-banner">
              <img src={similarTo.thumbnailLink} style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
              <span>Simili a <strong>{similarTo.name}</strong> {similarLoading ? '— calcolo...' : `— ${similarResults.length} trovate`}</span>
              <button onClick={() => { setSimilarTo(null); setSimilarResults([]) }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#8b5cf6' }}>
                <IconX />
              </button>
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="search-empty"><span>Caricamento...</span></div>
          ) : results.length === 0 ? (
            <div className="search-empty">
              <IconSearch />
              <span>{allPhotos.length === 0 ? 'Seleziona una cartella dalla sidebar' : 'Nessun risultato'}</span>
            </div>
          ) : (
            <div
              className={thumbSize === 'masonry' ? 'search-masonry' : 'search-grid'}
              style={thumbSize !== 'masonry' ? { '--thumb-size': `${THUMB_SIZES[thumbSize]}px` } : undefined}
            >
              {results.map((photo, idx) => (
                <div key={photo.id} className={thumbSize === 'masonry' ? 'masonry-card' : 'thumb-card'} onClick={() => setSlideshowIdx(idx)}>
                  {photo.thumbnailLink ? (
                    <img src={photo.thumbnailLink} alt={photo.name} loading="lazy" title={photo.name} />
                  ) : (
                    <div className="thumb-no-preview">📄</div>
                  )}
                  {isVideoFile(photo) && (
                    <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '2px 5px', color: 'white', fontSize: 10, pointerEvents: 'none', lineHeight: 1.2 }}>▶</div>
                  )}
                  {similarTo && photo._dist !== undefined && photo._dist === 0 && (
                    <div className="search-similar-badge">identica</div>
                  )}
                  <div className="thumb-overlay" onClick={e => e.stopPropagation()}>
                    <button className="thumb-overlay-btn" title="Cerca simili" onClick={() => handleSimilarity(photo)}>
                      <IconSimilar />
                    </button>
                    <button className="thumb-overlay-btn" title="QuickLook" onClick={() => setSlideshowIdx(idx)}>
                      <IconEye />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Slideshow */}
      {slideshowIdx !== null && (
        <QuickLookModal
          files={[results[slideshowIdx]]}
          currentIndex={slideshowIdx}
          total={results.length}
          onPrev={() => setSlideshowIdx(i => Math.max(0, i - 1))}
          onNext={() => setSlideshowIdx(i => Math.min(results.length - 1, i + 1))}
          onClose={() => setSlideshowIdx(null)}
        />
      )}
    </div>
  )
}
