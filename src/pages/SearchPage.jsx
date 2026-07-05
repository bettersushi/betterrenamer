import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { staggerContainer, fadeItem, staggerContainerFast, slideFadeItem } from '../motionVariants'
import { listFiles, searchFilesGlobal, listFilesRecursive, updateFileContent, getFileMetadata, patchFileMetadata, trashFile, restoreFile, copyFile, moveFile, renameFile, createFolder } from '../drive'
import QuickLookModal from '../components/QuickLookModal'
import PalettePicker from '../components/PalettePicker'
import UserMenu from '../components/UserMenu'
import ScopePickerModal from '../components/ScopePickerModal'
import DriveStatsModal from '../components/DriveStatsModal'
import PhotoContextMenu from '../components/PhotoContextMenu'
import FolderContextMenu from '../components/FolderContextMenu'
import { uploadFileResumable } from '../driveUpload'
import UploadQueuePanel from '../components/UploadQueuePanel'
import FolderPickerModal from '../components/FolderPickerModal'
import CropModal from '../components/CropModal'
import BatchCropModal from '../components/BatchCropModal'
import EnhanceModal from '../components/EnhanceModal'
import VideoMontageModal from '../components/VideoMontageModal'
import { useVideoMontage } from '../context/VideoMontageContext'
import { useSimilarity } from '../context/SimilarityContext'
import { useSearchState } from '../context/SearchStateContext'

import StatusModal from '../components/StatusModal'
import { MEDIA_EXTENSIONS, VIDEO_EXTENSIONS, getExt, isMediaFile, isVideoFile } from '../mediaTypes'
import './SearchPage.css'

const SEARCH_QUERIES_KEY = 'betterrenamer_search_queries'
const THUMB_SIZES = { sm: 72, md: 120, lg: 200, masonry: 0 }
function computeMasonryCols() {
  if (typeof window === 'undefined') return 4
  if (window.innerWidth <= 800) return 2
  if (window.innerWidth <= 1200) return 3
  return 4
}

function getBaseName(name) {
  const ext = getExt(name)
  return ext ? name.slice(0, -ext.length) : name
}

function RenameModal({ photo, title = 'Rinomina file', onClose, onConfirm }) {
  const [name, setName] = useState(photo.name)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '20px 22px', width: 360, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)' }}>{title}</div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(name); if (e.key === 'Escape') onClose() }}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annulla</button>
          <button onClick={() => onConfirm(name)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Rinomina</button>
        </div>
      </div>
    </div>
  )
}

