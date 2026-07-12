import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { staggerContainer, fadeItem } from '../motionVariants'
import { listFiles, listFilesRecursive, renameFile, fetchFolderTooltipItems } from '../drive'
import { getSessions, clearSessions, downloadCSV } from '../logs'
import QuickLookModal from '../components/QuickLookModal'
import StatusModal from '../components/StatusModal'
import PalettePicker from '../components/PalettePicker'
import UserMenu from '../components/UserMenu'
import ObliqueDivider from '../components/ObliqueDivider'
import { useRenameQueue } from '../context/RenameQueueContext'
import { useRenameRules } from '../hooks/useRenameRules'
import { getExt, isVideoFile, buildLegacyPreview, formatETA, needsMediaMove, buildRenamePreviewForConfig } from '../renameQueueEngine'
import './DashboardPage.css'

const PLACEHOLDERS = [
  { token: '{cartella}', label: 'Cartella', desc: 'Nome della cartella corrente' },
  { token: '{parent}',   label: 'Parent',   desc: 'Nome della cartella padre' },
  { token: '{nonno}',    label: 'Nonno',    desc: 'Nome della cartella nonno' },
  { token: '{nome}',     label: 'Nome',     desc: 'Nome originale del file senza estensione' },
  { token: '{seq}',      label: 'Sequenza', desc: 'Numero progressivo (es. 001)' },
  { token: '{data}',     label: 'Data',     desc: 'Data modifica file: YYYYMMDD' },
  { token: '{anno}',     label: 'Anno',     desc: 'Anno modifica file: YYYY' },
  { token: '{mese}',     label: 'Mese',     desc: 'Mese modifica file: MM' },
  { token: '{giorno}',   label: 'Giorno',   desc: 'Giorno modifica file: DD' },
  { token: '{ext}',      label: 'Ext',      desc: 'Estensione senza punto (es. jpg)' },
]

const IconFolder = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
  </svg>
)
const IconFile = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)
const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconList = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)
const IconHome = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const IconChevronLeft = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const IconSun = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
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
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const IconXSmall = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const IconPlay = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)

const IconDancer = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4" r="2"/>
    <line x1="12" y1="6" x2="12" y2="14"/>
    <line x1="12" y1="8" x2="6" y2="5"/>
    <line x1="12" y1="8" x2="18" y2="11"/>
    <line x1="12" y1="14" x2="7" y2="20"/>
    <line x1="12" y1="14" x2="17" y2="20"/>
  </svg>
)

