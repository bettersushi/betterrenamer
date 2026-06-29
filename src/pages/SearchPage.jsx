import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import logoSrc from '../assets/logo-br.svg'
import { listFiles, searchFilesGlobal, listFilesRecursive } from '../drive'
import QuickLookModal from '../components/QuickLookModal'
import SimilarityBalloon from '../components/SimilarityBalloon'
import './SearchPage.css'

const MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp', '.tiff', '.tif', '.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])
const SEARCH_QUERIES_KEY = 'betterrenamer_search_queries'
const PHASH_CACHE_KEY = 'br_phash_cache'
const GLOBAL_SIM_CAP = 2000
const THUMB_SIZES = { sm: 72, md: 120, lg: 200, masonry: 0 }

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

function getLargeThumbUrl(thumbnailLink, size = 1600) {
  if (!thumbnailLink) return null
  return thumbnailLink.replace(/=s\d+$/, `=s${size}`).replace(/=s\d+-/, `=s${size}-`)
}

function LazyPhoto({ src, alt, className, style }) {
  const ref = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [src_, setSrc] = useState(null)

  useEffect(() => {
    if (!src) return
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSrc(src); obs.disconnect() }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [src])

  return (
    <div ref={ref} className={`lazy-photo-wrap${loaded ? ' lazy-loaded' : ''}`} style={style}>
      {!loaded && <div className="lazy-shimmer" />}
      {src_ && (
        <img src={src_} alt={alt} className={className}
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }} />
      )}
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────
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
const IconGlobalSimilar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)
const IconVideoFile = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2"/>
    <path d="M9 8l8 4-8 4V8z" fill="currentColor" stroke="none"/>
  </svg>
)
const IconFolderJump = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
    <polyline points="9 14 12 17 15 14"/>
    <line x1="12" y1="11" x2="12" y2="17"/>
  </svg>
)
const IconChevronLeft = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const IconChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
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
const IconSpinner = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" style={{ animation: 'spin 1s linear infinite' }}/>
  </svg>
)

const GRID_MODES = [
  { key: 'sm', icon: IconGridSm, label: 'Piccolo' },
  { key: 'md', icon: IconGridMd, label: 'Medio' },
  { key: 'lg', icon: IconGridLg, label: 'Grande' },
  { key: 'masonry', icon: IconMasonry, label: 'Proporzioni originali' },
]

// ── Tree Node ────────────────────────────────────────────────────────────────
function TreeNode({ folder, depth, expanded, loading, children, activeId, onToggle, onSelect }) {
  const hasChildren = children === undefined || children.length > 0
  return (
    <div>
      <div
        className={`tree-node${activeId === folder.id ? ' active' : ''}`}
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        <button
          className="tree-chevron"
          onClick={e => { e.stopPropagation(); onToggle(folder) }}
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', opacity: hasChildren ? 1 : 0.2 }}
          disabled={!hasChildren && !loading}
        >
          {loading ? <IconSpinner /> : <IconChevronRight />}
        </button>
        <span className="tree-label" onClick={() => onSelect(folder)} title={folder.name}>
          {folder.name}
        </span>
      </div>
      {expanded && children && children.map(c => (
        <ConnectedTreeNode key={c.id} folder={c} depth={depth + 1} activeId={activeId} onToggle={onToggle} onSelect={onSelect} />
      ))}
    </div>
  )
}

