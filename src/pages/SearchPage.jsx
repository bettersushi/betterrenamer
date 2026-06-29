import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import logoSrc from '../assets/logo-br.svg'
import { listFiles, searchFilesGlobal, listFilesRecursive } from '../drive'
import QuickLookModal from '../components/QuickLookModal'
import SimilarityBalloon from '../components/SimilarityBalloon'
import CropModal from '../components/CropModal'
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
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight + 200 && rect.bottom > -200) {
      setSrc(src)
      return
    }
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
const IconCrop = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 2v14a2 2 0 0 0 2 2h14"/>
    <path d="M18 22V8a2 2 0 0 0-2-2H2"/>
  </svg>
)
const IconFolder = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
  </svg>
)
const IconSortName = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="14" y2="6"/><line x1="4" y1="12" x2="11" y2="12"/><line x1="4" y1="18" x2="8" y2="18"/>
    <polyline points="16 16 20 20 20 4"/>
  </svg>
)
const IconSortDate = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
    <polyline points="12 14 12 18 15 18"/>
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
  const [searchParams, setSearchParams] = useSearchParams()

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
  const [slideshowIdx, setSlideshowIdx] = useState(null)

  // Search & similarity
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalResults, setGlobalResults] = useState(null)
  const [globalLoading, setGlobalLoading] = useState(false)
  const globalTimerRef = useRef(null)
  const [similarTo, setSimilarTo] = useState(null)
  const [similarResults, setSimilarResults] = useState([])
  const [balloons, setBalloons] = useState([])
  const [cropPhoto, setCropPhoto] = useState(null)
  const [croppingIds, setCroppingIds] = useState(new Set())
  const [cropDoneIds, setCropDoneIds] = useState(new Set())
  const [thumbTimestamps, setThumbTimestamps] = useState({}) // forza reload thumbnail dopo crop
  const pHashCache = useRef({})
  const gridRef = useRef(null)
  const [thumbSize, setThumbSizeRaw] = useState(() => localStorage.getItem('br_thumb_size') || 'md')
  const setThumbSize = (v) => { setThumbSizeRaw(v); localStorage.setItem('br_thumb_size', v) }
  const [sortOrder, setSortOrder] = useState('modified')
  const [navHistory, setNavHistory] = useState([])

  // Universal view history stack
  const [viewStack, setViewStack] = useState([])

  const updateBalloon = useCallback((id, patch) =>
    setBalloons(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b)), [])
  const removeBalloon = useCallback((id) =>
    setBalloons(bs => bs.filter(b => b.id !== id)), [])

  const pushView = () => {
    const snapshot = { activeFolderId, activeFolderName, allPhotos, globalQuery, globalResults, similarTo, similarResults }
    // derive history entry from current state
    let entry
    if (similarTo) {
      entry = { type: 'similarity', label: similarTo.name, key: 'sim:' + similarTo.id, Icon: IconSimilar, snapshot }
    } else if (globalResults !== null) {
      entry = { type: 'search', label: globalQuery || 'Ricerca', key: 'q:' + globalQuery, Icon: IconSearch, snapshot }
    } else {
      entry = { type: 'folder', label: activeFolderName, key: 'f:' + activeFolderId, Icon: IconFolder, snapshot }
    }
    setNavHistory(h => [entry, ...h.filter(e => e.key !== entry.key)].slice(0, 5))
    setViewStack(s => [...s, snapshot])
  }
  const restoreState = (snapshot) => {
    setActiveFolderId(snapshot.activeFolderId)
    setActiveFolderName(snapshot.activeFolderName)
    setAllPhotos(snapshot.allPhotos)
    setGlobalQuery(snapshot.globalQuery)
    setGlobalResults(snapshot.globalResults)
    setSimilarTo(snapshot.similarTo)
    setSimilarResults(snapshot.similarResults)
  }
  const popView = () => {
    setViewStack(s => {
      const prev = s[s.length - 1]
      if (!prev) return s
      restoreState(prev)
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
    // persist in URL
    if (folderId === 'root') setSearchParams({}, { replace: true })
    else setSearchParams({ folder: folderId, name: folderName }, { replace: true })

    if (gridRef.current) gridRef.current.scrollTop = 0
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
  }, [fetchFolder, treePhotos, pushView, setSearchParams])

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

  // Init: load root + optionally restore folder from URL
  useEffect(() => {
    const urlFolder = searchParams.get('folder')
    const urlName = searchParams.get('name') || 'Cartella'
    setLoading(true)
    fetchFolder('root').then(({ subfolders, photos }) => {
      setTreeChildren(t => ({ ...t, root: subfolders }))
      setTreePhotos(t => ({ ...t, root: photos }))
      if (urlFolder) {
        // restore the folder from URL without pushing to viewStack
        setActiveFolderId(urlFolder)
        setActiveFolderName(urlName)
        return fetchFolder(urlFolder).then(({ subfolders: sf, photos: fp }) => {
          setTreeChildren(t => ({ ...t, [urlFolder]: sf }))
          setTreePhotos(t => ({ ...t, [urlFolder]: fp }))
          setAllPhotos(fp)
        })
      } else {
        setAllPhotos(photos)
      }
    }).catch(console.error).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (gridRef.current) gridRef.current.scrollTop = 0
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
    const id = crypto.randomUUID()
    const abortRef = { cancelled: false }
    const total = allPhotos.filter(p => p.thumbnailLink).length
    setBalloons(bs => [...bs, { id, type: 'folder', status: 'scanning', refPhoto: photo, progress: 0, total, cached: 0, abortRef }])
    try {
      if (!pHashCache.current[photo.id]) pHashCache.current[photo.id] = await computePHash(photo.thumbnailLink)
      const refHash = pHashCache.current[photo.id]
      const withDist = []
      let processed = 0
      for (const p of allPhotos) {
        if (abortRef.cancelled) return
        if (!p.thumbnailLink) continue
        try {
          if (!pHashCache.current[p.id]) pHashCache.current[p.id] = await computePHash(p.thumbnailLink)
          withDist.push({ ...p, _dist: hammingDistance(refHash, pHashCache.current[p.id]) })
        } catch { /* skip */ }
        processed++
        updateBalloon(id, { progress: processed })
      }
      withDist.sort((a, b) => a._dist - b._dist)
      updateBalloon(id, { status: 'done', results: withDist.filter(p => p._dist <= 22) })
    } catch (e) {
      updateBalloon(id, { status: 'error', message: e.message })
    }
  }, [allPhotos, updateBalloon])

  // ── Global similarity ───────────────────────────────────────────────────
  const handleGlobalSimilarity = useCallback(async (photo) => {
    if (!photo.thumbnailLink) return
    const id = crypto.randomUUID()
    const abortRef = { cancelled: false }
    let cache = {}
    try { cache = JSON.parse(localStorage.getItem(PHASH_CACHE_KEY)) || {} } catch {}
    let refHash
    try {
      refHash = cache[photo.id] || await computePHash(photo.thumbnailLink)
      cache[photo.id] = refHash
    } catch (e) {
      setBalloons(bs => [...bs, { id, type: 'global', status: 'error', message: 'Errore hash foto: ' + e.message, refPhoto: photo, abortRef }])
      return
    }
    setBalloons(bs => [...bs, { id, type: 'global', status: 'listing', refPhoto: photo, abortRef }])
    let allMedia = []
    try {
      const folders = await listFilesRecursive(auth.accessToken, 'root', 'My Drive', true)
      for (const f of folders) allMedia.push(...f.files.filter(isMediaFile))
    } catch (e) {
      updateBalloon(id, { status: 'error', message: 'Errore listing: ' + e.message })
      return
    }
    if (abortRef.cancelled) return
    const truncated = allMedia.length > GLOBAL_SIM_CAP
    if (truncated) allMedia = allMedia.slice(0, GLOBAL_SIM_CAP)
    const total = allMedia.length
    updateBalloon(id, { status: 'scanning', progress: 0, total, cached: 0 })
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
      updateBalloon(id, { progress: processed, total, cached: cachedCount })
      if (i + BATCH < allMedia.length) await new Promise(r => setTimeout(r, 50))
    }
    if (abortRef.cancelled) return
    try { localStorage.setItem(PHASH_CACHE_KEY, JSON.stringify(cache)) } catch {}
    withDist.sort((a, b) => a._dist - b._dist)
    updateBalloon(id, { status: 'done', results: withDist.filter(p => p._dist <= 22), truncated })
  }, [auth.accessToken, updateBalloon])

  // ── Results ─────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    let list = globalResults !== null ? globalResults : similarTo ? similarResults : allPhotos
    if (sortOrder === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    else list = [...list].sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0))
    return list
  }, [allPhotos, similarTo, similarResults, globalResults, sortOrder])

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
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

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
          {/* Search bar + toolbar */}
          <div className="search-bar-row">
            <div style={{ position: 'relative', width: '38%', flexShrink: 0 }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                <IconSearch />
              </span>
              <input
                className="search-input"
                style={{ paddingLeft: '32px', paddingRight: globalQuery ? '32px' : '10px', width: '100%', boxSizing: 'border-box', fontSize: '13px', padding: '7px 10px 7px 32px' }}
                placeholder="Cerca ovunque in Drive..."
                value={globalQuery}
                onChange={e => handleGlobalSearch(e.target.value)}
              />
              {globalQuery && (
                <button onClick={() => { setGlobalQuery(''); setGlobalResults(null) }} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                  <IconX />
                </button>
              )}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: 6, whiteSpace: 'nowrap' }}>
                {loading || globalLoading ? 'Caricamento...' : `${results.length} foto`}
              </span>
              {GRID_MODES.map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setThumbSize(key)} className={`thumb-size-btn${thumbSize === key ? ' active' : ''}`} title={label}>
                  <Icon />
                </button>
              ))}
              <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px', alignSelf: 'center' }} />
              <button onClick={() => setSortOrder('name')} className={`thumb-size-btn${sortOrder === 'name' ? ' active' : ''}`} title="Ordina per nome">
                <IconSortName />
              </button>
              <button onClick={() => setSortOrder('modified')} className={`thumb-size-btn${sortOrder === 'modified' ? ' active' : ''}`} title="Ordina per data modifica">
                <IconSortDate />
              </button>
            </div>
          </div>

          {/* Back button + tag cloud row */}
          <div className="search-sub-toolbar">
            {viewStack.length > 0 && (
              <button onClick={popView} className="sub-toolbar-back">
                <IconChevronLeft /> Indietro
              </button>
            )}
            {!similarTo && !globalResults && (
              <span className="sub-toolbar-folder">📁 {activeFolderName}</span>
            )}
            {navHistory.length > 0 && (
              <div className="sub-toolbar-tags">
                {navHistory.map(entry => (
                  <button key={entry.key} className="history-tag" onClick={() => restoreState(entry.snapshot)} title={entry.label}>
                    <entry.Icon />
                    <span>{entry.label}</span>
                  </button>
                ))}
              </div>
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
              ref={gridRef}
              className={thumbSize === 'masonry' ? 'search-masonry-scroll' : 'search-grid-scroll'}
            >
              {thumbSize === 'masonry' ? (
                <div className="search-masonry">
                  {results.map((photo, idx) => (
                    <div key={photo.id} className="masonry-card" onClick={() => setSlideshowIdx(idx)}>
                      {photo.thumbnailLink ? (
                        <LazyPhoto
                          key={thumbTimestamps[photo.id] || photo.id}
                          src={getLargeThumbUrl(photo.thumbnailLink, 1600)}
                          alt={photo.name}
                          className="masonry-img"
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
                        <button className="thumb-overlay-btn" title="Cerca simili in cartella" onClick={() => handleSimilarity(photo)}><IconSimilar /></button>
                        <button className="thumb-overlay-btn" title="Cerca simili ovunque in Drive" onClick={() => handleGlobalSimilarity(photo)}><IconGlobalSimilar /></button>
                        <button className="thumb-overlay-btn" title="Vai alla cartella" onClick={() => handleFolderJump(photo)}><IconFolderJump /></button>
                        <button className="thumb-overlay-btn" title="QuickLook" onClick={() => setSlideshowIdx(idx)}><IconEye /></button>
                        {photo.thumbnailLink && (
                          <button className="thumb-overlay-btn" title="Crop" onClick={() => setCropPhoto(photo)}><IconCrop /></button>
                        )}
                      </div>
                      {(croppingIds.has(photo.id) || cropDoneIds.has(photo.id)) && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: croppingIds.has(photo.id) ? 'rgba(0,0,0,0.55)' : 'rgba(16,185,129,0.7)', borderRadius: 8, pointerEvents: 'none', transition: 'background 0.3s' }}>
                          {croppingIds.has(photo.id) ? (
                            <svg style={{ animation: 'spin 0.9s linear infinite' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                          ) : (
                            <span style={{ color: 'white', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>✓ Salvato</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="search-grid" style={{ '--thumb-size': `${THUMB_SIZES[thumbSize]}px` }}>
                {results.map((photo, idx) => (
                  <div key={photo.id} className="thumb-card" onClick={() => setSlideshowIdx(idx)}>
                    {photo.thumbnailLink ? (
                      <LazyPhoto
                        key={thumbTimestamps[photo.id] || photo.id}
                        src={getLargeThumbUrl(photo.thumbnailLink, THUMB_SIZES[thumbSize] * 2)}
                        alt={photo.name}
                        className="thumb-img"
                        style={{ width: '100%', height: '100%' }}
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
                      <button className="thumb-overlay-btn" title="Cerca simili in cartella" onClick={() => handleSimilarity(photo)}><IconSimilar /></button>
                      <button className="thumb-overlay-btn" title="Cerca simili ovunque in Drive" onClick={() => handleGlobalSimilarity(photo)}><IconGlobalSimilar /></button>
                      <button className="thumb-overlay-btn" title="Vai alla cartella" onClick={() => handleFolderJump(photo)}><IconFolderJump /></button>
                      <button className="thumb-overlay-btn" title="QuickLook" onClick={() => setSlideshowIdx(idx)}><IconEye /></button>
                      {photo.thumbnailLink && (
                        <button className="thumb-overlay-btn" title="Crop" onClick={() => setCropPhoto(photo)}><IconCrop /></button>
                      )}
                    </div>
                    {(croppingIds.has(photo.id) || cropDoneIds.has(photo.id)) && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: croppingIds.has(photo.id) ? 'rgba(0,0,0,0.55)' : 'rgba(16,185,129,0.7)', borderRadius: 8, pointerEvents: 'none', transition: 'background 0.3s' }}>
                        {croppingIds.has(photo.id) ? (
                          <svg style={{ animation: 'spin 0.9s linear infinite' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        ) : (
                          <span style={{ color: 'white', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>✓ Salvato</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                </div>
              )}
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

      {balloons.map((b, i) => (
        <SimilarityBalloon
          key={b.id}
          state={b}
          index={i}
          onViewResults={() => {
            pushView()
            setSimilarTo(b.refPhoto)
            setSimilarResults(b.results)
            setGlobalResults(null)
            setGlobalQuery('')
            removeBalloon(b.id)
          }}
          onCancel={() => { b.abortRef.cancelled = true; removeBalloon(b.id) }}
          onClose={() => removeBalloon(b.id)}
        />
      ))}
      {cropPhoto && (
        <CropModal
          photo={cropPhoto}
          accessToken={auth.accessToken}
          onClose={() => setCropPhoto(null)}
          onDone={(photoId, updatedMeta) => {
            setCropPhoto(null)
            // Update thumbnailLink in allPhotos so the grid shows the new image
            if (updatedMeta?.thumbnailLink) {
              setAllPhotos(photos => photos.map(p => p.id === photoId ? { ...p, thumbnailLink: updatedMeta.thumbnailLink } : p))
            }
            setCroppingIds(ids => new Set([...ids, photoId]))
            setThumbTimestamps(ts => ({ ...ts, [photoId]: Date.now() }))
            setTimeout(() => {
              setCroppingIds(ids => { const n = new Set(ids); n.delete(photoId); return n })
              setCropDoneIds(ids => new Set([...ids, photoId]))
              setTimeout(() => {
                setCropDoneIds(ids => { const n = new Set(ids); n.delete(photoId); return n })
              }, 1500)
            }, 2500)
          }}
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