const CbDot = ({ checked, onChange, refProp, id }) => (
  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <input type="checkbox" id={id} ref={refProp} checked={checked} onChange={onChange}
      style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
    <span onClick={onChange} style={{
      width: 14, height: 14, borderRadius: '50%',
      border: `1.5px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
      background: 'transparent', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      transition: 'border-color 0.12s',
    }}>
      {checked && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />}
    </span>
  </span>
)

// embedded/initialFolder/onClose: usati quando questo componente viene montato dentro
// BetterRenamerModal (da SearchPage) invece che come pagina /  a sé stante.
export default function DashboardPage({ auth, onLogout, isDark, onToggleTheme, colorScheme, onChangeScheme, onTokenRefresh, embedded = false, initialFolder = null, onClose = null }) {
  const navigate = useNavigate()
  const [logsOpen, setLogsOpen] = useState(false)
  const [logSessions, setLogSessions] = useState([])
  const [logsExpanded, setLogsExpanded] = useState(null)
  const [undoneEntries, setUndoneEntries] = useState(new Set())
  const [undoingEntries, setUndoingEntries] = useState(new Set())

  const [showStatus, setShowStatus] = useState(false)

  const openLogs = () => { setLogSessions(getSessions()); setLogsOpen(true) }
  const closeLogs = () => setLogsOpen(false)

  const handleUndo = useCallback(async (sessionIdx, entryIdx, entry) => {
    const key = `${sessionIdx}-${entryIdx}`
    setUndoingEntries(s => new Set(s).add(key))
    try {
      await renameFile(auth.accessToken, entry.id, entry.oldName)
      setUndoneEntries(s => new Set(s).add(key))
    } catch (e) {
      alert('Errore undo: ' + e.message)
    } finally {
      setUndoingEntries(s => { const n = new Set(s); n.delete(key); return n })
    }
  }, [auth])

  // Browser state
  const [folderPath, setFolderPath] = useState([{ id: 'root', name: 'My Drive' }])
  const [files, setFiles] = useState([])
  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserError, setBrowserError] = useState('')
  const [recentFolders, setRecentFolders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('br_recent_folders') || '[]') } catch { return [] }
  })

  // Quick Look
  const [selectedFiles, setSelectedFiles] = useState([])
  const [quickLookOpen, setQuickLookOpen] = useState(false)
  const [thumbTooltip, setThumbTooltip] = useState(null)

  // Config
  const [mode, setMode] = useState('legacy')
  const [moveOnly, setMoveOnly] = useState(false)
  const [includeRoot, setIncludeRoot] = useState(true)
  const [organizeMedia, setOrganizeMedia] = useState(true)
  const [pattern, setPattern] = useState('folder-ext-seq')
  const [separator, setSeparator] = useState('_')
  const [startNumber, setStartNumber] = useState(1)
  const [padding, setPadding] = useState(3)
  const [customPrefix, setCustomPrefix] = useState('')
  const [customAddSeq, setCustomAddSeq] = useState(true)
  const [customSeqSeparator, setCustomSeqSeparator] = useState('-')
  const [customRecursive, setCustomRecursive] = useState(false)

  const { rules, persistRules, rulesApplying, rulesApplyMessage, setRulesApplyMessage, handleApplyRulesNow } = useRenameRules(auth)
  const customPrefixRef = useRef(null)

  const insertPlaceholder = (token) => {
    const el = customPrefixRef.current
    if (!el) return
    const start = el.selectionStart ?? customPrefix.length
    const end = el.selectionEnd ?? customPrefix.length
    const next = customPrefix.slice(0, start) + token + customPrefix.slice(end)
    setCustomPrefix(next)
    setPreview([])
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }

  // Preview inline
  const [preview, setPreview] = useState([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [previewFolder, setPreviewFolder] = useState(null) // cartella a cui si riferisce la preview

  // Folder checkbox selection (legacy mode only)
  const [checkedFolders, setCheckedFolders] = useState(new Set())
  const selectAllRef = useRef(null)

  const visibleFolders = useMemo(() => files.filter(f => f.mimeType === 'application/vnd.google-apps.folder'), [files])
  const allChecked = visibleFolders.length > 0 && visibleFolders.every(f => checkedFolders.has(f.id))
  const someChecked = visibleFolders.some(f => checkedFolders.has(f.id))

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked && !allChecked
    }
  }, [someChecked, allChecked])

  const toggleFolder = (id, e) => {
    e.stopPropagation()
    setCheckedFolders(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAllFolders = () => {
    setCheckedFolders(allChecked ? new Set() : new Set(visibleFolders.map(f => f.id)))
  }

  const {
    interruptedJobs, queuedJobs, runningJobs, pendingJobs,
    lockedByOther, setLockedByOther,
    enqueueJob, enqueueRaw, startJob, startAll, removeQueued, removeJob,
    restartJob, restartAll,
  } = useRenameQueue()

  const handleAddToQueue = () => {
    if (preview.length === 0 || !previewFolder) return
    const effectiveOrganizeMedia = moveOnly ? true : organizeMedia
    const toProcess = preview.filter(p => !p.skip || needsMediaMove(p, moveOnly, effectiveOrganizeMedia))
    enqueueJob({
      rootFolderName: previewFolder.name,
      rootFolderId: previewFolder.id,
      mode,
      moveOnly,
      organizeMedia: effectiveOrganizeMedia,
      preview: toProcess.map(p => ({ ...p })),
      skipCount: preview.length - toProcess.length,
      progress: { current: 0, total: toProcess.length, currentFile: '', phase: '' },
    })
    setPreview([])
    setPreviewFolder(null)
    setCheckedFolders(new Set())
  }

  const loadFolder = async (folderId, token) => {
    setBrowserLoading(true)
    setBrowserError('')
    const accessToken = token || auth.accessToken
    try {
      const data = await listFiles(accessToken, folderId)
      setFiles(data.files || [])
    } catch (err) {
      if (err.status === 401 && onTokenRefresh) {
        const newToken = await onTokenRefresh()
        if (newToken) {
          try {
            const data = await listFiles(newToken, folderId)
            setFiles(data.files || [])
            return
          } catch {}
        }
      }
      setBrowserError('Errore nel caricamento: ' + err.message)
    } finally {
      setBrowserLoading(false)
    }
  }

  const autoPreviewDone = useRef(false)
  useEffect(() => {
    if (initialFolder) {
      setFolderPath([{ id: 'root', name: 'My Drive' }, initialFolder])
      loadFolder(initialFolder.id)
    } else {
      loadFolder('root')
    }
  }, [auth.accessToken])

  useEffect(() => {
    if (!initialFolder || autoPreviewDone.current || browserLoading) return
    if (folderPath[folderPath.length - 1]?.id !== initialFolder.id) return
    autoPreviewDone.current = true
    handleGeneratePreview()
  }, [initialFolder, browserLoading, folderPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFolderClick = (folder) => {
    const newPath = [...folderPath, folder]
    setFolderPath(newPath)
    loadFolder(folder.id)
    setCheckedFolders(new Set())
    if (folder.id !== 'root') {
      setRecentFolders(prev => {
        const updated = [folder, ...prev.filter(f => f.id !== folder.id)].slice(0, 8)
        localStorage.setItem('br_recent_folders', JSON.stringify(updated))
        return updated
      })
    }
  }

  const handleBackClick = () => {
    if (folderPath.length > 1) {
      const newPath = folderPath.slice(0, -1)
      setFolderPath(newPath)
      loadFolder(newPath[newPath.length - 1].id)
      setCheckedFolders(new Set())
    }
  }

  const tooltipRef = useRef(null)
  const folderHoverTimer = useRef(null)
  const folderFileCache = useRef({})
  const [folderTooltip, setFolderTooltip] = useState(null) // { names: [], x, y }
  const [folderTooltipMode, setFolderTooltipMode] = useState('list') // 'list' | 'grid'

  const handleThumbEnter = (e, file) => {
    if (!file.thumbnailLink) return
    setThumbTooltip({ url: file.thumbnailLink, cx: e.clientX, cy: e.clientY })
  }
  const handleThumbMove = (e) => {
    setThumbTooltip(t => t ? { ...t, cx: e.clientX, cy: e.clientY } : null)
  }
  const handleThumbLeave = () => setThumbTooltip(null)

  const folderCursorRef = useRef({ x: 0, y: 0 })
  const activeFolderRef = useRef(null)
  const handleFolderEnter = (e, folder) => {
    folderCursorRef.current = { x: e.clientX, y: e.clientY }
    activeFolderRef.current = folder.id
    clearTimeout(folderHoverTimer.current)
    folderHoverTimer.current = setTimeout(async () => {
      try {
        if (activeFolderRef.current !== folder.id) return
        let items = folderFileCache.current[folder.id]
        if (!items) {
          items = await fetchFolderTooltipItems(auth.accessToken, folder.id)
          folderFileCache.current[folder.id] = items
        }
        if (activeFolderRef.current !== folder.id) return
        if (Array.isArray(items) && items.length > 0) {
          const { x, y } = folderCursorRef.current
          setFolderTooltip({ items, x: x + 16, y: y + 16 })
        }
      } catch {
        // silently ignore — hover tooltip is non-critical
      }
    }, 69)
  }
  const handleFolderMove = (e) => {
    folderCursorRef.current = { x: e.clientX, y: e.clientY }
    setFolderTooltip(t => t ? { ...t, x: e.clientX + 16, y: e.clientY + 16 } : null)
  }
  const handleFolderLeave = () => {
    activeFolderRef.current = null
    clearTimeout(folderHoverTimer.current)
    setFolderTooltip(null)
  }

  useEffect(() => {
    if (!thumbTooltip || !tooltipRef.current) return
    const el = tooltipRef.current
    const { width, height } = el.getBoundingClientRect()
    const { cx, cy } = thumbTooltip
    el.style.left = (cx + 16 + width > window.innerWidth ? cx - width - 8 : cx + 16) + 'px'
    el.style.top = (cy + 16 + height > window.innerHeight ? cy - height - 8 : cy + 16) + 'px'
  })

  const handleFileClick = (file, e) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      handleFolderClick(file)
      setSelectedFiles([])
      return
    }
    if (e.metaKey || e.ctrlKey) {
      setSelectedFiles(prev =>
        prev.find(f => f.id === file.id)
          ? prev.filter(f => f.id !== file.id)
          : [...prev, file]
      )
    } else {
      setSelectedFiles(prev => prev.length === 1 && prev[0].id === file.id ? [] : [file])
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (quickLookOpen) setQuickLookOpen(false)
        else if (selectedFiles.length > 0) setQuickLookOpen(true)
      }
      if (e.code === 'Escape') setQuickLookOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedFiles, quickLookOpen])

  const handleGeneratePreview = async () => {
    setPreviewLoading(true)
    setPreviewError('')
    setPreview([])
    const currentFolder = folderPath[folderPath.length - 1]
    setPreviewFolder(currentFolder)
    try {
      if (mode === 'legacy') {
        let groups
        if (checkedFolders.size > 0) {
          const selectedFolders = files.filter(f => checkedFolders.has(f.id))
          const results = await Promise.all(selectedFolders.map(f => listFilesRecursive(auth.accessToken, f.id, f.name, true)))
          groups = results.flat()
        } else {
          groups = await listFilesRecursive(auth.accessToken, currentFolder.id, currentFolder.name, includeRoot)
        }
        if (moveOnly) {
          // Solo sposta: mostra video/gif con newName = oldName
          const allFiles = groups.flatMap(g => g.files.map(f => ({ ...f, folderName: g.folderName, folderId: g.folderId })))
          const mediaFiles = allFiles.filter(f => isVideoFile(f.name, f.mimeType) || getExt(f.name) === '.gif')
          if (mediaFiles.length === 0) {
            setPreviewError('Nessun video/gif trovato nelle cartelle selezionate.')
          } else {
            setPreview(mediaFiles.map(f => ({ id: f.id, oldName: f.name, newName: f.name, folderName: f.folderName, folderId: f.folderId, mimeType: f.mimeType, thumbnailLink: f.thumbnailLink || null, skip: false })))
          }
        } else {
          const built = buildLegacyPreview(groups)
          if (built.length === 0) {
            setPreviewError('Nessun file media trovato' + (includeRoot ? '' : ' nelle sottocartelle') + '.')
          } else {
            setPreview(built)
          }
        }
      } else {
        const previewList = await buildRenamePreviewForConfig(auth.accessToken, currentFolder, {
          pattern, separator, startNumber, padding, customPrefix, customAddSeq, customSeqSeparator,
          recursive: pattern === 'custom-free' && customRecursive,
        })
        setPreview(previewList)
      }
    } catch (err) {
      if (err.status === 401 && onTokenRefresh) {
        const newToken = await onTokenRefresh()
        if (newToken) { handleGeneratePreview(); return }
      }
      setPreviewError('Errore: ' + err.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleLogout = () => { onLogout(); navigate('/login') }

  const activeFolderIds = new Set(
    [...queuedJobs, ...runningJobs, ...pendingJobs].flatMap(j => [j.rootFolderId, ...(j.preview || []).map(p => p.folderId)])
  )

  const showMoveColumn = moveOnly || organizeMedia
  const needsAnyAction = (item) => !item.skip || needsMediaMove(item, moveOnly, organizeMedia)

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', height: embedded ? '100%' : '100vh', overflow: 'hidden' }}>
      {lockedByOther && (
        <div style={{ background: '#f59e0b', color: '#000', fontSize: 12, fontWeight: 600, padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          ⚠️ Un'altra finestra sta eseguendo un task. I nuovi job verranno messi in attesa fino al termine.
          <button onClick={() => setLockedByOther(false)} style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Ignora</button>
        </div>
      )}
      {/* Header */}
      <motion.div variants={fadeItem} className="header" style={{ padding: '12px 24px', flexShrink: 0, marginBottom: 0, justifyContent: 'flex-end' }}>
        <div className="header-actions">
          {embedded && onClose && (
            <button onClick={onClose} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0 }} title="Chiudi">
              <IconXSmall />
            </button>
          )}
          <button onClick={openLogs} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconList /> Logs</button>
          <ObliqueDivider />
          <button onClick={onToggleTheme} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0 }} title="Tema">
            {isDark ? <IconSun /> : <IconMoon />}
          </button>
          <PalettePicker colorScheme={colorScheme} onChangeScheme={onChangeScheme} isDark={isDark} />
          <button onClick={() => setShowStatus(true)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, padding: 0 }} title="Stato sistema">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </button>
          <UserMenu email={auth.email} avatarUrl={auth.picture} onLogout={handleLogout} />
        </div>
      </motion.div>

      {/* Main content: sidebar + pannello destro */}
      <div className="tool-body">

        {/* Sidebar browser */}
        <motion.div variants={fadeItem} className="sidebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div className="breadcrumb" style={{ fontSize: '12px', margin: 0, flex: 1, minWidth: 0 }}>
              {folderPath.map((folder, idx) => (
                <span key={idx}>
                  {idx > 0 && <span> / </span>}
                  {idx === folderPath.length - 1 ? <strong>{folder.name}</strong> : (
                    <a href="#" onClick={(e) => {
                      e.preventDefault()
                      const newPath = folderPath.slice(0, idx + 1)
                      setFolderPath(newPath)
                      loadFolder(newPath[newPath.length - 1].id)
                      setCheckedFolders(new Set())
                    }}>{folder.name}</a>
                  )}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
              <button
                className="nav-icon-btn"
                onClick={handleBackClick}
                disabled={folderPath.length <= 1}
                title="Indietro"
              ><IconChevronLeft /></button>
              <button
                className="nav-icon-btn"
                onClick={() => { setFolderPath([{ id: 'root', name: 'My Drive' }]); loadFolder('root'); setCheckedFolders(new Set()) }}
                disabled={folderPath.length <= 1}
                title="Home"
              ><IconHome /></button>
              <button
                className="nav-icon-btn"
                onClick={() => loadFolder(folderPath[folderPath.length - 1].id)}
                title="Ricarica"
              ><IconRefresh /></button>
            </div>
          </div>
          {browserError && <div className="error-message" style={{ fontSize: '12px' }}>{browserError}</div>}
          <div className="file-list" style={{ flex: 1, overflowY: 'auto' }}>
            {browserLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '13px' }}>Caricamento...</div>
            ) : files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Nessun file</div>
            ) : (
              <>
                {mode === 'legacy' && visibleFolders.length > 0 && (
                  <div className="folder-select-header" onClick={toggleAllFolders}>
                    <CbDot refProp={selectAllRef} checked={allChecked} onChange={toggleAllFolders} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', userSelect: 'none' }}>
                      {checkedFolders.size > 0 ? `${checkedFolders.size} selezionat${checkedFolders.size === 1 ? 'a' : 'e'}` : 'Tutte le cartelle'}
                    </span>
                  </div>
                )}
                {files.map(file => {
                  const isSelected = selectedFiles.some(f => f.id === file.id)
                  const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
                  const isChecked = checkedFolders.has(file.id)
                  const isActive = isFolder && activeFolderIds.has(file.id)
                  const hasActiveJob = isFolder && activeFolderIds.size > 0
                  return (
                    <div
                      key={file.id}
                      onClick={(e) => handleFileClick(file, e)}
                      className={`file-item ${isFolder ? 'folder' : ''} ${isActive ? 'folder-active' : hasActiveJob ? 'folder-has-active-job' : ''}`}
                      style={{
                        fontSize: '13px', padding: 0,
                        background: isChecked ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : isSelected ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : undefined,
                        borderLeft: isChecked ? '3px solid var(--primary)' : isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                      }}
                      onMouseEnter={!isFolder ? (e) => handleThumbEnter(e, file) : undefined}
                      onMouseMove={!isFolder ? handleThumbMove : undefined}
                      onMouseLeave={!isFolder ? handleThumbLeave : undefined}
                    >
                      {mode === 'legacy' && isFolder && (
                        <div style={{ padding: '13px', display: 'flex', alignItems: 'center' }} onClick={e => toggleFolder(file.id, e)}>
                          <CbDot checked={isChecked} onChange={e => toggleFolder(file.id, e)} />
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, padding: isFolder ? (mode === 'legacy' ? '8px 32px 8px 0' : '8px 32px 8px 10px') : '8px 10px', minWidth: 0 }}>
                        <span className="file-icon" style={{ color: isFolder ? '#f59e0b' : '#6b7280' }}>{isFolder ? <IconFolder /> : <IconFile />}</span>
                        <span className="file-name">{file.name}</span>
                      </div>
                      {!isFolder && (
                        <div className="file-preview-col" onClick={e => e.stopPropagation()}>
                          <IconEye />
                        </div>
                      )}
                      {isFolder && (
                        <div
                          className="folder-preview-trigger"
                          onClick={e => { e.stopPropagation(); setFolderTooltipMode(m => m === 'grid' ? 'list' : 'grid') }}
                          onMouseEnter={(e) => handleFolderEnter(e, file)}
                          onMouseMove={handleFolderMove}
                          onMouseLeave={handleFolderLeave}
                        >
                          <IconEye />
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
          <div style={{ fontSize: '11px', color: selectedFiles.length > 0 ? 'var(--primary)' : 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>
            {selectedFiles.length > 0
              ? `${selectedFiles.length} selezionato${selectedFiles.length > 1 ? 'i' : ''} · Spazio per anteprima`
              : 'Click · Cmd+click per più · Spazio anteprima'}
          </div>
          {recentFolders.length > 0 && (
            <div className="recent-folders">
              <div className="recent-folders-tags">
                {recentFolders.map(f => (
                  <button
                    key={f.id}
                    className="recent-tag"
                    onClick={() => { setFolderPath([{ id: 'root', name: 'My Drive' }, f]); loadFolder(f.id); setCheckedFolders(new Set()) }}
                    title={f.name}
                  >
                    <IconFolder />
                    <span>{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Pannello destro: Modalità + Preview + Strumenti */}
        <motion.div variants={fadeItem} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Modalità */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '0 0 auto', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Modalità</label>
              <select value={mode} onChange={(e) => { setMode(e.target.value); setPreview([]) }}>
                <option value="legacy">Legacy (cartella-counter)</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {mode === 'legacy' && (
              <>
                <div className="legacy-checkbox-grid">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                    <CbDot id="moveOnly" checked={moveOnly} onChange={(e) => { setMoveOnly(e.target.checked); setPreview([]) }} />
                    <span style={{ fontSize: '13px' }}>Solo sposta video/gif (senza rinominare)</span>
                  </label>
                  {!moveOnly && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                        <CbDot id="includeRoot" checked={includeRoot} onChange={(e) => { setIncludeRoot(e.target.checked); setPreview([]) }} />
                        <span style={{ fontSize: '13px' }}>Includi file nella cartella selezionata</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                        <CbDot id="organizeMedia" checked={organizeMedia} onChange={(e) => setOrganizeMedia(e.target.checked)} />
                        <span style={{ fontSize: '13px' }}>Sposta video/gif in sottocartelle</span>
                      </label>
                    </>
                  )}
                </div>
                <div className="pattern-info">
                  {moveOnly
                    ? 'Sposta video/gif nelle sottocartelle · Prefissi: vid- gif- · Ricorsivo'
                    : 'Pattern: cartella-[prefix]counter.ext · Prefissi: vid- gif- · Sort: data modifica · Ricorsivo'}
                </div>
              </>
            )}

            {mode === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Pattern</label>
                  <select value={pattern} onChange={(e) => { setPattern(e.target.value); setPreview([]) }}>
                    <option value="folder-ext-seq">Cartella + Estensione + Sequenza</option>
                    <option value="seq-ext">Sequenza + Estensione</option>
                    <option value="folder-seq">Cartella + Sequenza</option>
                    <option value="custom-free">Personalizzato</option>
                  </select>
                </div>
                {pattern === 'custom-free' ? (
                  <>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Pattern personalizzato</label>
                      <input
                        ref={customPrefixRef}
                        type="text"
                        value={customPrefix}
                        onChange={e => { setCustomPrefix(e.target.value); setPreview([]) }}
                        placeholder="es. vacanze-{anno} oppure {cartella}-{seq}"
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                        {PLACEHOLDERS.map(p => (
                          <button
                            key={p.token}
                            type="button"
                            title={p.desc}
                            onClick={() => insertPlaceholder(p.token)}
                            style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--primary)', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer', fontWeight: 600 }}
                          >{p.token}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'center', fontSize: 13 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', margin: 0 }}>
                        <CbDot checked={customAddSeq} onChange={e => { setCustomAddSeq(e.target.checked); setPreview([]) }} />
                        Aggiungi sequenza numerica
                      </label>
                      {customAddSeq && (
                        <>
                          {!customPrefix.includes('{seq}') && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 7, margin: 0, fontSize: 13 }}>
                              Separatore
                              <input type="text" value={customSeqSeparator} onChange={e => { setCustomSeqSeparator(e.target.value); setPreview([]) }} maxLength="3" style={{ width: 40, textAlign: 'center' }} />
                            </label>
                          )}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 7, margin: 0, fontSize: 13 }}>
                            Da
                            <input type="number" value={startNumber} onChange={e => { setStartNumber(parseInt(e.target.value) || 1); setPreview([]) }} style={{ width: 90, textAlign: 'center' }} />
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 7, margin: 0, fontSize: 13 }}>
                            Cifre
                            <input type="number" value={padding} onChange={e => { setPadding(Math.max(1, Math.min(10, parseInt(e.target.value) || 1))); setPreview([]) }} min="1" max="10" style={{ width: 52, textAlign: 'center' }} />
                          </label>
                        </>
                      )}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', margin: 0 }}>
                        <CbDot checked={customRecursive} onChange={e => { setCustomRecursive(e.target.checked); setPreview([]) }} />
                        Includi sottocartelle
                      </label>
                    </div>
                  </>
                ) : (
                <div className="form-group">
                  <label>Separatore</label>
                  <input type="text" value={separator} onChange={(e) => { setSeparator(e.target.value); setPreview([]) }} maxLength="3" />
                </div>
                )}
                {pattern !== 'custom-free' && <>
                <div className="form-group">
                  <label>Numero iniziale</label>
                  <input type="number" value={startNumber} onChange={(e) => { setStartNumber(parseInt(e.target.value)); setPreview([]) }} />
                </div>
                <div className="form-group">
                  <label>Padding numerico</label>
                  <input type="number" value={padding} onChange={(e) => { setPadding(parseInt(e.target.value)); setPreview([]) }} min="1" max="10" />
                </div>
                </>}
              </div>
            )}

            <button onClick={handleGeneratePreview} className="btn-primary" disabled={previewLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <IconSearch /> {previewLoading ? 'Analisi in corso...' : 'Genera preview'}
            </button>
          </div>

          {/* Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0, border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, flexShrink: 0 }}>
              Preview
              {preview.length > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>{preview.length} file · {previewFolder?.name}</span>}
            </h3>

            {previewError && <div className="error-message" style={{ fontSize: '12px', flexShrink: 0 }}>{previewError}</div>}

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, border: '1px dashed var(--border)', borderRadius: '8px' }}>
              {preview.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {previewLoading ? 'Analisi cartelle in corso...' : 'Genera una preview per vedere i file che verranno rinominati.'}
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Cartella</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Originale</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{showMoveColumn ? 'Rename' : 'Nuovo nome'}</th>
                      {showMoveColumn && (
                        <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Spostamento</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {[...preview.filter(needsAnyAction), ...preview.filter(p => !needsAnyAction(p))].map((item, idx, arr) => {
                      const firstDoneIdx = arr.findIndex(p => !needsAnyAction(p))
                      const isSeparator = firstDoneIdx > 0 && idx === firstDoneIdx
                      const itemNeedsMove = needsMediaMove(item, moveOnly, organizeMedia)
                      return (
                      <tr key={idx} style={{ borderTop: isSeparator ? '2px dotted var(--primary)' : idx > 0 ? '1px solid var(--border)' : 'none', opacity: needsAnyAction(item) ? 1 : 0.45 }}>
                        <td style={{ padding: '4px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '11px' }}>{item.folderName}</td>
                        <td style={{ padding: '4px 6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{item.oldName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '4px 10px', fontWeight: 500, fontSize: '13px', color: item.skip ? 'var(--text-muted)' : 'var(--success, #16a34a)' }}>
                          {moveOnly
                            ? <span style={{ color: 'var(--text-muted)' }}>già ok ✓</span>
                            : item.skip ? 'già ok ✓' : item.newName}
                        </td>
                        {showMoveColumn && (
                          <td style={{ padding: '4px 10px', fontWeight: 500, fontSize: '13px', color: itemNeedsMove ? 'var(--primary)' : 'var(--text-muted)' }}>
                            {itemNeedsMove
                              ? <span>→ {item.folderName} {isVideoFile(item.oldName, item.mimeType) ? 'Vid' : 'Gif'}</span>
                              : 'già ok ✓'}
                          </td>
                        )}
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {preview.length > 0 && (
              <button onClick={handleAddToQueue} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexShrink: 0 }}>
                <IconPlus /> Aggiungi alla coda ({preview.length} file)
              </button>
            )}
          </div>

        </motion.div>
      </div>

      {showStatus && <StatusModal auth={auth} onClose={() => setShowStatus(false)} />}
      {/* Logs sidebar */}
      {logsOpen && (
        <div onClick={closeLogs} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.33)', zIndex: 3000 }} />
      )}
      <div className={`logs-drawer${logsOpen ? ' open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconList />
            <strong style={{ fontSize: '15px' }}>Logs</strong>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Storico sessioni</span>
          </div>
          <button onClick={closeLogs} className="nav-icon-btn" title="Chiudi"><IconX /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {[...interruptedJobs, ...queuedJobs, ...pendingJobs, ...runningJobs].length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              {interruptedJobs.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interrotti ({interruptedJobs.length})</span>
                  <button onClick={restartAll} className="btn-avvia-tutto" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}>
                    <IconPlay /> Riavvia tutto
                  </button>
                </div>
              )}
              {interruptedJobs.map(job => (
                <div key={job.id} className="session-card" style={{ marginBottom: '8px', borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: '13px' }}>{job.rootFolderName}</strong>
                      {job.preview && <span style={{ fontSize: '11px', color: '#f59e0b', marginLeft: '8px' }}>Interrotto — {job.preview.length} file</span>}
                    </div>
                    <button onClick={() => restartJob(job.id)} className="btn-primary" style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IconPlay /> Riavvia
                    </button>
                    <button onClick={() => removeJob(job.id)} className="btn-secondary" style={{ fontSize: '11px', padding: '3px 6px', color: 'var(--danger)' }}>
                      <IconXSmall />
                    </button>
                  </div>
                </div>
              ))}
              {queuedJobs.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In coda ({queuedJobs.length})</span>
                  <button onClick={startAll} className="btn-avvia-tutto">
                    <IconPlay /> Avvia tutto
                  </button>
                </div>
              )}
              {queuedJobs.map(job => (
                <div key={job.id} className="session-card" style={{ marginBottom: '8px' }}>
                  <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}><IconClock /></span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: '13px' }}>{job.rootFolderName}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>{job.progress.total} file</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      <button onClick={() => startJob(job.id)} className="btn-primary" style={{ fontSize: '11px', padding: '3px 9px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconPlay /> Avvia
                      </button>
                      <button onClick={() => removeQueued(job.id)} className="btn-secondary" style={{ fontSize: '11px', padding: '3px 6px', color: 'var(--danger)' }} title="Rimuovi">
                        <IconXSmall />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {[...pendingJobs, ...runningJobs].length > 0 && queuedJobs.length > 0 && (
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', marginTop: '4px' }}>In esecuzione</div>
              )}
              {[...pendingJobs, ...runningJobs].map(job => {
                const pct = job.progress.total > 0 ? Math.round((job.progress.current / job.progress.total) * 100) : 0
                return (
                  <div key={job.id} className="session-card" style={{ marginBottom: '10px', position: 'relative', overflow: 'hidden' }}>
                    <div className="live-shimmer" />
                    <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#3b82f6', display: 'flex', flexShrink: 0, animation: job.status === 'running' ? 'dancer-bounce 0.6s ease-in-out infinite alternate' : 'none', opacity: job.status === 'pending' ? 0.4 : 1 }}>
                        <IconDancer />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ fontSize: '13px' }}>{job.rootFolderName}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                          {job.status === 'pending' ? 'In attesa...' : job.progress.phase}
                        </span>
                        {job.status === 'running' && job.progress.currentFile && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {job.progress.currentFile}{job.progress.currentNewName ? ` → ${job.progress.currentNewName}` : ''}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: '#3b82f6', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {job.status === 'running' ? (
                          <>
                            {pct}%
                            {job.progress.etaMs && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <IconClock />
                                {formatETA(job.progress.etaMs)}
                              </span>
                            )}
                          </>
                        ) : '⏳'}
                      </span>
                    </div>
                    {job.status === 'running' && (
                      <div style={{ height: '3px', background: 'var(--border)' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#3b82f6', transition: 'width 0.3s ease' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {logSessions.length === 0 && [...queuedJobs, ...pendingJobs, ...runningJobs].length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>Nessuna sessione registrata.</div>
          )}
          {logSessions.length > 0 && (
            <>
              {[...queuedJobs, ...pendingJobs, ...runningJobs].length > 0 && (
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', marginTop: '4px' }}>Storico</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button onClick={() => { clearSessions(); setLogSessions([]) }} className="btn-secondary" style={{ fontSize: '12px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconTrash /> Elimina tutti
                </button>
              </div>
              {logSessions.map((session, idx) => {
                const successCount = session.entries.filter(e => e.success).length
                const failCount = session.entries.length - successCount
                const isOpen = logsExpanded === idx
                return (
                  <div key={idx} className="session-card" style={{ marginBottom: '10px' }}>
                    <div onClick={() => setLogsExpanded(isOpen ? null : idx)} className={`session-header${isOpen ? ' open' : ''}`}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', minWidth: 0 }}>
                        <strong style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{session.rootFolder}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(session.date).toLocaleString('it-IT')}</span>
                        <span className="badge-success">{successCount} ok</span>
                        {failCount > 0 && <span className="badge-error">{failCount} err</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <button onClick={(e) => { e.stopPropagation(); downloadCSV(session) }} className="btn-secondary" style={{ fontSize: '11px', padding: '3px 8px' }}>CSV</button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="session-body" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>St.</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Originale</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Nuovo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {session.entries.map((entry, i) => {
                              const key = `${idx}-${i}`
                              const isUndone = undoneEntries.has(key)
                              const isUndoing = undoingEntries.has(key)
                              const canUndo = entry.success && entry.type === 'rename' && entry.id && !isUndone
                              return (
                                <tr key={i} style={{ borderTop: '1px solid var(--border)', opacity: isUndone ? 0.4 : 1 }}>
                                  <td style={{ padding: '5px 10px' }}>{entry.success ? <IconCheck /> : <IconXSmall />}</td>
                                  <td style={{ padding: '5px 10px', color: 'var(--text-secondary)' }}>{entry.oldName}</td>
                                  <td style={{ padding: '5px 10px', color: isUndone ? 'var(--text-muted)' : entry.success ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                                    {isUndone ? '↩ annullato' : entry.success ? entry.newName : entry.error}
                                  </td>
                                  <td style={{ padding: '5px 6px', width: '32px' }}>
                                    {canUndo && (
                                      <button
                                        onClick={() => handleUndo(idx, i, entry)}
                                        disabled={isUndoing}
                                        title="Annulla rinomina"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '2px 4px', opacity: isUndoing ? 0.4 : 0.6, transition: 'opacity 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = isUndoing ? '0.4' : '0.6'}
                                      >
                                        {isUndoing ? '…' : '↩'}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {thumbTooltip && (
        <div ref={tooltipRef} style={{
          position: 'fixed', left: thumbTooltip.cx + 16, top: thumbTooltip.cy + 16,
          zIndex: 2000, pointerEvents: 'none',
          background: 'white', borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          padding: '4px', maxWidth: '220px',
        }}>
          <img src={`${thumbTooltip.url}`} style={{ width: '100%', borderRadius: '4px', display: 'block' }} alt="" />
        </div>
      )}
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

      {quickLookOpen && (
        <QuickLookModal files={selectedFiles} auth={auth} onClose={() => setQuickLookOpen(false)} />
      )}
    </motion.div>
  )
}