function formatDuration(ms) {
  if (!ms) return null
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${m}:${String(sec).padStart(2,'0')}`
}

function formatSize(bytes) {
  if (!bytes) return null
  const b = Number(bytes)
  if (b >= 1073741824) return `${(b/1073741824).toFixed(1)} GB`
  if (b >= 1048576) return `${(b/1048576).toFixed(1)} MB`
  return `${(b/1024).toFixed(0)} KB`
}

function SubfolderSidebar({ folders, onSelect }) {
  return (
    <div className="subfolder-sidebar">
      <div className="subfolder-sidebar-header">
        Sottocartelle <span>{folders.length}</span>
      </div>
      {folders.map(f => (
        <button key={f.id} className="subfolder-sidebar-item" onClick={() => onSelect(f.id, f.name)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
          <span>{f.name}</span>
        </button>
      ))}
    </div>
  )
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
          draggable="false"
          onDragStart={e => e.preventDefault()}
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
const IconList = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
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
const IconEnhance = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>
  </svg>
)
const IconRotateCCW = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
)
const IconFolder = ({ color } = {}) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill={color || 'none'} stroke={color || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
  </svg>
)
function NavHistoryIcon({ type }) {
  if (type === 'search') return <IconSearch />
  if (type === 'folder') return <IconFolder />
  return <IconSimilar />
}
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
const IconDots = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
  </svg>
)
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
    <polyline points="21 3 21 9 15 9"/>
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
const IconPencilLine = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
)
const IconCheckSquare = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
)
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const IconDownloadBulk = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconMoveBulk = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 17 15 14"/>
  </svg>
)
const IconSpinner = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" style={{ animation: 'spin 1s linear infinite' }}/>
  </svg>
)

const GRID_MODES = [
  { key: 'list', icon: IconList, label: 'Vista elenco' },
  { key: 'md', icon: IconGridMd, label: 'Medio' },
  { key: 'lg', icon: IconGridLg, label: 'Grande' },
  { key: 'masonry', icon: IconMasonry, label: 'Proporzioni originali' },
]

const LIST_COLUMNS = [
  { key: 'thumb', label: '', minWidth: 36, resizable: false, sortable: false, defaultWidth: 36 },
  { key: 'name', label: 'Nome', minWidth: 120, resizable: true, sortable: true, sortKey: 'name', alwaysVisible: true },
  { key: 'size', label: 'Dimensione', minWidth: 70, resizable: true, sortable: true, sortKey: 'size', defaultWidth: 90 },
  { key: 'ext', label: 'Estensione', minWidth: 60, resizable: true, sortable: true, sortKey: 'extension', defaultWidth: 90 },
  { key: 'date', label: 'Data modifica', minWidth: 90, resizable: true, sortable: true, sortKey: 'modified', defaultWidth: 130 },
]
const LIST_COLUMNS_VISIBLE_KEY = 'br_list_columns_visible'
const LIST_COLUMNS_WIDTH_KEY = 'br_list_columns_width'

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
export default function SearchPage({ auth, onLogout, isDark, onToggleTheme, colorScheme, onChangeScheme, onTokenRefresh }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Persistent across navigation (Dashboard <-> Search) via SearchStateContext
  const {
    treeExpanded, treeChildren, treeLoading, treePhotos,
    setTreeChildren, setTreePhotos, setTreeExpanded, setTreeLoading,
    activeFolderId, activeFolderName, setActiveFolderId, setActiveFolderName,
    allPhotos, setAllPhotos, loading,
    globalQuery, setGlobalQuery, globalResults, setGlobalResults, globalLoading,
    similarTo, setSimilarTo, similarResults, setSimilarResults,
    currentSubfolders, setCurrentSubfolders,
    selectionMode, setSelectionMode, selectedIds, setSelectedIds,
    mediaFilter, setMediaFilter, sortOrder, setSortOrder, sortDir, setSortDir,
    showSubfolders, setShowSubfolders,
    navHistory, viewStack,
    gridScrollTopRef,
    fetchFolder,
    pushView,
    popView,
    restoreState,
    selectFolder: ctxSelectFolder,
    handleTreeToggle,
    handleRefreshGrid,
    handleFolderJump: ctxHandleFolderJump,
    handleGlobalSearch: ctxHandleGlobalSearch,
    bootstrap,
  } = useSearchState()

  const [slideshowIdx, setSlideshowIdx] = useState(null)
  const { handleSimilarity: ctxHandleSimilarity, handleGlobalSimilarity: ctxHandleGlobalSimilarity, pendingView, consumePendingView } = useSimilarity()
  const [cropPhoto, setCropPhoto] = useState(null)
  const [batchCropPhotos, setBatchCropPhotos] = useState(null)
  const [enhancePhoto, setEnhancePhoto] = useState(null)
  const [scopePickerPhoto, setScopePickerPhoto] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [contextMenu, setContextMenu] = useState(null) // { photo, idx, x, y }
  const [folderContextMenu, setFolderContextMenu] = useState(null) // { folder, x, y }
  const [gridContextMenu, setGridContextMenu] = useState(null) // { x, y }
  const [uploadQueue, setUploadQueue] = useState([]) // { id, name, progress, status: 'uploading'|'done'|'error', error }
  const [isDraggingFilesOver, setIsDraggingFilesOver] = useState(false)
  const uploadQueueRef = useRef(uploadQueue)
  const activeFolderIdRef = useRef(activeFolderId)
  const uploadInputRef = useRef(null)
  const [movingFolder, setMovingFolder] = useState(null)
  const [movePhoto, setMovePhoto] = useState(null)
  const [renamePhoto, setRenamePhoto] = useState(null)
  const [renameFolder, setRenameFolder] = useState(null)
  const [undoToast, setUndoToast] = useState(null) // { photo, insertIdx, timer }
  const { wizardOpen, wizardMeta, openWizard } = useVideoMontage()
  const [showStatus, setShowStatus] = useState(false)
  const [croppingIds, setCroppingIds] = useState(new Set())
  const [cropDoneIds, setCropDoneIds] = useState(new Set())
  const [rotatingIds, setRotatingIds] = useState(new Set())
  const [rotateDoneIds, setRotateDoneIds] = useState(new Set())
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false)
  const [renameMode, setRenameMode] = useState(false)
  const [renameDrafts, setRenameDrafts] = useState({})
  const [bulkMoveActive, setBulkMoveActive] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const rubberBand = useRef(null) // { startX, startY, rect: {x,y,w,h} }
  const [rubberRect, setRubberRect] = useState(null) // { x, y, w, h } in px relative to scroll container
  const [dragOverFolder, setDragOverFolder] = useState(null)
  const [showHistoryOverflow, setShowHistoryOverflow] = useState(false)
  const [folderTooltip, setFolderTooltip] = useState(null) // { items, x, y }
  const [folderTooltipMode, setFolderTooltipMode] = useState('list') // 'list' | 'grid'
  const folderHoverTimer = useRef(null)
  const folderFileCache = useRef({})
  const activeFolderRef = useRef(null)
  const tooltipSuppressUntilRef = useRef(0)
  const folderCursorRef = useRef({ x: 0, y: 0 })
  const [thumbTimestamps, setThumbTimestamps] = useState({}) // forza reload thumbnail dopo crop
  const gridRef = useRef(null)
  const [thumbSize, setThumbSizeRaw] = useState(() => localStorage.getItem('br_thumb_size') || 'md')
  const setThumbSize = (v) => { setThumbSizeRaw(v); localStorage.setItem('br_thumb_size', v) }

  const [listColumnsVisible, setListColumnsVisible] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LIST_COLUMNS_VISIBLE_KEY))
      if (saved && typeof saved === 'object') return { thumb: true, size: true, ext: true, date: true, ...saved }
    } catch {}
    return { thumb: true, size: true, ext: true, date: true }
  })
  const toggleListColumn = (key) => {
    setListColumnsVisible(v => {
      const next = { ...v, [key]: !v[key] }
      localStorage.setItem(LIST_COLUMNS_VISIBLE_KEY, JSON.stringify(next))
      return next
    })
  }
  const [listColumnsWidth, setListColumnsWidth] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LIST_COLUMNS_WIDTH_KEY))
      if (saved && typeof saved === 'object') return saved
    } catch {}
    return {}
  })
  const columnWidth = (col) => listColumnsWidth[col.key] || col.defaultWidth || col.minWidth
  const resizingColRef = useRef(null)
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const columnMenuHoverTimer = useRef(null)

  const handleColumnResizeStart = useCallback((e, col) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = columnWidth(col)
    resizingColRef.current = { key: col.key, startX, startWidth, minWidth: col.minWidth }
    const onMove = (ev) => {
      const r = resizingColRef.current
      if (!r) return
      const newWidth = Math.max(r.minWidth, r.startWidth + (ev.clientX - r.startX))
      setListColumnsWidth(w => ({ ...w, [r.key]: newWidth }))
    }
    const onUp = () => {
      resizingColRef.current = null
      setListColumnsWidth(w => { localStorage.setItem(LIST_COLUMNS_WIDTH_KEY, JSON.stringify(w)); return w })
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [listColumnsWidth])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setBulkDeleteConfirm(false)
    rubberBand.current = null
    setRubberRect(null)
  }, [])

  useEffect(() => { uploadQueueRef.current = uploadQueue }, [uploadQueue])
  useEffect(() => { activeFolderIdRef.current = activeFolderId }, [activeFolderId])

  const toggleSelection = useCallback((photoId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(photoId) ? next.delete(photoId) : next.add(photoId)
      return next
    })
  }, [])

  const handleGridMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    // Don't start rubber band if clicking directly on a photo card — let drag handle it
    if (e.target.closest('[data-photo-id]')) return
    const container = gridRef.current
    if (!container) return
    const cr = container.getBoundingClientRect()
    const x = e.clientX - cr.left
    const y = e.clientY - cr.top + container.scrollTop
    rubberBand.current = { startX: x, startY: y }
    setRubberRect({ x, y, w: 0, h: 0 })
    e.preventDefault()
  }, [])

  const handleGridMouseMove = useCallback((e) => {
    if (!rubberBand.current) return
    const container = gridRef.current
    if (!container) return
    const cr = container.getBoundingClientRect()
    const curX = e.clientX - cr.left
    const curY = e.clientY - cr.top + container.scrollTop
    const { startX, startY } = rubberBand.current
    const rect = {
      x: Math.min(startX, curX),
      y: Math.min(startY, curY),
      w: Math.abs(curX - startX),
      h: Math.abs(curY - startY),
    }
    setRubberRect(rect)
    if (rect.w < 6 && rect.h < 6) return
    // Il drag su sfondo vuoto attiva la modalita' selezione anche se non era stata
    // attivata esplicitamente dal tasto in toolbar
    setSelectionMode(m => m || true)
    // Hit-test all cards
    const cards = container.querySelectorAll('[data-photo-id]')
    const newSelected = new Set()
    cards.forEach(card => {
      const r = card.getBoundingClientRect()
      const cardX = r.left - cr.left
      const cardY = r.top - cr.top + container.scrollTop
      if (
        cardX < rect.x + rect.w &&
        cardX + r.width > rect.x &&
        cardY < rect.y + rect.h &&
        cardY + r.height > rect.y
      ) {
        newSelected.add(card.dataset.photoId)
      }
    })
    setSelectedIds(newSelected)
  }, [setSelectionMode, setSelectedIds])

  const wasDragging = useRef(false)

  const handleGridMouseUp = useCallback(() => {
    wasDragging.current = rubberRect !== null && (rubberRect?.w > 4 || rubberRect?.h > 4)
    rubberBand.current = null
    setRubberRect(null)
  }, [rubberRect])

  useEffect(() => {
    window.addEventListener('mouseup', handleGridMouseUp)
    return () => window.removeEventListener('mouseup', handleGridMouseUp)
  }, [handleGridMouseUp])

  // Consume a "view results" hand-off from a similarity balloon that may have
  // been triggered/completed while on a different page.
  useEffect(() => {
    if (!pendingView) return
    pushView()
    setSimilarTo(pendingView.refPhoto)
    setSimilarResults(pendingView.results)
    setGlobalResults(null)
    setGlobalQuery('')
    consumePendingView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingView])

  // Thin wrappers: the state/network logic lives in SearchStateContext so it
  // survives navigating away and back; only the router (URL query params)
  // and the grid scroll-reset need to stay page-local.
  const selectFolder = useCallback(async (folderId, folderName, pushHistory = true) => {
    if (folderId === 'root') setSearchParams({}, { replace: true })
    else setSearchParams({ folder: folderId, name: folderName }, { replace: true })
    if (gridRef.current) gridRef.current.scrollTop = 0
    await ctxSelectFolder(folderId, folderName, pushHistory)
  }, [ctxSelectFolder, setSearchParams])

  const handleTreeSelect = useCallback((folder, siblingIds = []) => {
    handleTreeToggle(folder, siblingIds)
    selectFolder(folder.id, folder.name)
  }, [handleTreeToggle, selectFolder])

  const handleFolderJump = useCallback((photo) => ctxHandleFolderJump(photo), [ctxHandleFolderJump])

  const handleGlobalSearch = useCallback((q) => {
    if (gridRef.current) gridRef.current.scrollTop = 0
    ctxHandleGlobalSearch(q)
  }, [ctxHandleGlobalSearch])

  // Bootstrap once per app session: load root + optionally restore folder from URL.
  // Guarded internally so re-entering /search doesn't re-fetch/reset state.
  useEffect(() => {
    bootstrap(searchParams.get('folder'), searchParams.get('name') || 'Cartella')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restore grid scroll position on (re-)mount, persist it on scroll
  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = gridScrollTopRef.current
  }, [gridScrollTopRef])
  const handleGridScroll = useCallback((e) => {
    gridScrollTopRef.current = e.currentTarget.scrollTop
  }, [gridScrollTopRef])

  // ── Per-folder similarity ───────────────────────────────────────────────
  const handleRotate = useCallback(async (photo) => {
    if (!photo.thumbnailLink) return
    setRotatingIds(ids => new Set([...ids, photo.id]))
    try {
      // Fetch original file
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${photo.id}?alt=media`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      })
      if (!res.ok) throw new Error('Download fallito')
      const blob = await res.blob()
      const mimeType = blob.type || photo.mimeType || 'image/jpeg'

      // Draw rotated on canvas
      const img = await createImageBitmap(blob)
      const canvas = new OffscreenCanvas(img.height, img.width)
      const ctx = canvas.getContext('2d')
      ctx.translate(img.height / 2, img.width / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      const outBlob = await canvas.convertToBlob({ type: mimeType, quality: 0.92 })

      // Upload
      await updateFileContent(auth.accessToken, photo.id, outBlob, mimeType)

      // Restore original modifiedTime
      if (photo.modifiedTime) {
        await patchFileMetadata(auth.accessToken, photo.id, { modifiedTime: photo.modifiedTime })
      }

      // Wait for Drive to regenerate thumbnail
      await new Promise(r => setTimeout(r, 3000))

      // Refresh thumbnail
      const updatedMeta = await getFileMetadata(auth.accessToken, photo.id)
      if (updatedMeta?.thumbnailLink) {
        setAllPhotos(photos => photos.map(p => p.id === photo.id ? { ...p, thumbnailLink: updatedMeta.thumbnailLink } : p))
      }
      setThumbTimestamps(ts => ({ ...ts, [photo.id]: Date.now() }))
      setRotateDoneIds(ids => new Set([...ids, photo.id]))
      setTimeout(() => setRotateDoneIds(ids => { const n = new Set(ids); n.delete(photo.id); return n }), 2000)
    } catch (e) {
      console.error('Rotate failed:', e)
    } finally {
      setRotatingIds(ids => { const n = new Set(ids); n.delete(photo.id); return n })
    }
  }, [auth.accessToken])

  const handleDelete = useCallback(async (photo) => {
    const insertIdx = allPhotos.findIndex(p => p.id === photo.id)
    setAllPhotos(photos => photos.filter(p => p.id !== photo.id))
    try { await trashFile(auth.accessToken, photo.id) } catch (e) { console.error(e) }
    if (undoToast?.timer) clearTimeout(undoToast.timer)
    const timer = setTimeout(() => setUndoToast(null), 5000)
    setUndoToast({ photo, insertIdx, timer })
  }, [auth.accessToken, allPhotos, undoToast])

  const handleUndoDelete = useCallback(async () => {
    if (!undoToast) return
    clearTimeout(undoToast.timer)
    try { await restoreFile(auth.accessToken, undoToast.photo.id) } catch (e) { console.error(e) }
    setAllPhotos(photos => {
      const next = [...photos]
      const idx = Math.min(undoToast.insertIdx, next.length)
      next.splice(idx, 0, undoToast.photo)
      return next
    })
    setUndoToast(null)
  }, [auth.accessToken, undoToast])

  const handleDownload = useCallback(async (photo) => {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${photo.id}?alt=media`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = photo.name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { console.error(e) }
  }, [auth.accessToken])

  const handleDuplicate = useCallback(async (photo) => {
    try {
      const copy = await copyFile(auth.accessToken, photo.id)
      setAllPhotos(photos => {
        const idx = photos.findIndex(p => p.id === photo.id)
        const next = [...photos]
        next.splice(idx + 1, 0, { ...photo, ...copy })
        return next
      })
    } catch (e) { console.error(e) }
  }, [auth.accessToken])

  const handleMove = useCallback(async (photo, targetFolder) => {
    const oldParentId = photo.parents?.[0]
    if (!oldParentId || oldParentId === targetFolder.id) return
    try {
      await moveFile(auth.accessToken, photo.id, targetFolder.id, oldParentId)
      setAllPhotos(photos => photos.filter(p => p.id !== photo.id))
    } catch (e) { console.error(e) }
  }, [auth.accessToken])

  const handleBulkDelete = useCallback(async (currentResults) => {
    const ids = [...selectedIds]
    setAllPhotos(photos => photos.filter(p => !selectedIds.has(p.id)))
    exitSelectionMode()
    await Promise.all(ids.map(id => trashFile(auth.accessToken, id).catch(console.error)))
  }, [auth.accessToken, selectedIds, exitSelectionMode])

  const handleBulkDownload = useCallback(async (currentResults) => {
    const photos = currentResults.filter(p => selectedIds.has(p.id))
    for (const photo of photos) {
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${photo.id}?alt=media`, {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
        })
        if (!res.ok) continue
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = photo.name; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        await new Promise(r => setTimeout(r, 300))
      } catch (e) { console.error(e) }
    }
  }, [auth.accessToken, selectedIds])

  const handleBulkMove = useCallback(async (targetFolder) => {
    const ids = new Set(selectedIds)
    setBulkMoveActive(false)
    exitSelectionMode()
    setAllPhotos(photos => {
      photos.filter(p => ids.has(p.id)).forEach(p => {
        const oldParentId = p.parents?.[0]
        if (oldParentId && oldParentId !== targetFolder.id)
          moveFile(auth.accessToken, p.id, targetFolder.id, oldParentId).catch(console.error)
      })
      return photos.filter(p => !ids.has(p.id))
    })
  }, [auth.accessToken, selectedIds, exitSelectionMode])

  const handleCreateFolder = useCallback(async (parentId, parentName) => {
    const name = window.prompt(`Nome della nuova cartella in "${parentName}":`)
    if (!name || !name.trim()) return
    try {
      const newFolder = await createFolder(auth.accessToken, name.trim(), parentId)
      setCurrentSubfolders(sf => [...sf, newFolder])
      setTreeChildren(t => ({ ...t, [parentId]: [...(t[parentId] || []), newFolder] }))
    } catch (e) {
      alert('Errore nella creazione della cartella: ' + e.message)
    }
  }, [auth.accessToken])

  const handleRenameFolder = useCallback(async (folder, newName) => {
    if (!newName.trim() || newName === folder.name) return
    try {
      await renameFile(auth.accessToken, folder.id, newName.trim())
      const trimmed = newName.trim()
      setCurrentSubfolders(sf => sf.map(s => s.id === folder.id ? { ...s, name: trimmed } : s))
      setTreeChildren(t => {
        const c = { ...t }
        Object.keys(c).forEach(k => { c[k] = c[k].map(x => x.id === folder.id ? { ...x, name: trimmed } : x) })
        return c
      })
    } catch (e) {
      alert('Errore nel rinominare la cartella: ' + e.message)
    }
  }, [auth.accessToken])

  const handleColorFolder = useCallback(async (folder, hexColor) => {
    try {
      await patchFileMetadata(auth.accessToken, folder.id, { folderColorRgb: hexColor })
      setCurrentSubfolders(sf => sf.map(s => s.id === folder.id ? { ...s, folderColorRgb: hexColor } : s))
      setTreeChildren(t => {
        const c = { ...t }
        Object.keys(c).forEach(k => { c[k] = c[k].map(x => x.id === folder.id ? { ...x, folderColorRgb: hexColor } : x) })
        return c
      })
    } catch (e) {
      alert('Errore nel colorare la cartella: ' + e.message)
    }
  }, [auth.accessToken])

  const startUpload = useCallback((item) => {
    const targetFolderId = activeFolderId
    setUploadQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'uploading', progress: 0, error: null } : x))
    uploadFileResumable(auth.accessToken, item.file, activeFolderId, {
      onProgress: (sent, total) => {
        setUploadQueue(q => q.map(x => x.id === item.id ? { ...x, progress: total > 0 ? sent / total : 0 } : x))
      },
    }).then(newFile => {
      setUploadQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'done', progress: 1 } : x))
      if (newFile && targetFolderId === activeFolderIdRef.current) setAllPhotos(photos => [newFile, ...photos])
      setTimeout(() => {
        setUploadQueue(q => q.filter(x => x.id !== item.id))
      }, 3000)
    }).catch(err => {
      setUploadQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'error', error: err.message } : x))
    })
  }, [auth.accessToken, activeFolderId])

  const enqueueUploads = useCallback((fileList) => {
    const files = Array.from(fileList).filter(f => (f.type.startsWith('image/') || f.type.startsWith('video/')) && f.size > 0)
    if (files.length === 0) return
    const items = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file, name: file.name, progress: 0, status: 'uploading', error: null,
    }))
    setUploadQueue(q => [...q, ...items])
    items.forEach(item => startUpload(item))
  }, [startUpload])

  const retryUpload = useCallback((id) => {
    const item = uploadQueueRef.current.find(x => x.id === id)
    if (item) startUpload(item)
  }, [startUpload])

  const dismissUpload = useCallback((id) => {
    setUploadQueue(q => q.filter(x => x.id !== id))
  }, [])

  const handleDropOnFolder = useCallback(async (targetFolder, draggedPhotoId, draggedFolderId) => {
    setDragOverFolder(null)

    if (draggedFolderId) {
      if (draggedFolderId === targetFolder.id) return
      try {
        await moveFile(auth.accessToken, draggedFolderId, targetFolder.id, activeFolderId)
        setCurrentSubfolders(sf => sf.filter(s => s.id !== draggedFolderId))
        setTreeChildren(t => { const c = { ...t }; Object.keys(c).forEach(k => { c[k] = c[k].filter(x => x.id !== draggedFolderId) }); return c })
      } catch (e) { console.error('Folder move failed', e) }
      return
    }

    // Determine which photos to move: selection if active and includes dragged, otherwise just dragged
    const idsToMove = selectionMode && selectedIds.size > 0
      ? new Set([...selectedIds, ...(draggedPhotoId ? [draggedPhotoId] : [])])
      : draggedPhotoId ? new Set([draggedPhotoId]) : new Set()
    if (idsToMove.size === 0) return
    setAllPhotos(photos => {
      photos.filter(p => idsToMove.has(p.id)).forEach(p => {
        const oldParentId = p.parents?.[0]
        if (oldParentId && oldParentId !== targetFolder.id)
          moveFile(auth.accessToken, p.id, targetFolder.id, oldParentId).catch(console.error)
      })
      return photos.filter(p => !idsToMove.has(p.id))
    })
    if (selectionMode) exitSelectionMode()
  }, [auth.accessToken, selectionMode, selectedIds, exitSelectionMode, activeFolderId])

  const DRAG_MAGENTA = '#e879a0'

  const buildDragImage = useCallback((photos, count, thumbSize) => {
    const D = 64       // circle diameter
    const STEP = 22    // horizontal overlap step
    const layers = Math.min(photos.length, 3)
    const totalW = D + STEP * (layers - 1) + 24
    const totalH = D + 24

    const wrap = document.createElement('div')
    wrap.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${totalW}px;height:${totalH}px;pointer-events:none;`

    // Shadow backdrop
    const shadow = document.createElement('div')
    shadow.style.cssText = `
      position:absolute;left:8px;top:8px;
      width:${D + STEP*(layers-1)}px;height:${D}px;
      border-radius:${D}px;
      box-shadow:0 8px 28px rgba(232,121,160,0.55),0 2px 8px rgba(0,0,0,0.25);
    `
    wrap.appendChild(shadow)

    for (let i = layers - 1; i >= 0; i--) {
      const thumb = photos[i]?.thumbnailLink ? getLargeThumbUrl(photos[i].thumbnailLink, thumbSize) : ''
      const circle = document.createElement('div')
      const op = i === 0 ? 1 : i === 1 ? 0.82 : 0.6
      circle.style.cssText = `
        position:absolute;
        left:${8 + i * STEP}px;top:8px;
        width:${D}px;height:${D}px;
        border-radius:50%;
        background:#2a2a2a ${thumb ? `url('${thumb}') center/cover no-repeat` : ''};
        border:3px solid #fff;
        box-shadow:0 0 0 1.5px rgba(232,121,160,0.5);
        opacity:${op};
      `
      wrap.appendChild(circle)
    }

    if (count > 1) {
      const badge = document.createElement('div')
      badge.textContent = count
      badge.style.cssText = `
        position:absolute;top:2px;right:2px;
        width:20px;height:20px;border-radius:50%;
        background:${DRAG_MAGENTA};color:#fff;
        font-size:10px;font-weight:800;font-family:sans-serif;
        display:flex;align-items:center;justify-content:center;
        border:2px solid #fff;
        box-shadow:0 2px 6px rgba(232,121,160,0.55);
      `
      wrap.appendChild(badge)
    }

    document.body.appendChild(wrap)
    return wrap
  }, [])

  const handleDragStart = useCallback((e, photo, allResults, thumbSize) => {
    e.dataTransfer.setData('photoId', photo.id)
    e.dataTransfer.effectAllowed = 'move'
    const count = selectionMode && selectedIds.size > 0 ? selectedIds.size : 1
    // Pick up to 3 photos with thumbnails for the pile (dragged photo first, then other selected)
    let photos = [photo]
    if (selectionMode && selectedIds.size > 1 && allResults) {
      const others = allResults.filter(p => selectedIds.has(p.id) && p.id !== photo.id && p.thumbnailLink)
      photos = [photo, ...others].slice(0, 3)
    }
    const ghost = buildDragImage(photos, count, thumbSize)
    const cx = Math.round(8 + (Math.min(photos.length, 3) - 1) * 22 / 2 + 32)
    e.dataTransfer.setDragImage(ghost, cx, 40)
    setTimeout(() => document.body.removeChild(ghost), 0)
    setIsDraggingPhotos(true)
  }, [selectionMode, selectedIds, buildDragImage])

  const handleDragEnd = useCallback(() => {
    setDragOverFolder(null)
    setIsDraggingPhotos(false)
  }, [])

  const handleFolderGridEnter = useCallback((e, folder) => {
    folderCursorRef.current = { x: e.clientX, y: e.clientY }
    activeFolderRef.current = folder.id
    clearTimeout(folderHoverTimer.current)
    if (Date.now() < tooltipSuppressUntilRef.current) return
    folderHoverTimer.current = setTimeout(async () => {
      try {
        if (activeFolderRef.current !== folder.id) return
        if (Date.now() < tooltipSuppressUntilRef.current) return
        let items = folderFileCache.current[folder.id]
        if (!items) {
          const data = await listFiles(auth.accessToken, folder.id)
          items = (data.files || [])
            .filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
            .slice(0, 12)
            .map(f => ({ name: f.name, thumb: f.thumbnailLink || null }))
          folderFileCache.current[folder.id] = items
        }
        if (activeFolderRef.current !== folder.id) return
        if (items.length > 0) {
          const { x, y } = folderCursorRef.current
          const TW = 300, TH = 260
          const tx = x + 16 + TW > window.innerWidth ? x - TW - 8 : x + 16
          const ty = y + 16 + TH > window.innerHeight ? y - TH - 8 : y + 16
          setFolderTooltip({ items, x: tx, y: ty })
        }
      } catch { /* non-critical */ }
    }, 69)
  }, [auth.accessToken])

  const handleFolderGridMove = useCallback((e) => {
    folderCursorRef.current = { x: e.clientX, y: e.clientY }
    setFolderTooltip(t => {
      if (!t) return null
      const TW = 300, TH = 260
      const x = e.clientX + 16 + TW > window.innerWidth ? e.clientX - TW - 8 : e.clientX + 16
      const y = e.clientY + 16 + TH > window.innerHeight ? e.clientY - TH - 8 : e.clientY + 16
      return { ...t, x, y }
    })
  }, [])

  const handleFolderGridLeave = useCallback(() => {
    activeFolderRef.current = null
    clearTimeout(folderHoverTimer.current)
    setFolderTooltip(null)
  }, [])

  const handleRename = useCallback(async (photo, newName) => {
    if (!newName.trim() || newName === photo.name) return
    try {
      await renameFile(auth.accessToken, photo.id, newName.trim())
      setAllPhotos(photos => photos.map(p => p.id === photo.id ? { ...p, name: newName.trim() } : p))
    } catch (e) { console.error(e) }
  }, [auth.accessToken])

  const handleSimilarity = useCallback((photo) => {
    ctxHandleSimilarity(photo, allPhotos)
  }, [ctxHandleSimilarity, allPhotos])

  // ── Global similarity ───────────────────────────────────────────────────
  const handleGlobalSimilarity = useCallback((photo, scopeFolder) => {
    ctxHandleGlobalSimilarity(photo, scopeFolder)
  }, [ctxHandleGlobalSimilarity])

  // ── Results ─────────────────────────────────────────────────────────────
  const videoFiles = useMemo(() => allPhotos.filter(f => isVideoFile(f)), [allPhotos])

  const results = useMemo(() => {
    let list = globalResults !== null ? globalResults : similarTo ? similarResults : allPhotos
    if (mediaFilter === 'video') list = list.filter(f => isVideoFile(f))
    else if (mediaFilter === 'gif') list = list.filter(f => getExt(f.name) === '.gif')
    else if (mediaFilter === 'img') list = list.filter(f => !isVideoFile(f) && getExt(f.name) !== '.gif')
    if (sortOrder === 'name') {
      list = [...list].sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
    } else if (sortOrder === 'extension') {
      list = [...list].sort((a, b) => {
        const diff = getExt(a.name).localeCompare(getExt(b.name))
        return sortDir === 'asc' ? diff : -diff
      })
    } else if (sortOrder === 'size') {
      list = [...list].sort((a, b) => {
        const diff = Number(a.size || 0) - Number(b.size || 0)
        return sortDir === 'asc' ? diff : -diff
      })
    } else {
      list = [...list].sort((a, b) => {
        const diff = new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0)
        return sortDir === 'desc' ? diff : -diff
      })
    }
    return list
  }, [allPhotos, similarTo, similarResults, globalResults, sortOrder, sortDir, mediaFilter])

  const [masonryCols, setMasonryCols] = useState(() => computeMasonryCols())
  useEffect(() => {
    const onResize = () => setMasonryCols(computeMasonryCols())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const masonryColumns = useMemo(() => {
    const cols = Array.from({ length: masonryCols }, () => [])
    results.forEach((photo, idx) => cols[idx % masonryCols].push({ photo, idx }))
    return cols
  }, [results, masonryCols])

  const renderMasonryCard = (photo, idx) => (
    <div
      key={photo.id}
      data-photo-id={photo.id}
      className={`masonry-card${selectedIds.has(photo.id) ? ' selected' : ''}`}
      onClick={() => { if (selectionMode) { if (!wasDragging.current) toggleSelection(photo.id) } else if (!renameMode) setSlideshowIdx(idx) }}
      onContextMenu={e => { e.preventDefault(); setContextMenu({ photo, idx, x: e.clientX, y: e.clientY }) }}
      draggable={canDragToFolders}
      onDragStart={e => handleDragStart(e, photo, results, 1600)}
      onDragEnd={handleDragEnd}
    >
      {photo.thumbnailLink ? (
        <LazyPhoto
          key={thumbTimestamps[photo.id] || photo.id}
          src={getLargeThumbUrl(photo.thumbnailLink, 1000)}
          alt={photo.name}
          className="masonry-img"
        />
      ) : (
        <div className="masonry-no-thumb">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
        </div>
      )}
      {isVideoFile(photo) && (
        <>
          <div className="video-icon-badge">
            <IconVideoFile />
            {photo.videoMediaMetadata?.durationMillis && (
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.2, lineHeight: 1 }}>{formatDuration(photo.videoMediaMetadata.durationMillis)}</span>
            )}
          </div>
          <div className="masonry-video-hover">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
            <span className="masonry-video-label">Play video</span>
            <span className="masonry-video-meta">
              {[formatDuration(photo.videoMediaMetadata?.durationMillis), formatSize(photo.size)].filter(Boolean).join(' · ')}
            </span>
          </div>
        </>
      )}
      {similarTo && photo._dist !== undefined && photo._dist === 0 && (
        <div className="search-similar-badge">identica</div>
      )}
      {!selectionMode && !renameMode && <div className="thumb-overlay" onClick={e => e.stopPropagation()}>
        <button className="thumb-overlay-btn" title="Vai alla cartella" onClick={() => handleFolderJump(photo)}><IconFolderJump /></button>
        {photo.thumbnailLink && (
          <button className="thumb-overlay-btn" title="Crop" onClick={() => setCropPhoto(photo)}><IconCrop /></button>
        )}
        {photo.thumbnailLink && (
          <button className="thumb-overlay-btn" title="Enhance (AI upscale)" onClick={() => setEnhancePhoto(photo)}><IconEnhance /></button>
        )}
        {photo.thumbnailLink && (
          <button className="thumb-overlay-btn" title="Ruota 90° sx" onClick={() => handleRotate(photo)}><IconRotateCCW /></button>
        )}
        <button className="thumb-overlay-btn" title="Altre azioni" onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setContextMenu({ photo, idx, x: r.left, y: r.bottom + 4 }) }}><IconDots /></button>
      </div>}
      {selectionMode && (
        <div className={`selection-check${selectedIds.has(photo.id) ? ' checked' : ''}`} />
      )}
      {renameMode && (
        <div className="rename-inline-overlay" onClick={e => e.stopPropagation()}>
          <div className="rename-inline-row">
            <input
              className="rename-inline-input"
              value={renameDrafts[photo.id] ?? getBaseName(photo.name)}
              onChange={e => setRenameDrafts(d => ({ ...d, [photo.id]: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const draft = renameDrafts[photo.id] ?? getBaseName(photo.name)
                  const ext = getExt(photo.name)
                  const newName = (draft.trim() || getBaseName(photo.name)) + ext
                  if (newName !== photo.name) handleRename(photo, newName)
                }
                if (e.key === 'Escape') setRenameDrafts(d => ({ ...d, [photo.id]: getBaseName(photo.name) }))
              }}
              onClick={e => e.stopPropagation()}
            />
            <button
              className="rename-inline-clear"
              onMouseDown={e => { e.preventDefault(); setRenameDrafts(d => ({ ...d, [photo.id]: '' })); e.currentTarget.previousSibling.focus() }}
              title="Svuota"
            >✕</button>
          </div>
        </div>
      )}
      {(croppingIds.has(photo.id) || cropDoneIds.has(photo.id) || rotatingIds.has(photo.id) || rotateDoneIds.has(photo.id)) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (croppingIds.has(photo.id) || rotatingIds.has(photo.id)) ? 'rgba(0,0,0,0.55)' : 'rgba(16,185,129,0.7)', borderRadius: 8, pointerEvents: 'none', transition: 'background 0.3s' }}>
          {(croppingIds.has(photo.id) || rotatingIds.has(photo.id)) ? (
            <svg style={{ animation: 'spin 0.9s linear infinite' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          ) : (
            <span style={{ color: 'white', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>✓ Salvato</span>
          )}
        </div>
      )}
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────
  const rootFolders = treeChildren['root'] || []
  const showSubfolderSidebar = currentSubfolders.length > 0 && globalResults === null && similarTo === null
  const canDragToFolders = globalResults === null && similarTo === null

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="search-page-bg">
      {/* Header */}
      <motion.div variants={fadeItem} className="header" style={{ padding: '12px 24px', flexShrink: 0, marginBottom: 0, justifyContent: 'flex-end' }}>
        <div className="header-actions">
          <button onClick={onToggleTheme} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0 }} title="Tema">
            {isDark ? <IconSun /> : <IconMoon />}
          </button>
          <PalettePicker colorScheme={colorScheme} onChangeScheme={onChangeScheme} isDark={isDark} />
          <button onClick={() => setShowStatus(true)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0 }} title="Stato sistema">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </button>
          <UserMenu email={auth.email} avatarUrl={auth.picture} onLogout={onLogout} />
        </div>
      </motion.div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Sidebar — tree */}
        <motion.div variants={fadeItem} className="search-sidebar">
          <div className="tree-list">
            {/* Tree root label */}
            <div
              className={`tree-node tree-root${activeFolderId === 'root' ? ' active' : ''}`}
              onClick={() => selectFolder('root', 'My Drive')}
            >
              <span className="tree-folder-icon"><IconFolder /></span>
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
                dragOverFolder={dragOverFolder}
                setDragOverFolder={setDragOverFolder}
                onDropPhoto={handleDropOnFolder}
                onContextMenu={(folder, e) => setFolderContextMenu({ folder, x: e.clientX, y: e.clientY })}
              />
            ))}

            {treeLoading['root'] && (
              <div style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>Caricamento...</div>
            )}
          </div>
        </motion.div>

        {/* Main */}
        <motion.div variants={fadeItem} className="search-main">
          {/* Search bar + toolbar */}
          <div className="search-bar-row">
            <div style={{ position: 'relative', width: '19%', flexShrink: 0 }}>
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
                <div
                  key={key}
                  style={{ position: 'relative' }}
                  onMouseEnter={key === 'list' ? () => {
                    columnMenuHoverTimer.current = setTimeout(() => setShowColumnMenu(true), 1360)
                  } : undefined}
                  onMouseLeave={key === 'list' ? () => {
                    clearTimeout(columnMenuHoverTimer.current)
                    setShowColumnMenu(false)
                  } : undefined}
                >
                  <button
                    onClick={() => setThumbSize(key)}
                    className={`thumb-size-btn${thumbSize === key ? ' active' : ''}`}
                    title={label}
                  >
                    <Icon />
                  </button>
                  {key === 'list' && showColumnMenu && (
                    <div
                      style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
                        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                        boxShadow: '0 8px 28px rgba(0,0,0,0.22)', padding: '6px', minWidth: 170,
                      }}
                    >
                      {LIST_COLUMNS.filter(c => !c.alwaysVisible && c.key !== 'thumb').map(c => (
                        <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', fontSize: 12.5, color: 'var(--text-primary)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!listColumnsVisible[c.key]} onChange={() => toggleListColumn(c.key)} />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px', alignSelf: 'center' }} />
              {thumbSize !== 'list' && (
                <>
                  <button
                    onClick={() => {
                      if (sortOrder === 'name') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                      else { setSortOrder('name'); setSortDir('asc') }
                    }}
                    className={`thumb-size-btn${sortOrder === 'name' ? ' active' : ''}`}
                    title={sortOrder === 'name' ? (sortDir === 'asc' ? 'Ordina per nome (A→Z)' : 'Ordina per nome (Z→A)') : 'Ordina per nome'}
                  >
                    <IconSortName /> {sortOrder === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => {
                      if (sortOrder === 'modified') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                      else { setSortOrder('modified'); setSortDir('desc') }
                    }}
                    className={`thumb-size-btn${sortOrder === 'modified' ? ' active' : ''}`}
                    title={sortOrder === 'modified' ? (sortDir === 'desc' ? 'Ordina per data (più recenti prima)' : 'Ordina per data (più vecchie prima)') : 'Ordina per data modifica'}
                  >
                    <IconSortDate /> {sortOrder === 'modified' && (sortDir === 'desc' ? '↓' : '↑')}
                  </button>
                </>
              )}
              <button onClick={() => setShowStats(true)} className="thumb-size-btn" title="Statistiche cartella">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
                </svg>
              </button>
              <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px', alignSelf: 'center' }} />
              {(() => {
                const CYCLE = ['all','video','gif','img']
                const ICONS = {
                  all:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
                  video: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
                  gif:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M9 9H6v6h3v-2H8"/><line x1="12" y1="9" x2="12" y2="15"/><path d="M15 9h3v2h-3v2h3"/></svg>,
                  img:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
                }
                const LABELS = { all: 'Tutti i file', video: 'Solo video', gif: 'Solo GIF', img: 'Solo immagini' }
                const next = () => setMediaFilter(f => CYCLE[(CYCLE.indexOf(f) + 1) % CYCLE.length])
                return (
                  <button
                    onClick={next}
                    className={`thumb-size-btn${mediaFilter !== 'all' ? ' active' : ''}`}
                    title={LABELS[mediaFilter]}
                  >
                    {ICONS[mediaFilter]}
                  </button>
                )
              })()}
              <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px', alignSelf: 'center' }} />
              {currentSubfolders.length > 0 && globalResults === null && similarTo === null && (
                <button
                  onClick={() => setShowSubfolders(v => !v)}
                  className={`thumb-size-btn${showSubfolders ? ' active' : ''}`}
                  title={showSubfolders ? 'Nascondi sottocartelle' : 'Mostra sottocartelle'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
                  </svg>
                </button>
              )}
              <button
                onClick={() => handleCreateFolder(activeFolderId, activeFolderName)}
                className="thumb-size-btn"
                title="Nuova cartella qui"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
                  <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
                </svg>
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={e => { enqueueUploads(e.target.files); e.target.value = '' }}
              />
              <button
                onClick={() => uploadInputRef.current?.click()}
                className="thumb-size-btn"
                title="Carica file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </button>
              <button
                onClick={() => { setRenameMode(m => !m); setRenameDrafts({}); setSelectionMode(false); setSelectedIds(new Set()) }}
                className={`thumb-size-btn${renameMode ? ' active' : ''}`}
                title={renameMode ? 'Esci dal rename rapido' : 'Rinomina rapido'}
              >
                <IconPencilLine />
              </button>
              <button
                onClick={() => { setSelectionMode(m => !m); setSelectedIds(new Set()); setBulkDeleteConfirm(false); setRenameMode(false); setRenameDrafts({}) }}
                className={`thumb-size-btn${selectionMode ? ' active' : ''}`}
                title={selectionMode ? 'Esci dalla selezione' : 'Seleziona foto'}
              >
                <IconCheckSquare />
              </button>
              {selectionMode && (
                <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginLeft: 2, whiteSpace: 'nowrap' }}>
                  {selectedIds.size > 0 ? `${selectedIds.size} sel.` : 'Seleziona'}
                </span>
              )}
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
                {navHistory.slice(0, 5).map(entry => (
                  <button key={entry.key} className="history-tag" onClick={() => {
                    if (entry.snapshot) {
                      restoreState(entry.snapshot)
                    } else if (entry.type === 'folder') {
                      selectFolder(entry.folderId, entry.label)
                    } else if (entry.type === 'search') {
                      handleGlobalSearch(entry.query)
                    }
                  }} title={entry.label}>
                    <NavHistoryIcon type={entry.type} />
                    <span>{entry.label}</span>
                  </button>
                ))}
                {navHistory.length > 5 && (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      className="history-tag"
                      style={{ maxWidth: 'none', padding: '7px 10px', letterSpacing: 1 }}
                      onClick={() => setShowHistoryOverflow(v => !v)}
                      title={`${navHistory.length - 5} precedenti`}
                    >···</button>
                    {showHistoryOverflow && (
                      <div
                        style={{
                          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                          padding: '6px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 160,
                        }}
                        onMouseLeave={() => setShowHistoryOverflow(false)}
                      >
                        {navHistory.slice(5).map(entry => (
                          <button key={entry.key} className="history-tag"
                            style={{ maxWidth: '100%', borderRadius: 7 }}
                            onClick={() => {
                              setShowHistoryOverflow(false)
                              if (entry.snapshot) restoreState(entry.snapshot)
                              else if (entry.type === 'folder') selectFolder(entry.folderId, entry.label)
                              else if (entry.type === 'search') handleGlobalSearch(entry.query)
                            }} title={entry.label}>
                            <NavHistoryIcon type={entry.type} />
                            <span>{entry.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {!similarTo && (
              <button
                className="btn-secondary"
                onClick={handleRefreshGrid}
                disabled={loading || globalLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 10px' }}
                title="Ricarica"
              >
                <span style={{ display: 'flex', animation: (loading || globalLoading) ? 'spin 0.9s linear infinite' : 'none' }}><IconRefresh /></span>
              </button>
            )}
            {videoFiles.length >= 2 && (
              <button
                className="btn-secondary"
                onClick={() => openWizard(videoFiles, activeFolderId, activeFolderName)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 10px' }}
                title="Monta video"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><polygon points="10,8 16,12 10,16"/></svg>
                Monta video
              </button>
            )}
          </div>

          {/* Similarity banner */}
          {similarTo && (
            <div className="similarity-active-banner">
              <img src={similarTo.thumbnailLink} style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
              <span>Simili a <strong>{similarTo.name}</strong> — {similarResults.length} trovate</span>
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
          <div className="content-area">
            {showSubfolderSidebar && showSubfolders && (
              <motion.div key={activeFolderId} className={thumbSize === 'list' ? 'subfolder-list' : 'subfolder-grid'} variants={staggerContainerFast} initial="hidden" animate="visible">
                {currentSubfolders.map(f => (
                  <motion.div
                    key={f.id}
                    variants={slideFadeItem}
                    role="button"
                    tabIndex={0}
                    className={thumbSize === 'list'
                      ? `list-row list-row-folder${dragOverFolder === f.id ? ' drop-target' : ''}`
                      : `subfolder-grid-item${dragOverFolder === f.id ? ' drop-target' : ''}`}
                    style={thumbSize !== 'list' && f.folderColorRgb ? { borderColor: f.folderColorRgb } : undefined}
                    onClick={() => {
                      activeFolderRef.current = null
                      clearTimeout(folderHoverTimer.current)
                      setFolderTooltip(null)
                      tooltipSuppressUntilRef.current = Date.now() + 1200
                      selectFolder(f.id, f.name)
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectFolder(f.id, f.name) } }}
                    draggable
                    onMouseDown={() => { clearTimeout(folderHoverTimer.current); setFolderTooltip(null) }}
                    onDragStart={e => { setFolderTooltip(null); e.dataTransfer.setData('folderId', f.id); e.dataTransfer.effectAllowed = 'move' }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolder(f.id) }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverFolder(null) }}
                    onDrop={e => { e.preventDefault(); handleDropOnFolder(f, e.dataTransfer.getData('photoId') || null, e.dataTransfer.getData('folderId') || null) }}
                    onContextMenu={e => { e.preventDefault(); setFolderTooltip(null); setFolderContextMenu({ folder: f, x: e.clientX, y: e.clientY }) }}
                  >
                    {thumbSize === 'list' ? (
                      <>
                        <div className="list-cell list-cell-thumb">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill={f.folderColorRgb || '#f59e0b'} stroke="none"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
                        </div>
                        <div className="list-cell list-cell-name" style={{ width: columnWidth(LIST_COLUMNS[1]) }}>{f.name}</div>
                        {listColumnsVisible.size && (
                          <div className="list-cell" style={{ width: columnWidth(LIST_COLUMNS[2]) }}>
                            {typeof f._fileCount === 'number' ? `${f._fileCount} file` : '—'}
                          </div>
                        )}
                        {listColumnsVisible.ext && (
                          <div className="list-cell" style={{ width: columnWidth(LIST_COLUMNS[3]) }} />
                        )}
                        {listColumnsVisible.date && (
                          <div className="list-cell list-cell-date" style={{ width: columnWidth(LIST_COLUMNS[4]) }}>
                            {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ''}
                          </div>
                        )}
                        <div className="list-row-actions-cell">
                          <button
                            className="list-row-actions"
                            onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setFolderContextMenu({ folder: f, x: r.left, y: r.bottom + 4 }) }}
                            title="Altre azioni"
                          >
                            <IconDots />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={f.folderColorRgb || 'none'} stroke={f.folderColorRgb || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: f.folderColorRgb ? 1 : 0.6 }}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
                        <span>{f.name}</span>
                        <div
                          className="subfolder-preview-trigger"
                          onClick={e => { e.stopPropagation(); setFolderTooltipMode(m => m === 'grid' ? 'list' : 'grid') }}
                          onMouseDown={e => e.stopPropagation()}
                          onMouseEnter={e => handleFolderGridEnter(e, f)}
                          onMouseMove={handleFolderGridMove}
                          onMouseLeave={handleFolderGridLeave}
                        >
                          <IconEye />
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          {loading ? (
            <div className="search-empty" style={{ flex: 1 }}><span>Caricamento...</span></div>
          ) : results.length === 0 ? (
            <div className="search-empty" style={{ flex: 1 }}>
              <IconSearch />
              <span>{allPhotos.length === 0 ? 'Nessuna foto in questa cartella' : 'Nessun risultato'}</span>
            </div>
          ) : (
            <div
              ref={gridRef}
              className={`${thumbSize === 'masonry' ? 'search-masonry-scroll' : 'search-grid-scroll'}${isDraggingPhotos ? ' dragging-active' : ''}`}
              onMouseDown={handleGridMouseDown}
              onMouseMove={handleGridMouseMove}
              onScroll={handleGridScroll}
              onClick={e => {
                if (wasDragging.current) return
                if (e.target.closest('[data-photo-id]')) return
                if (selectionMode) exitSelectionMode()
              }}
              onContextMenu={e => {
                if (e.target.closest('[data-photo-id]')) return
                e.preventDefault()
                setGridContextMenu({ x: e.clientX, y: e.clientY })
              }}
              onDragOver={e => {
                if (!e.dataTransfer.types.includes('Files')) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
                setIsDraggingFilesOver(true)
              }}
              onDragLeave={e => {
                if (!e.dataTransfer.types.includes('Files')) return
                if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingFilesOver(false)
              }}
              onDrop={e => {
                if (!e.dataTransfer.types.includes('Files')) return
                e.preventDefault()
                setIsDraggingFilesOver(false)
                enqueueUploads(e.dataTransfer.files)
              }}
              style={{
                ...(selectionMode ? { userSelect: 'none' } : {}),
                position: 'relative',
                ...(isDraggingFilesOver ? { outline: '2px dashed var(--primary)', outlineOffset: -8 } : {}),
              }}
            >
              {rubberRect && rubberRect.w > 4 && rubberRect.h > 4 && (
                <div className="rubber-band" style={{ left: rubberRect.x, top: rubberRect.y, width: rubberRect.w, height: rubberRect.h }} />
              )}
              {thumbSize === 'masonry' ? (
                <div className="search-masonry">
                  {masonryColumns.map((colItems, colIdx) => (
                    <div key={colIdx} className="masonry-column">
                      {colItems.map(({ photo, idx }) => renderMasonryCard(photo, idx))}
                    </div>
                  ))}
                </div>
              ) : thumbSize === 'list' ? (
                <div className="list-view">
                  <div className="list-header">
                    <div className="list-cell list-cell-thumb">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                    <div
                      className="list-cell list-cell-name list-header-cell"
                      style={{ width: columnWidth(LIST_COLUMNS[1]) }}
                      onClick={() => { if (sortOrder === 'name') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortOrder('name'); setSortDir('asc') } }}
                    >
                      Nome {sortOrder === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                    </div>
                    {listColumnsVisible.size && (
                      <div
                        className="list-cell list-header-cell"
                        style={{ width: columnWidth(LIST_COLUMNS[2]), position: 'relative' }}
                        onClick={() => { if (sortOrder === 'size') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortOrder('size'); setSortDir('asc') } }}
                      >
                        Dimensione {sortOrder === 'size' && (sortDir === 'asc' ? '↑' : '↓')}
                        <div className="list-col-resize" onMouseDown={e => { e.stopPropagation(); handleColumnResizeStart(e, LIST_COLUMNS[2]) }} />
                      </div>
                    )}
                    {listColumnsVisible.ext && (
                      <div
                        className="list-cell list-header-cell"
                        style={{ width: columnWidth(LIST_COLUMNS[3]), position: 'relative' }}
                        onClick={() => { if (sortOrder === 'extension') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortOrder('extension'); setSortDir('asc') } }}
                      >
                        Estensione {sortOrder === 'extension' && (sortDir === 'asc' ? '↑' : '↓')}
                        <div className="list-col-resize" onMouseDown={e => { e.stopPropagation(); handleColumnResizeStart(e, LIST_COLUMNS[3]) }} />
                      </div>
                    )}
                    {listColumnsVisible.date && (
                      <div
                        className="list-cell list-cell-date list-header-cell"
                        style={{ width: columnWidth(LIST_COLUMNS[4]), position: 'relative' }}
                        onClick={() => { if (sortOrder === 'modified') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortOrder('modified'); setSortDir('desc') } }}
                      >
                        Data modifica {sortOrder === 'modified' && (sortDir === 'desc' ? '↓' : '↑')}
                        <div className="list-col-resize" onMouseDown={e => { e.stopPropagation(); handleColumnResizeStart(e, LIST_COLUMNS[4]) }} />
                      </div>
                    )}
                  </div>
                  {results.map((photo, idx) => (
                    <div
                      key={photo.id}
                      data-photo-id={photo.id}
                      className={`list-row${selectedIds.has(photo.id) ? ' selected' : ''}`}
                      onClick={() => { if (selectionMode) { if (!wasDragging.current) toggleSelection(photo.id) } else if (!renameMode) setSlideshowIdx(idx) }}
                      onContextMenu={e => { e.preventDefault(); setContextMenu({ photo, idx, x: e.clientX, y: e.clientY }) }}
                      draggable={canDragToFolders}
                      onDragStart={e => handleDragStart(e, photo, results, 144)}
                      onDragEnd={() => setDragOverFolder(null)}
                    >
                      <div className="list-cell list-cell-thumb">
                        {photo.thumbnailLink ? (
                          <LazyPhoto
                            key={thumbTimestamps[photo.id] || photo.id}
                            src={getLargeThumbUrl(photo.thumbnailLink, 72)}
                            alt={photo.name}
                            className="list-thumb-img"
                          />
                        ) : (
                          <div className="list-thumb-empty">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
                          </div>
                        )}
                        {isVideoFile(photo) && (
                          <div className="list-video-badge"><IconVideoFile /></div>
                        )}
                      </div>
                      {renameMode ? (
                        <div className="list-cell list-cell-name" style={{ width: columnWidth(LIST_COLUMNS[1]) }} onClick={e => e.stopPropagation()}>
                          <input
                            className="rename-inline-input"
                            value={renameDrafts[photo.id] ?? getBaseName(photo.name)}
                            onChange={e => setRenameDrafts(d => ({ ...d, [photo.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const draft = renameDrafts[photo.id] ?? getBaseName(photo.name)
                                const ext = getExt(photo.name)
                                const newName = (draft.trim() || getBaseName(photo.name)) + ext
                                if (newName !== photo.name) handleRename(photo, newName)
                              }
                              if (e.key === 'Escape') setRenameDrafts(d => ({ ...d, [photo.id]: getBaseName(photo.name) }))
                            }}
                          />
                        </div>
                      ) : (
                        <div className="list-cell list-cell-name" style={{ width: columnWidth(LIST_COLUMNS[1]) }} title={photo.name}>{photo.name}</div>
                      )}
                      {listColumnsVisible.size && (
                        <div className="list-cell" style={{ width: columnWidth(LIST_COLUMNS[2]) }}>{formatSize(photo.size) || ''}</div>
                      )}
                      {listColumnsVisible.ext && (
                        <div className="list-cell" style={{ width: columnWidth(LIST_COLUMNS[3]) }}>{getExt(photo.name).replace('.', '').toUpperCase()}</div>
                      )}
                      {listColumnsVisible.date && (
                        <div className="list-cell list-cell-date" style={{ width: columnWidth(LIST_COLUMNS[4]) }}>
                          {photo.modifiedTime ? new Date(photo.modifiedTime).toLocaleDateString() : ''}
                        </div>
                      )}
                      {selectionMode && (
                        <div className={`selection-check${selectedIds.has(photo.id) ? ' checked' : ''}`} />
                      )}
                      {!selectionMode && !renameMode && (
                        <div className="list-row-actions-cell">
                          <button
                            className="list-row-actions"
                            onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setContextMenu({ photo, idx, x: r.left, y: r.bottom + 4 }) }}
                            title="Altre azioni"
                          >
                            <IconDots />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="search-grid" style={{ '--thumb-size': `${THUMB_SIZES[thumbSize]}px` }}>
                {results.map((photo, idx) => (
                  <div
                    key={photo.id}
                    data-photo-id={photo.id}
                    className={`thumb-card${selectedIds.has(photo.id) ? ' selected' : ''}`}
                    onClick={() => { if (selectionMode) { if (!wasDragging.current) toggleSelection(photo.id) } else if (!renameMode) setSlideshowIdx(idx) }}
                    onContextMenu={e => { e.preventDefault(); setContextMenu({ photo, idx, x: e.clientX, y: e.clientY }) }}
                    draggable={canDragToFolders}
                    onDragStart={e => handleDragStart(e, photo, results, THUMB_SIZES[thumbSize] * 2)}
                    onDragEnd={() => setDragOverFolder(null)}
                  >
                    {photo.thumbnailLink ? (
                      <LazyPhoto
                        key={thumbTimestamps[photo.id] || photo.id}
                        src={getLargeThumbUrl(photo.thumbnailLink, THUMB_SIZES[thumbSize] * 2)}
                        alt={photo.name}
                        className="thumb-img"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <div className="thumb-no-preview">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
                      </div>
                    )}
                    {isVideoFile(photo) && (
                      <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.55)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3, padding: '2px 5px 2px 3px', color: 'white', pointerEvents: 'none' }}>
                        <IconVideoFile />
                        {photo.videoMediaMetadata?.durationMillis && (
                          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2, lineHeight: 1 }}>{formatDuration(photo.videoMediaMetadata.durationMillis)}</span>
                        )}
                      </div>
                    )}
                    {similarTo && photo._dist !== undefined && photo._dist === 0 && (
                      <div className="search-similar-badge">identica</div>
                    )}
                    {!selectionMode && !renameMode && <div className="thumb-overlay" onClick={e => e.stopPropagation()}>
                      <button className="thumb-overlay-btn" title="Vai alla cartella" onClick={() => handleFolderJump(photo)}><IconFolderJump /></button>
                      {photo.thumbnailLink && (
                        <button className="thumb-overlay-btn" title="Crop" onClick={() => setCropPhoto(photo)}><IconCrop /></button>
                      )}
                      {photo.thumbnailLink && (
                        <button className="thumb-overlay-btn" title="Ruota 90° sx" onClick={() => handleRotate(photo)}><IconRotateCCW /></button>
                      )}
                      <button className="thumb-overlay-btn" title="Altre azioni" onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setContextMenu({ photo, idx, x: r.left, y: r.bottom + 4 }) }}><IconDots /></button>
                    </div>}
                    {selectionMode && (
                      <div className={`selection-check${selectedIds.has(photo.id) ? ' checked' : ''}`} />
                    )}
                    {renameMode && (
                      <div className="rename-inline-overlay" onClick={e => e.stopPropagation()}>
                        <div className="rename-inline-row">
                          <input
                            className="rename-inline-input"
                            value={renameDrafts[photo.id] ?? getBaseName(photo.name)}
                            onChange={e => setRenameDrafts(d => ({ ...d, [photo.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const draft = renameDrafts[photo.id] ?? getBaseName(photo.name)
                                const ext = getExt(photo.name)
                                const newName = (draft.trim() || getBaseName(photo.name)) + ext
                                if (newName !== photo.name) handleRename(photo, newName)
                              }
                              if (e.key === 'Escape') setRenameDrafts(d => ({ ...d, [photo.id]: getBaseName(photo.name) }))
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                          <button
                            className="rename-inline-clear"
                            onMouseDown={e => { e.preventDefault(); setRenameDrafts(d => ({ ...d, [photo.id]: '' })); e.currentTarget.previousSibling.focus() }}
                            title="Svuota"
                          >✕</button>
                        </div>
                      </div>
                    )}
                    {(croppingIds.has(photo.id) || cropDoneIds.has(photo.id) || rotatingIds.has(photo.id) || rotateDoneIds.has(photo.id)) && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (croppingIds.has(photo.id) || rotatingIds.has(photo.id)) ? 'rgba(0,0,0,0.55)' : 'rgba(16,185,129,0.7)', borderRadius: 8, pointerEvents: 'none', transition: 'background 0.3s' }}>
                        {(croppingIds.has(photo.id) || rotatingIds.has(photo.id)) ? (
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
        </motion.div>
      </div>

      {/* Slideshow */}
      {slideshowIdx !== null && (
        <QuickLookModal
          files={[results[slideshowIdx]]}
          auth={auth}
          currentIndex={slideshowIdx}
          total={results.length}
          onPrev={() => setSlideshowIdx(i => Math.max(0, i - 1))}
          onNext={() => setSlideshowIdx(i => Math.min(results.length - 1, i + 1))}
          onClose={() => setSlideshowIdx(null)}
          onCrop={() => { setCropPhoto(results[slideshowIdx]); setSlideshowIdx(null) }}
          onRename={() => { setRenamePhoto(results[slideshowIdx]); setSlideshowIdx(null) }}
          onDownload={() => handleDownload(results[slideshowIdx])}
          onDelete={() => { handleDelete(results[slideshowIdx]); setSlideshowIdx(null) }}
          onDuplicate={() => handleDuplicate(results[slideshowIdx])}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <PhotoContextMenu
          photo={contextMenu.photo}
          idx={contextMenu.idx}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          actions={{
            onQuickLook: (idx) => setSlideshowIdx(idx),
            onSimilarity: handleSimilarity,
            onScopeSearch: setScopePickerPhoto,
            onRename: (photo) => setRenamePhoto(photo),
            onDuplicate: handleDuplicate,
            onDownload: handleDownload,
            onMove: (photo) => setMovePhoto(photo),
            onDelete: handleDelete,
          }}
        />
      )}

      {/* Folder context menu */}
      {folderContextMenu && (
        <FolderContextMenu
          folder={folderContextMenu.folder}
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          onClose={() => setFolderContextMenu(null)}
          actions={{
            onOpen: (f) => selectFolder(f.id, f.name),
            onNewSubfolder: (f) => handleCreateFolder(f.id, f.name),
            onRename: (f) => setRenameFolder(f),
            onMove: (f) => setMovingFolder(f),
            onColor: (f, hexColor) => handleColorFolder(f, hexColor),
            onDelete: async (f) => {
              if (!window.confirm(`Elimina la cartella "${f.name}"?`)) return
              try {
                await trashFile(auth.accessToken, f.id)
                setCurrentSubfolders(sf => sf.filter(s => s.id !== f.id))
                setTreeChildren(t => { const c = { ...t }; Object.keys(c).forEach(k => { c[k] = c[k].filter(x => x.id !== f.id) }); return c })
              } catch (e) { alert('Errore: ' + e.message) }
            },
          }}
        />
      )}

      {/* Grid empty-area context menu */}
      {gridContextMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1500 }}
          onClick={() => setGridContextMenu(null)}
          onContextMenu={e => { e.preventDefault(); setGridContextMenu(null) }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: Math.min(gridContextMenu.x, window.innerWidth - 200),
              top: Math.min(gridContextMenu.y, window.innerHeight - 60),
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
              padding: '5px', minWidth: 190, zIndex: 1501,
            }}
          >
            <button
              onClick={() => { setGridContextMenu(null); handleCreateFolder(activeFolderId, activeFolderName) }}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 12px', background: 'none', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--btn-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
              Nuova cartella qui
            </button>
          </div>
        </div>
      )}

      {/* Rename folder modal */}
      {renameFolder && (
        <RenameModal
          photo={renameFolder}
          title="Rinomina cartella"
          onClose={() => setRenameFolder(null)}
          onConfirm={(newName) => { handleRenameFolder(renameFolder, newName); setRenameFolder(null) }}
        />
      )}

      {/* Move folder modal */}
      {movingFolder && (
        <FolderPickerModal
          accessToken={auth.accessToken}
          title={`Sposta cartella "${movingFolder.name}" in…`}
          onClose={() => setMovingFolder(null)}
          onConfirm={async (targetFolder) => {
            try {
              await moveFile(auth.accessToken, movingFolder.id, targetFolder.id, activeFolderId)
              setCurrentSubfolders(sf => sf.filter(s => s.id !== movingFolder.id))
              setTreeChildren(t => { const c = { ...t }; Object.keys(c).forEach(k => { c[k] = c[k].filter(x => x.id !== movingFolder.id) }); return c })
            } catch (e) { alert('Errore: ' + e.message) }
            setMovingFolder(null)
          }}
        />
      )}

      {/* Rename modal */}
      {renamePhoto && (
        <RenameModal
          photo={renamePhoto}
          onClose={() => setRenamePhoto(null)}
          onConfirm={(newName) => { handleRename(renamePhoto, newName); setRenamePhoto(null) }}
        />
      )}

      {/* Move modal */}
      {movePhoto && (
        <FolderPickerModal
          accessToken={auth.accessToken}
          title={`Sposta "${movePhoto.name}"`}
          onClose={() => setMovePhoto(null)}
          onConfirm={(folder) => { handleMove(movePhoto, folder); setMovePhoto(null) }}
        />
      )}

      {/* Bulk move modal */}
      {bulkMoveActive && (
        <FolderPickerModal
          accessToken={auth.accessToken}
          title={`Sposta ${selectedIds.size} foto in...`}
          onClose={() => setBulkMoveActive(false)}
          onConfirm={(folder) => handleBulkMove(folder)}
        />
      )}

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          {bulkDeleteConfirm ? (
            <>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Elimina {selectedIds.size} foto?</span>
              <button className="bulk-btn bulk-btn-danger" onClick={() => handleBulkDelete(results)}>Conferma</button>
              <button className="bulk-btn" onClick={() => setBulkDeleteConfirm(false)}>Annulla</button>
            </>
          ) : (
            <>
              <span className="bulk-count">{selectedIds.size} selezionate</span>
              <button className="bulk-btn" onClick={() => setSelectedIds(new Set(results.map(p => p.id)))}>
                Seleziona tutto ({results.length})
              </button>
              <div className="bulk-divider" />
              <button className="bulk-btn" onClick={() => handleBulkDownload(results)} title="Download">
                <IconDownloadBulk /> Download
              </button>
              <button className="bulk-btn" onClick={() => setBulkMoveActive(true)} title="Sposta in...">
                <IconMoveBulk /> Sposta in...
              </button>
              {selectedIds.size > 1 && (
                <button className="bulk-btn" onClick={() => setBatchCropPhotos(results.filter(p => selectedIds.has(p.id)))} title="Crop multiplo">
                  <IconCrop /> Crop multiplo
                </button>
              )}
              <button className="bulk-btn bulk-btn-danger" onClick={() => setBulkDeleteConfirm(true)} title="Elimina">
                <IconTrash /> Elimina
              </button>
              <div className="bulk-divider" />
              <button className="bulk-btn" onClick={exitSelectionMode} title="Annulla selezione">✕</button>
            </>
          )}
        </div>
      )}

      {/* Undo toast */}
      {undoToast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 3000, fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            <strong>{undoToast.photo.name}</strong> eliminato
          </span>
          <button onClick={handleUndoDelete} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>Annulla</button>
        </div>
      )}

      {showStats && (
        <DriveStatsModal
          folderName={activeFolderName || 'My Drive'}
          folderId={activeFolderId || 'root'}
          currentFiles={allPhotos}
          accessToken={auth.accessToken}
          onClose={() => setShowStats(false)}
        />
      )}

      {scopePickerPhoto && (
        <ScopePickerModal
          photo={scopePickerPhoto}
          accessToken={auth.accessToken}
          onClose={() => setScopePickerPhoto(null)}
          onConfirm={(scopeFolder) => {
            setScopePickerPhoto(null)
            handleGlobalSimilarity(scopePickerPhoto, scopeFolder)
          }}
        />
      )}

      {enhancePhoto && (
        <EnhanceModal
          photo={enhancePhoto}
          accessToken={auth.accessToken}
          onClose={() => setEnhancePhoto(null)}
          onDone={(photoId, updatedMeta) => {
            setEnhancePhoto(null)
            if (photoId && updatedMeta?.thumbnailLink) {
              setAllPhotos(photos => photos.map(p => p.id === photoId ? { ...p, thumbnailLink: updatedMeta.thumbnailLink } : p))
              setThumbTimestamps(ts => ({ ...ts, [photoId]: Date.now() }))
            }
          }}
        />
      )}

      {batchCropPhotos && (
        <BatchCropModal
          photos={batchCropPhotos}
          accessToken={auth.accessToken}
          onClose={() => setBatchCropPhotos(null)}
          onDone={(results) => {
            setBatchCropPhotos(null)
            const now = Date.now()
            const metaById = {}
            for (const r of results) {
              if (r.updatedMeta?.thumbnailLink) metaById[r.photoId] = r.updatedMeta
            }
            if (Object.keys(metaById).length > 0) {
              setAllPhotos(photos => photos.map(p => metaById[p.id] ? { ...p, thumbnailLink: metaById[p.id].thumbnailLink } : p))
              setThumbTimestamps(ts => {
                const next = { ...ts }
                for (const id of Object.keys(metaById)) next[id] = now
                return next
              })
            }
            exitSelectionMode()
          }}
        />
      )}

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

      {wizardOpen && wizardMeta && (
        <VideoMontageModal
          videos={wizardMeta.videos}
          auth={auth}
          folderId={wizardMeta.folderId}
          folderName={wizardMeta.folderName}
        />
      )}
      {showStatus && <StatusModal auth={auth} onClose={() => setShowStatus(false)} />}

      {folderTooltip?.items && (() => {
        const margin = 8
        const isGrid = folderTooltipMode === 'grid'
        const w = isGrid ? 414 : 300
        const rows = isGrid ? Math.ceil(folderTooltip.items.length / 4) : folderTooltip.items.length
        const h = isGrid ? (rows * 96 + (rows - 1) * 6 + 12) : Math.min(rows * 64 + 12, window.innerHeight - margin * 2)
        const left = Math.min(Math.max(margin, folderTooltip.x), window.innerWidth - w - margin)
        const top = Math.min(Math.max(margin, folderTooltip.y), window.innerHeight - h - margin)
        return isGrid ? (
          <div style={{
            position: 'fixed', left, top,
            zIndex: 2000, pointerEvents: 'none',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            padding: '6px', display: 'grid', gridTemplateColumns: 'repeat(4, 96px)', gap: '6px',
            maxHeight: `calc(100vh - ${margin * 2}px)`, overflow: 'hidden',
          }}>
            {folderTooltip.items.map((item, i) => (
              item.thumb
                ? <img key={i} src={item.thumb} style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} alt="" />
                : <span key={i} style={{ width: '96px', height: '96px', borderRadius: '3px', background: 'var(--border)', flexShrink: 0, display: 'block' }} />
            ))}
          </div>
        ) : (
          <div style={{
            position: 'fixed', left, top,
            zIndex: 2000, pointerEvents: 'none',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            padding: '6px', minWidth: '220px', maxWidth: '300px',
            maxHeight: `calc(100vh - ${margin * 2}px)`, overflow: 'hidden',
          }}>
            {folderTooltip.items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '4px 6px',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              }}>
                {item.thumb
                  ? <img src={item.thumb} style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} alt="" />
                  : <span style={{ width: '56px', height: '56px', borderRadius: '4px', background: 'var(--border)', flexShrink: 0, display: 'block' }} />
                }
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
              </div>
            ))}
          </div>
        )
      })()}
      <UploadQueuePanel queue={uploadQueue} onRetry={retryUpload} onDismiss={dismissUpload} />
    </motion.div>
  )
}

// Recursive tree node with full tree state passed as props
function TreeNodeFull({ folder, depth, siblingIds = [], treeExpanded, treeChildren, treeLoading, activeId, onToggle, onSelect, dragOverFolder, setDragOverFolder, onDropPhoto, onContextMenu }) {
  const expanded = treeExpanded[folder.id]
  const loading = treeLoading[folder.id]
  const children = treeChildren[folder.id]
  const hasChildren = children === undefined || children.length > 0

  const childSiblingIds = (children || []).map(c => c.id)

  const springTimerRef = useRef(null)
  const clearSpringTimer = () => {
    if (springTimerRef.current) { clearTimeout(springTimerRef.current); springTimerRef.current = null }
  }

  return (
    <div className="tree-node-wrap">
      <div
        className={`tree-node${activeId === folder.id ? ' active' : ''}${dragOverFolder === folder.id ? ' drop-target' : ''}`}
        style={{ paddingLeft: 8 + (depth - 1) * 12 }}
        onClick={() => onSelect(folder, siblingIds)}
        onDragOver={e => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (dragOverFolder !== folder.id) setDragOverFolder(folder.id)
          if (!expanded && !springTimerRef.current) {
            springTimerRef.current = setTimeout(() => { onToggle(folder, siblingIds); springTimerRef.current = null }, 1000)
          }
        }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverFolder(null)
            clearSpringTimer()
          }
        }}
        onDrop={e => {
          e.preventDefault()
          e.stopPropagation()
          clearSpringTimer()
          onDropPhoto(folder, e.dataTransfer.getData('photoId') || null, e.dataTransfer.getData('folderId') || null)
        }}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu(folder, e) }}
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
        <span className="tree-folder-icon"><IconFolder color={folder.folderColorRgb} /></span>
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
          dragOverFolder={dragOverFolder}
          setDragOverFolder={setDragOverFolder}
          onDropPhoto={onDropPhoto}
          onContextMenu={onContextMenu}
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