// Connected version reads its own state from props passed down
function ConnectedTreeNode({ folder, depth, activeId, onToggle, onSelect, treeExpanded, treeChildren, treeLoading }) {
  return (
    <TreeNode
      folder={folder}
      depth={depth}
      expanded={treeExpanded?.[folder.id]}
      loading={treeLoading?.[folder.id]}
      children={treeChildren?.[folder.id]}
      activeId={activeId}
      onToggle={onToggle}
      onSelect={onSelect}
    />
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function SearchPage({ auth, onLogout, isDark, onToggleTheme, onTokenRefresh }) {
  const navigate = useNavigate()

  // Tree state
  const [treeExpanded, setTreeExpanded] = useState({ root: true })
  const [treeChildren, setTreeChildren] = useState({})
  const [treeLoading, setTreeLoading] = useState({})
  const [treePhotos, setTreePhotos] = useState({})
  const [activeFolderId, setActiveFolderId] = useState('root')
  const [activeFolderName, setActiveFolderName] = useState('My Drive')

  // Grid state
  const [allPhotos, setAllPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [thumbSize, setThumbSize] = useState('md')
  const [slideshowIdx, setSlideshowIdx] = useState(null)

  // Search & similarity
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalResults, setGlobalResults] = useState(null)
  const [globalLoading, setGlobalLoading] = useState(false)
  const globalTimerRef = useRef(null)
  const [similarTo, setSimilarTo] = useState(null)
  const [similarResults, setSimilarResults] = useState([])
  const [similarLoading, setSimilarLoading] = useState(false)
  const [globalSimState, setGlobalSimState] = useState(null)
  const globalSimAbort = useRef(null)
  const pHashCache = useRef({})

  // Universal view history stack
  const [viewStack, setViewStack] = useState([])

  const pushView = () => {
    setViewStack(s => [...s, {
      activeFolderId, activeFolderName, allPhotos,
      globalQuery, globalResults, similarTo, similarResults,
    }])
  }
  const popView = () => {
    setViewStack(s => {
      const prev = s[s.length - 1]
      if (!prev) return s
      setActiveFolderId(prev.activeFolderId)
      setActiveFolderName(prev.activeFolderName)
      setAllPhotos(prev.allPhotos)
      setGlobalQuery(prev.globalQuery)
      setGlobalResults(prev.globalResults)
      setSimilarTo(prev.similarTo)
      setSimilarResults(prev.similarResults)
      return s.slice(0, -1)
    })
  }

  // ── Folder loading ──────────────────────────────────────────────────────
  const fetchFolder = useCallback(async (folderId) => {
    try {
      const data = await listFiles(auth.accessToken, folderId)
      const files = data.files || []
      const subfolders = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder')
      const photos = files.filter(isMediaFile)
      return { subfolders, photos }
    } catch (e) {
      if (e.status === 401 && onTokenRefresh) {
        const newToken = await onTokenRefresh()
        if (newToken) {
          const data = await listFiles(newToken, folderId)
          const files = data.files || []
          return {
            subfolders: files.filter(f => f.mimeType === 'application/vnd.google-apps.folder'),
            photos: files.filter(isMediaFile),
          }
        }
      }
      throw e
    }
  }, [auth.accessToken, onTokenRefresh])

  const selectFolder = useCallback(async (folderId, folderName, pushHistory = true) => {
    if (pushHistory) pushView()
    setActiveFolderId(folderId)
    setActiveFolderName(folderName)
    setSimilarTo(null); setSimilarResults([])
    setGlobalResults(null); setGlobalQuery('')

    if (treePhotos[folderId]) {
      setAllPhotos(treePhotos[folderId])
      return
    }
    setLoading(true)
    try {
      const { subfolders, photos } = await fetchFolder(folderId)
      setTreeChildren(t => ({ ...t, [folderId]: subfolders }))
      setTreePhotos(t => ({ ...t, [folderId]: photos }))
      setAllPhotos(photos)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [fetchFolder, treePhotos, pushView])

  const handleTreeToggle = useCallback(async (folder, siblingIds = []) => {
    const id = folder.id
    const willExpand = !treeExpanded[id]
    setTreeExpanded(t => {
      const next = { ...t, [id]: willExpand }
      // accordion: collapse siblings when expanding
      if (willExpand) siblingIds.forEach(sid => { if (sid !== id) next[sid] = false })
      return next
    })
    if (willExpand && !treeChildren[id]) {
      setTreeLoading(t => ({ ...t, [id]: true }))
      try {
        const { subfolders, photos } = await fetchFolder(id)
        setTreeChildren(t => ({ ...t, [id]: subfolders }))
        setTreePhotos(t => ({ ...t, [id]: photos }))
      } catch (e) { console.error(e) }
      finally { setTreeLoading(t => ({ ...t, [id]: false })) }
    }
  }, [treeExpanded, treeChildren, fetchFolder])

  const handleTreeSelect = useCallback((folder, siblingIds = []) => {
    handleTreeToggle(folder, siblingIds)
    selectFolder(folder.id, folder.name)
  }, [handleTreeToggle, selectFolder])

  // Init: load root
  useEffect(() => {
    setLoading(true)
    fetchFolder('root').then(({ subfolders, photos }) => {
      setTreeChildren(t => ({ ...t, root: subfolders }))
      setTreePhotos(t => ({ ...t, root: photos }))
      setAllPhotos(photos)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  // ── Folder jump from thumb ──────────────────────────────────────────────
  const handleFolderJump = (photo) => {
    if (!photo.parents?.[0]) return
    pushView()
    const folderId = photo.parents[0]
    const folderName = photo._parentName || 'Cartella'
    setActiveFolderId(folderId)
    setActiveFolderName(folderName)
    setSimilarTo(null); setSimilarResults([])
    setGlobalResults(null); setGlobalQuery('')

    if (treePhotos[folderId]) {
      setAllPhotos(treePhotos[folderId])
      return
    }
    setLoading(true)
    fetchFolder(folderId).then(({ subfolders, photos }) => {
      setTreeChildren(t => ({ ...t, [folderId]: subfolders }))
      setTreePhotos(t => ({ ...t, [folderId]: photos }))
      setAllPhotos(photos)
    }).catch(console.error).finally(() => setLoading(false))
  }

  // ── Global name search ──────────────────────────────────────────────────
  const handleGlobalSearch = (q) => {
    setGlobalQuery(q)
    clearTimeout(globalTimerRef.current)
    if (!q.trim()) { setGlobalResults(null); return }
    if (globalResults === null) pushView()
    globalTimerRef.current = setTimeout(async () => {
      setGlobalLoading(true)
      try {
        const data = await searchFilesGlobal(auth.accessToken, q.trim())
        setGlobalResults(data.files || [])
      } catch (e) { console.error(e) }
      finally { setGlobalLoading(false) }
    }, 500)
  }

  // ── Per-folder similarity ───────────────────────────────────────────────
  const handleSimilarity = useCallback(async (photo) => {
    if (!photo.thumbnailLink) return
    pushView()
    setSimilarLoading(true)
    setSimilarTo(photo)
    setGlobalResults(null); setGlobalQuery('')
    try {
      if (!pHashCache.current[photo.id]) {
        pHashCache.current[photo.id] = await computePHash(photo.thumbnailLink)
      }
      const refHash = pHashCache.current[photo.id]
      const withDist = []
      for (const p of allPhotos) {
        if (!p.thumbnailLink) continue
        try {
          if (!pHashCache.current[p.id]) pHashCache.current[p.id] = await computePHash(p.thumbnailLink)
          withDist.push({ ...p, _dist: hammingDistance(refHash, pHashCache.current[p.id]) })
        } catch { /* skip */ }
      }
      withDist.sort((a, b) => a._dist - b._dist)
      setSimilarResults(withDist.filter(p => p._dist <= 22))
    } catch (e) {
      alert('Similarità non disponibile: ' + e.message)
      setSimilarTo(null)
    } finally { setSimilarLoading(false) }
  }, [allPhotos])

  // ── Global similarity ───────────────────────────────────────────────────
  const handleGlobalSimilarity = useCallback(async (photo) => {
    if (!photo.thumbnailLink) return
    const abortRef = { cancelled: false }
    globalSimAbort.current = abortRef
    let cache = {}
    try { cache = JSON.parse(localStorage.getItem(PHASH_CACHE_KEY)) || {} } catch {}
    let refHash
    try {
      refHash = cache[photo.id] || await computePHash(photo.thumbnailLink)
      cache[photo.id] = refHash
    } catch (e) {
      setGlobalSimState({ status: 'error', message: 'Errore hash foto: ' + e.message, refPhoto: photo })
      return
    }
    setGlobalSimState({ status: 'scanning', refPhoto: photo, progress: 0, total: 0, cached: 0 })
    let allMedia = []
    try {
      const folders = await listFilesRecursive(auth.accessToken, 'root', 'My Drive', true)
      for (const f of folders) allMedia.push(...f.files.filter(isMediaFile))
    } catch (e) {
      setGlobalSimState({ status: 'error', message: 'Errore listing: ' + e.message, refPhoto: photo })
      return
    }
    if (abortRef.cancelled) return
    const truncated = allMedia.length > GLOBAL_SIM_CAP
    if (truncated) allMedia = allMedia.slice(0, GLOBAL_SIM_CAP)
    const total = allMedia.length
    const BATCH = 8
    let processed = 0, cachedCount = 0
    const withDist = []
    for (let i = 0; i < allMedia.length; i += BATCH) {
      if (abortRef.cancelled) return
      const batch = allMedia.slice(i, i + BATCH)
      await Promise.all(batch.map(async (p) => {
        if (!p.thumbnailLink) return
        try {
          let hash = cache[p.id]
          if (!hash) { hash = await computePHash(p.thumbnailLink); cache[p.id] = hash }
          else cachedCount++
          withDist.push({ ...p, _dist: hammingDistance(refHash, hash) })
        } catch { /* skip */ }
      }))
      processed += batch.length
      if (Math.floor(i / BATCH) % 20 === 0) {
        try { localStorage.setItem(PHASH_CACHE_KEY, JSON.stringify(cache)) } catch {}
      }
      setGlobalSimState(s => s?.status === 'scanning' ? { ...s, progress: processed, total, cached: cachedCount } : s)
      if (i + BATCH < allMedia.length) await new Promise(r => setTimeout(r, 50))
    }
    if (abortRef.cancelled) return
    try { localStorage.setItem(PHASH_CACHE_KEY, JSON.stringify(cache)) } catch {}
    withDist.sort((a, b) => a._dist - b._dist)
    setGlobalSimState({ status: 'done', refPhoto: photo, results: withDist.filter(p => p._dist <= 22), truncated })
  }, [auth.accessToken])

  // ── Results ─────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    if (globalResults !== null) return globalResults
    if (similarTo) return similarResults
    return allPhotos
  }, [allPhotos, similarTo, similarResults, globalResults])

  // ── Render ───────────────────────────────────────────────────────────────
  const rootFolders = treeChildren['root'] || []

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

        {/* Sidebar — tree */}
        <div className="search-sidebar">
          {/* Tree root label */}
          <div
            className={`tree-node tree-root${activeFolderId === 'root' ? ' active' : ''}`}
            onClick={() => selectFolder('root', 'My Drive')}
          >
            <span className="tree-label" style={{ fontWeight: 600 }}>My Drive</span>
          </div>

          {/* Tree children of root */}
          {rootFolders.map(f => (
            <TreeNodeFull
              key={f.id}
              folder={f}
              depth={1}
              siblingIds={rootFolders.map(s => s.id)}
              treeExpanded={treeExpanded}
              treeChildren={treeChildren}
              treeLoading={treeLoading}
              activeId={activeFolderId}
              onToggle={handleTreeToggle}
              onSelect={handleTreeSelect}
            />
          ))}

          {treeLoading['root'] && (
            <div style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>Caricamento...</div>
          )}
        </div>

        {/* Main */}
        <div className="search-main">
          {/* Search bar */}
          <div className="search-bar-row" style={{ justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '69%' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                <IconSearch />
              </span>
              <input
                className="search-input"
                style={{ paddingLeft: '36px', paddingRight: globalQuery ? '36px' : '14px', width: '100%', boxSizing: 'border-box', fontSize: '15px', padding: '10px 14px 10px 36px' }}
                placeholder="Cerca ovunque in Drive..."
                value={globalQuery}
                onChange={e => handleGlobalSearch(e.target.value)}
              />
              {globalQuery && (
                <button onClick={() => { setGlobalQuery(''); setGlobalResults(null) }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
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
              {loading || globalLoading ? 'Caricamento...' : `${results.length} foto`}
            </span>
          </div>

          {/* Back button + folder label row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {viewStack.length > 0 && (
              <button onClick={popView} className="tree-back-btn" style={{ width: 'auto', marginBottom: 0, padding: '6px 14px', fontSize: '13px' }}>
                <IconChevronLeft /> Indietro
              </button>
            )}
            {!similarTo && !globalResults && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📁 {activeFolderName}</span>
            )}
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

          {/* Global search banner */}
          {globalResults !== null && !globalLoading && (
            <div className="similarity-active-banner" style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--primary) 25%, transparent)', color: 'var(--primary)' }}>
              <IconSearch />
              <span>{globalResults.length} risultati per "{globalQuery}"</span>
              <button onClick={() => { setGlobalQuery(''); setGlobalResults(null) }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
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
              <span>{allPhotos.length === 0 ? 'Nessuna foto in questa cartella' : 'Nessun risultato'}</span>
            </div>
          ) : (
            <div
              className={thumbSize === 'masonry' ? 'search-masonry' : 'search-grid'}
              style={thumbSize !== 'masonry' ? { '--thumb-size': `${THUMB_SIZES[thumbSize]}px` } : undefined}
            >
              {results.map((photo, idx) => (
                <div key={photo.id} className={thumbSize === 'masonry' ? 'masonry-card' : 'thumb-card'} onClick={() => setSlideshowIdx(idx)}>
                  {photo.thumbnailLink ? (
                    <LazyPhoto
                      src={getLargeThumbUrl(photo.thumbnailLink, thumbSize === 'masonry' ? 1600 : THUMB_SIZES[thumbSize] * 2)}
                      alt={photo.name}
                      className={thumbSize === 'masonry' ? 'masonry-img' : 'thumb-img'}
                      style={thumbSize === 'masonry' ? undefined : { width: '100%', height: '100%' }}
                    />
                  ) : (
                    <div className="thumb-no-preview">📄</div>
                  )}
                  {isVideoFile(photo) && (
                    <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.55)', borderRadius: 4, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', pointerEvents: 'none' }}>
                      <IconVideoFile />
                    </div>
                  )}
                  {similarTo && photo._dist !== undefined && photo._dist === 0 && (
                    <div className="search-similar-badge">identica</div>
                  )}
                  <div className="thumb-overlay" onClick={e => e.stopPropagation()}>
                    <button className="thumb-overlay-btn" title="Cerca simili in cartella" onClick={() => handleSimilarity(photo)}>
                      <IconSimilar />
                    </button>
                    <button className="thumb-overlay-btn" title="Cerca simili ovunque in Drive" onClick={() => handleGlobalSimilarity(photo)}>
                      <IconGlobalSimilar />
                    </button>
                    <button className="thumb-overlay-btn" title="Vai alla cartella" onClick={() => handleFolderJump(photo)}>
                      <IconFolderJump />
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

      {globalSimState && (
        <SimilarityBalloon
          state={globalSimState}
          onViewResults={() => {
            pushView()
            setSimilarTo(globalSimState.refPhoto)
            setSimilarResults(globalSimState.results)
            setGlobalResults(null)
            setGlobalQuery('')
            setGlobalSimState(null)
          }}
          onCancel={() => {
            if (globalSimAbort.current) globalSimAbort.current.cancelled = true
            setGlobalSimState(null)
          }}
          onClose={() => setGlobalSimState(null)}
        />
      )}
    </div>
  )
}

// Recursive tree node with full tree state passed as props
function TreeNodeFull({ folder, depth, siblingIds = [], treeExpanded, treeChildren, treeLoading, activeId, onToggle, onSelect }) {
  const expanded = treeExpanded[folder.id]
  const loading = treeLoading[folder.id]
  const children = treeChildren[folder.id]
  const hasChildren = children === undefined || children.length > 0

  const childSiblingIds = (children || []).map(c => c.id)

  return (
    <div className="tree-node-wrap">
      <div
        className={`tree-node${activeId === folder.id ? ' active' : ''}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => onSelect(folder, siblingIds)}
      >
        <span
          className="tree-chevron"
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            opacity: hasChildren ? 1 : 0.2,
            display: 'inline-flex', alignItems: 'center',
          }}
        >
          {loading ? <IconSpinner /> : <IconChevronRight />}
        </span>
        <span className="tree-label" title={folder.name}>
          {folder.name}
        </span>
      </div>
      {expanded && children && children.map(c => (
        <TreeNodeFull
          key={c.id}
          folder={c}
          depth={depth + 1}
          siblingIds={childSiblingIds}
          treeExpanded={treeExpanded}
          treeChildren={treeChildren}
          treeLoading={treeLoading}
          activeId={activeId}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
      {/* skeleton while loading children */}
      {expanded && loading && !children && (
        <div style={{ paddingLeft: 8 + (depth + 1) * 12 }}>
          {[1, 2].map(i => (
            <div key={i} className="tree-skeleton" style={{ width: `${60 + i * 15}%` }} />
          ))}
        </div>
      )}
    </div>
  )
}
