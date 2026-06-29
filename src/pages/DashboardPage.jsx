import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import logoSrc from '../assets/logo-br.svg'
import { useNavigate } from 'react-router-dom'
import { listFiles, listFilesRecursive, batchRenameFiles, getOrCreateFolder, moveFile, renameFile } from '../drive'
import { saveSession, getSessions, clearSessions, downloadCSV } from '../logs'
import QuickLookModal from '../components/QuickLookModal'
import './DashboardPage.css'

const MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp', '.tiff', '.tif', '.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])

const TAB_ID = crypto.randomUUID()
const LOCK_KEY = 'br_processing_lock'
const LOCK_TTL = 20000 // ms — lock scade se non refreshato

function readLock() {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY)) } catch { return null }
}
function acquireLock() {
  const existing = readLock()
  if (existing && existing.tabId !== TAB_ID && Date.now() - existing.ts < LOCK_TTL) return false
  localStorage.setItem(LOCK_KEY, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }))
  return true
}
function refreshLock() {
  const existing = readLock()
  if (existing?.tabId === TAB_ID) localStorage.setItem(LOCK_KEY, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }))
}
function releaseLock() {
  const existing = readLock()
  if (existing?.tabId === TAB_ID) localStorage.removeItem(LOCK_KEY)
}

function getExt(name) {
  return name.includes('.') ? name.substring(name.lastIndexOf('.')).toLowerCase() : ''
}
function isMediaFile(file) {
  if (file.mimeType === 'application/vnd.google-apps.shortcut') return false
  const ext = getExt(file.name)
  if (MEDIA_EXTENSIONS.has(ext)) return true
  if (file.mimeType && ['image/', 'video/'].some(m => file.mimeType.startsWith(m))) return true
  return false
}
function isVideoFile(name, mimeType) {
  if (mimeType && mimeType.includes('video')) return true
  return VIDEO_EXTENSIONS.has(getExt(name))
}
function generateLegacyName(folderName, fileName, mimeType, counter) {
  const sanitized = folderName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : ''
  let prefix = ''
  if (isVideoFile(fileName, mimeType)) prefix = 'vid-'
  else if (getExt(fileName) === '.gif') prefix = 'gif-'
  return `${sanitized}-${prefix}${counter}${ext}`
}
function matchesLegacyPattern(folderName, fileName, mimeType) {
  const sanitized = folderName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const ext = getExt(fileName).replace('.', '\\.')
  const prefix = isVideoFile(fileName, mimeType) ? 'vid-' : getExt(fileName) === '.gif' ? 'gif-' : ''
  return new RegExp(`^${sanitized}-${prefix}\\d+${ext}$`).test(fileName)
}
function extractLegacyCounter(folderName, fileName) {
  const sanitized = folderName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const ext = getExt(fileName).replace('.', '\\.')
  const m = fileName.match(new RegExp(`^${sanitized}-(?:vid-|gif-)?(\\d+)${ext}$`))
  return m ? parseInt(m[1], 10) : null
}
function buildLegacyPreview(groups) {
  const preview = []
  for (const group of groups) {
    // Passata 1: trovare il counter max tra file già rinominati
    let counter = 100000
    for (const file of group.files) {
      if (!isMediaFile(file)) continue
      if (matchesLegacyPattern(group.folderName, file.name, file.mimeType)) {
        const n = extractLegacyCounter(group.folderName, file.name)
        if (n !== null && n >= counter) counter = n + 1000
      }
    }
    // Passata 2: costruire preview, assegnando counter solo ai file nuovi
    for (const file of group.files) {
      if (!isMediaFile(file)) continue
      const skip = matchesLegacyPattern(group.folderName, file.name, file.mimeType)
      const newName = skip ? file.name : generateLegacyName(group.folderName, file.name, file.mimeType, counter)
      preview.push({ id: file.id, oldName: file.name, newName, folderName: group.folderName, folderId: group.folderId, mimeType: file.mimeType, thumbnailLink: file.thumbnailLink || null, skip })
      if (!skip) counter += Math.floor(Math.random() * 1000) + 100
    }
  }
  return preview
}

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

const MAX_PARALLEL = 2
let jobIdCounter = 0

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

export default function DashboardPage({ auth, onLogout, isDark, onToggleTheme, onTokenRefresh }) {
  const navigate = useNavigate()
  const [logsOpen, setLogsOpen] = useState(false)
  const [logSessions, setLogSessions] = useState([])
  const [logsExpanded, setLogsExpanded] = useState(null)
  const [undoneEntries, setUndoneEntries] = useState(new Set())
  const [undoingEntries, setUndoingEntries] = useState(new Set())

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
  const [includeRoot, setIncludeRoot] = useState(true)
  const [organizeMedia, setOrganizeMedia] = useState(true)
  const [pattern, setPattern] = useState('folder-ext-seq')
  const [separator, setSeparator] = useState('_')
  const [startNumber, setStartNumber] = useState(1)
  const [padding, setPadding] = useState(3)

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

  // Cross-tab lock — prevent two windows from running jobs simultaneously
  const [lockedByOther, setLockedByOther] = useState(() => {
    const l = readLock(); return !!(l && l.tabId !== TAB_ID && Date.now() - l.ts < LOCK_TTL)
  })
  const lockRefreshInterval = useRef(null)

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== LOCK_KEY) return
      const l = readLock()
      setLockedByOther(!!(l && l.tabId !== TAB_ID && Date.now() - l.ts < LOCK_TTL))
    }
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener('storage', onStorage); releaseLock() }
  }, [])

  // Queue — restore interrupted jobs from localStorage on mount
  const [queue, setQueue] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('br_queue_interrupted') || '[]')
      return saved.map(j => ({ ...j, status: 'interrupted' }))
    } catch { return [] }
  })
  const queueRef = useRef(queue)
  const runningCount = useRef(0)

  // Persist active jobs on unload
  useEffect(() => {
    const handler = () => {
      // Save only config needed to re-run — no preview/entries to avoid quota issues
      const toSave = queueRef.current
        .filter(j => j.status === 'queued' || j.status === 'pending' || j.status === 'running' || j.status === 'interrupted')
        .map(j => ({
          id: j.id,
          rootFolderId: j.rootFolderId,
          rootFolderName: j.rootFolderName,
          mode: j.mode,
          organizeMedia: j.organizeMedia,
          skipCount: j.skipCount,
          preview: [], // re-generated on restart
          entries: [],
          status: 'interrupted',
          progress: { current: 0, total: 0, currentFile: '', phase: '' },
        }))
      try {
        if (toSave.length > 0) localStorage.setItem('br_queue_interrupted', JSON.stringify(toSave))
        else localStorage.removeItem('br_queue_interrupted')
      } catch { /* quota exceeded — skip */ }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Clear localStorage when no more interrupted/active jobs remain
  useEffect(() => {
    const active = queue.filter(j => j.status === 'queued' || j.status === 'pending' || j.status === 'running' || j.status === 'interrupted')
    if (active.length === 0) localStorage.removeItem('br_queue_interrupted')
  }, [queue])

  const updateJob = useCallback((id, updates) => {
    queueRef.current = queueRef.current.map(j => j.id === id ? { ...j, ...updates } : j)
    setQueue([...queueRef.current])
  }, [])

  const processJob = useCallback(async (job) => {
    if (!acquireLock()) {
      // Another tab holds the lock — put job back to queued
      updateJob(job.id, { status: 'queued' })
      setLockedByOther(true)
      return
    }
    // Refresh lock every 10s while running
    lockRefreshInterval.current = setInterval(refreshLock, 10000)
    runningCount.current++
    updateJob(job.id, { status: 'running', progress: { current: 0, total: job.preview.length, currentFile: '', phase: 'Avvio...' } })

    const entries = []
    const folderCache = {}

    const getMediaFolder = async (parentId, parentName, suffix) => {
      const key = `${parentId}:${suffix}`
      if (!folderCache[key]) {
        folderCache[key] = await getOrCreateFolder(auth.accessToken, `${parentName} ${suffix}`, parentId)
      }
      return folderCache[key]
    }

    const moveItems = job.organizeMedia
      ? job.preview.filter(item => isVideoFile(item.oldName, item.mimeType) || getExt(item.oldName) === '.gif')
      : []

    const total = moveItems.length + job.preview.length
    let current = 0

    // Fase 1: sposta
    for (const item of moveItems) {
      current++
      updateJob(job.id, { progress: { current, total, currentFile: item.oldName, phase: `Sposto → ${item.folderName} ${isVideoFile(item.oldName, item.mimeType) ? 'Vid' : 'Gif'}` } })
      try {
        const suffix = isVideoFile(item.oldName, item.mimeType) ? 'Vid' : 'Gif'
        const destFolder = await getMediaFolder(item.folderId, item.folderName, suffix)
        await moveFile(auth.accessToken, item.id, destFolder.id, item.folderId)
        item.folderId = destFolder.id
        item.folderName = destFolder.name
        entries.push({ type: 'move', oldName: item.oldName, newName: item.newName, folderName: destFolder.name, success: true })
      } catch (err) {
        entries.push({ type: 'move', oldName: item.oldName, newName: item.newName, folderName: item.folderName, success: false, error: err.message })
      }
    }

    // Fase 2: rinomina
    for (let i = 0; i < job.preview.length; i++) {
      const item = job.preview[i]
      current++
      if (item.skip) {
        entries.push({ type: 'rename', ...item, success: true, skipped: true })
        continue
      }
      updateJob(job.id, { progress: { current, total, currentFile: item.oldName, currentNewName: item.newName, phase: 'Rinomino' } })
      try {
        await batchRenameFiles(auth.accessToken, [{ id: item.id, oldName: item.oldName, newName: item.newName }])
        entries.push({ type: 'rename', ...item, success: true })
      } catch (err) {
        entries.push({ type: 'rename', ...item, success: false, error: err.message })
      }
      if ((i + 1) % 50 === 0) await new Promise(r => setTimeout(r, 500))
    }

    saveSession({ date: new Date().toISOString(), rootFolder: job.rootFolderName, mode: job.mode, entries })
    updateJob(job.id, { status: 'done', entries, progress: { current: total, total, currentFile: '', phase: 'Completato' } })
    runningCount.current--
    if (runningCount.current === 0) {
      clearInterval(lockRefreshInterval.current)
      releaseLock()
    }

    // Avvia prossimi job in coda
    startPending()
  }, [auth.accessToken, updateJob])

  const startPending = useCallback(() => {
    while (runningCount.current < MAX_PARALLEL) {
      const next = queueRef.current.find(j => j.status === 'pending')
      if (!next) break
      processJob(next)
    }
  }, [processJob])

  const handleAddToQueue = () => {
    if (preview.length === 0 || !previewFolder) return
    const job = {
      id: ++jobIdCounter,
      rootFolderName: previewFolder.name,
      rootFolderId: previewFolder.id,
      mode,
      organizeMedia,
      preview: preview.filter(p => !p.skip).map(p => ({ ...p })),
      skipCount: preview.filter(p => p.skip).length,
      status: 'queued',
      progress: { current: 0, total: preview.filter(p => !p.skip).length, currentFile: '', phase: '' },
      entries: [],
    }
    queueRef.current = [...queueRef.current, job]
    setQueue([...queueRef.current])
    setPreview([])
    setPreviewFolder(null)
    setCheckedFolders(new Set())
  }

  const reanalizeAndQueue = useCallback(async (jobId) => {
    const job = queueRef.current.find(j => j.id === jobId)
    if (!job) return
    updateJob(jobId, { status: 'pending', progress: { current: 0, total: 0, currentFile: '', phase: 'Ri-analisi...' } })
    try {
      const groups = await listFilesRecursive(auth.accessToken, job.rootFolderId, job.rootFolderName, true)
      const preview = buildLegacyPreview(groups).filter(p => !p.skip)
      updateJob(jobId, { status: 'pending', preview, progress: { current: 0, total: preview.length, currentFile: '', phase: '' }, entries: [] })
      startPending()
    } catch (e) {
      updateJob(jobId, { status: 'interrupted', progress: { current: 0, total: 0, currentFile: '', phase: '' } })
    }
  }, [auth.accessToken, updateJob, startPending])

  const handleRestartJob = useCallback((jobId) => {
    reanalizeAndQueue(jobId)
  }, [reanalizeAndQueue])

  const handleRestartAll = useCallback(() => {
    const interrupted = queueRef.current.filter(j => j.status === 'interrupted')
    interrupted.forEach(j => reanalizeAndQueue(j.id))
  }, [reanalizeAndQueue])

  const handleStartJob = useCallback((jobId) => {
    queueRef.current = queueRef.current.map(j => j.id === jobId && j.status === 'queued' ? { ...j, status: 'pending' } : j)
    setQueue([...queueRef.current])
    startPending()
  }, [startPending])

  const handleStartAll = useCallback(() => {
    queueRef.current = queueRef.current.map(j => j.status === 'queued' ? { ...j, status: 'pending' } : j)
    setQueue([...queueRef.current])
    startPending()
  }, [startPending])

  const handleRemoveQueued = useCallback((jobId) => {
    queueRef.current = queueRef.current.filter(j => !(j.id === jobId && j.status === 'queued'))
    setQueue([...queueRef.current])
  }, [])

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

  useEffect(() => { loadFolder('root') }, [auth.accessToken])

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
          const data = await listFiles(auth.accessToken, folder.id)
          items = (data.files || [])
            .filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
            .slice(0, 10)
            .map(f => ({ name: f.name, thumb: f.thumbnailLink || null }))
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
    }, 400)
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
        const built = buildLegacyPreview(groups)
        if (built.length === 0) {
          setPreviewError('Nessun file media trovato' + (includeRoot ? '' : ' nelle sottocartelle') + '.')
        } else {
          setPreview(built)
        }
      } else {
        const nonFolderFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && f.mimeType !== 'application/vnd.google-apps.shortcut')
        const previewList = nonFolderFiles.map((file, index) => {
          const num = (startNumber + index).toString().padStart(padding, '0')
          const ext = file.name.substring(file.name.lastIndexOf('.')) || ''
          const extName = ext.slice(1) || 'file'
          let newName = ''
          if (pattern === 'folder-ext-seq') newName = `${currentFolder.name}${separator}${extName}${separator}${num}${ext}`
          else if (pattern === 'seq-ext') newName = `${num}${separator}${extName}${ext}`
          else if (pattern === 'folder-seq') newName = `${currentFolder.name}${separator}${num}${ext}`
          return { id: file.id, oldName: file.name, newName, folderName: currentFolder.name, folderId: currentFolder.id, mimeType: file.mimeType, thumbnailLink: file.thumbnailLink || null, skip: file.name === newName }
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

  const queueHasItems = queue.length > 0
  const interruptedJobs = queue.filter(j => j.status === 'interrupted')
  const queuedJobs = queue.filter(j => j.status === 'queued')
  const runningJobs = queue.filter(j => j.status === 'running')
  const pendingJobs = queue.filter(j => j.status === 'pending')
  const doneJobs = queue.filter(j => j.status === 'done' || j.status === 'error')
  const activeFolderIds = new Set(
    [...queuedJobs, ...runningJobs, ...pendingJobs].flatMap(j => [j.rootFolderId, ...j.preview.map(p => p.folderId)])
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {lockedByOther && (
        <div style={{ background: '#f59e0b', color: '#000', fontSize: 12, fontWeight: 600, padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          ⚠️ Un'altra finestra sta eseguendo un task. I nuovi job verranno messi in attesa fino al termine.
          <button onClick={() => setLockedByOther(false)} style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Ignora</button>
        </div>
      )}
      {/* Header */}
      <div className="header" style={{ padding: '12px 24px', flexShrink: 0, marginBottom: 0 }}>
        <div>
          <h1 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src={logoSrc} alt="" style={{ height: '24px', width: 'auto' }} />
            BetterRenamer
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Batch rename per Google Drive</p>
        </div>
        <div className="header-actions">
          <div className="user-info">
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Autenticato come</div>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>{auth.email}</div>
          </div>
          <button onClick={onToggleTheme} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px' }}>
            {isDark ? <IconSun /> : <IconMoon />}
          </button>
          <button onClick={() => navigate('/search')} className="nav-icon-btn" title="Ricerca foto" style={{ width: 28, height: 28 }}><IconSearch /></button>
          <button onClick={openLogs} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconList /> Logs</button>
          <button onClick={handleLogout} className="btn-secondary">Logout</button>
        </div>
      </div>

      {/* Main content: sidebar + pannello destro */}
      <div className="tool-body">

        {/* Sidebar browser */}
        <div className="sidebar">
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
                    <input
                      type="checkbox"
                      ref={selectAllRef}
                      checked={allChecked}
                      onChange={toggleAllFolders}
                      onClick={e => e.stopPropagation()}
                      style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                    />
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
                        background: isChecked ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : isSelected ? '#eff6ff' : undefined,
                        borderLeft: isChecked ? '3px solid var(--primary)' : isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                      }}
                      onMouseEnter={isFolder ? (e) => handleFolderEnter(e, file) : (e) => handleThumbEnter(e, file)}
                      onMouseMove={isFolder ? handleFolderMove : handleThumbMove}
                      onMouseLeave={isFolder ? handleFolderLeave : handleThumbLeave}
                    >
                      {mode === 'legacy' && isFolder && (
                        <div style={{ paddingLeft: '10px', display: 'flex', alignItems: 'center' }} onClick={e => toggleFolder(file.id, e)}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            onClick={e => toggleFolder(file.id, e)}
                            style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                          />
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, padding: '8px 10px', minWidth: 0 }}>
                        <span className="file-icon" style={{ color: isFolder ? '#f59e0b' : '#6b7280' }}>{isFolder ? <IconFolder /> : <IconFile />}</span>
                        <span className="file-name">{file.name}</span>
                      </div>
                      {!isFolder && (
                        <div className="file-preview-col" onClick={e => e.stopPropagation()}>
                          <IconEye />
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
          <div style={{ fontSize: '11px', color: selectedFiles.length > 0 ? '#3b82f6' : '#bbb', textAlign: 'center', padding: '4px 0' }}>
            {selectedFiles.length > 0
              ? `${selectedFiles.length} selezionato${selectedFiles.length > 1 ? 'i' : ''} · Spazio per anteprima`
              : 'Click · Cmd+click per più · Spazio anteprima'}
          </div>
          {recentFolders.length > 0 && (
            <div className="recent-folders">
              <div className="recent-folders-label">Recenti</div>
              <div className="recent-folders-tags">
                {recentFolders.map(f => (
                  <button
                    key={f.id}
                    className="recent-tag"
                    onClick={() => { setFolderPath([{ id: 'root', name: 'My Drive' }, f]); loadFolder(f.id); setCheckedFolders(new Set()) }}
                    title={f.name}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pannello destro: Config + Preview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Config */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="form-group">
              <label>Modalità</label>
              <select value={mode} onChange={(e) => { setMode(e.target.value); setPreview([]) }}>
                <option value="legacy">Legacy (cartella-counter)</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {mode === 'legacy' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="includeRoot" checked={includeRoot} onChange={(e) => { setIncludeRoot(e.target.checked); setPreview([]) }} style={{ width: 'auto', margin: 0 }} />
                  <label htmlFor="includeRoot" style={{ margin: 0, cursor: 'pointer', fontSize: '13px' }}>Includi file nella cartella selezionata</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="organizeMedia" checked={organizeMedia} onChange={(e) => setOrganizeMedia(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  <label htmlFor="organizeMedia" style={{ margin: 0, cursor: 'pointer', fontSize: '13px' }}>Sposta video/gif in sottocartelle</label>
                </div>
                <div className="pattern-info">
                  Pattern: <code>cartella-[prefix]counter.ext</code> · Prefissi: <code>vid-</code> <code>gif-</code> · Sort: data modifica · Ricorsivo
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
                  </select>
                </div>
                <div className="form-group">
                  <label>Separatore</label>
                  <input type="text" value={separator} onChange={(e) => { setSeparator(e.target.value); setPreview([]) }} maxLength="3" />
                </div>
                <div className="form-group">
                  <label>Numero iniziale</label>
                  <input type="number" value={startNumber} onChange={(e) => { setStartNumber(parseInt(e.target.value)); setPreview([]) }} />
                </div>
                <div className="form-group">
                  <label>Padding numerico</label>
                  <input type="number" value={padding} onChange={(e) => { setPadding(parseInt(e.target.value)); setPreview([]) }} min="1" max="10" />
                </div>
              </div>
            )}

            <button onClick={handleGeneratePreview} className="btn-primary" disabled={previewLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <IconSearch /> {previewLoading ? 'Analisi in corso...' : 'Genera preview'}
            </button>
          </div>

          {/* Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0 }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              Preview
              {preview.length > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>{preview.length} file · {previewFolder?.name}</span>}
            </h3>

            {previewError && <div className="error-message" style={{ fontSize: '12px' }}>{previewError}</div>}

            <div style={{ overflowY: 'auto', maxHeight: '320px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
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
                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Nuovo nome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...preview.filter(p => !p.skip), ...preview.filter(p => p.skip)].map((item, idx, arr) => {
                      const firstSkipIdx = arr.findIndex(p => p.skip)
                      const isSeparator = firstSkipIdx > 0 && idx === firstSkipIdx
                      return (
                      <tr key={idx} style={{ borderTop: isSeparator ? '2px dotted var(--primary)' : idx > 0 ? '1px solid var(--border)' : 'none', opacity: item.skip ? 0.45 : 1 }}>
                        <td style={{ padding: '4px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '11px' }}>{item.folderName}</td>
                        <td style={{ padding: '4px 6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{item.oldName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '4px 10px', fontWeight: 500, fontSize: '13px', color: item.skip ? 'var(--text-muted)' : 'var(--success, #16a34a)' }}>
                          {item.skip ? 'già ok ✓' : item.newName}
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {preview.length > 0 && (
              <button onClick={handleAddToQueue} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <IconPlus /> Aggiungi alla coda ({preview.length} file)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Queue panel */}
      {queueHasItems && (
        <div className="queue-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconList /> Coda
              {queuedJobs.length > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>{queuedJobs.length} in coda</span>}
              {runningJobs.length > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#3b82f6' }}>{runningJobs.length} in esecuzione</span>}
              {pendingJobs.length > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#888' }}>{pendingJobs.length} in partenza</span>}
              {doneJobs.length > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#16a34a' }}>{doneJobs.length} completati</span>}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {interruptedJobs.length > 0 && (
                <button onClick={handleRestartAll} className="btn-avvia-tutto" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}>
                  <IconPlay /> Riavvia tutto
                </button>
              )}
              {queuedJobs.length > 0 && (
                <button onClick={handleStartAll} className="btn-avvia-tutto">
                  <IconPlay /> Avvia tutto
                </button>
              )}
              {runningJobs.length > 0 && (
                <span style={{ color: '#3b82f6', display: 'flex', animation: 'dancer-bounce 0.6s ease-in-out infinite alternate' }}>
                  <IconDancer />
                </span>
              )}
              {doneJobs.length > 0 && (
                <button
                  onClick={() => {
                    queueRef.current = queueRef.current.filter(j => j.status !== 'done' && j.status !== 'error')
                    setQueue([...queueRef.current])
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  Svuota
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {queue.map(job => {
              const pct = job.progress.total > 0 ? Math.round((job.progress.current / job.progress.total) * 100) : 0
              const successCount = job.entries.filter(e => e.success).length
              const failCount = job.entries.filter(e => !e.success).length

              return (
                <div key={job.id} className="queue-job">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: job.status === 'running' ? '6px' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', color: job.status === 'interrupted' ? '#f59e0b' : '#888' }}>
                        {job.status === 'interrupted' && <IconX />}
                        {job.status === 'queued' && <IconClock />}
                        {job.status === 'pending' && <IconClock />}
                        {job.status === 'running' && <IconRefresh />}
                        {job.status === 'done' && <IconCheck />}
                        {job.status === 'error' && <IconX />}
                      </span>
                      <strong style={{ fontSize: '13px' }}>{job.rootFolderName}</strong>
                      <span style={{ fontSize: '11px', color: '#888' }}>[{job.mode}]</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#888' }}>
                      {job.status === 'queued' && (
                        <>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{job.progress.total} file</span>
                          <button onClick={() => handleStartJob(job.id)} className="btn-primary" style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }} title="Avvia">
                            <IconPlay /> Avvia
                          </button>
                          <button onClick={() => handleRemoveQueued(job.id)} className="btn-secondary" style={{ fontSize: '11px', padding: '3px 6px', color: 'var(--danger)' }} title="Rimuovi">
                            <IconXSmall />
                          </button>
                        </>
                      )}
                      {job.status === 'interrupted' && (
                        <>
                          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>Interrotto</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{job.preview.length} file</span>
                          <button onClick={() => handleRestartJob(job.id)} className="btn-primary" style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IconPlay /> Riavvia
                          </button>
                          <button onClick={() => { queueRef.current = queueRef.current.filter(j => j.id !== job.id); setQueue([...queueRef.current]) }} className="btn-secondary" style={{ fontSize: '11px', padding: '3px 6px', color: 'var(--danger)' }}>
                            <IconXSmall />
                          </button>
                        </>
                      )}
                      {job.status === 'pending' && 'In partenza...'}
                      {job.status === 'running' && `${job.progress.current} / ${job.progress.total}`}
                      {job.status === 'done' && (
                        <>
                          <span style={{ color: '#16a34a' }}>{successCount} ok</span>
                          {job.skipCount > 0 && <span style={{ color: 'var(--text-muted)', marginLeft: '6px', opacity: 0.6 }}>{job.skipCount} già ok</span>}
                          {failCount > 0 && <span style={{ color: '#dc2626', marginLeft: '6px' }}>{failCount} errori</span>}
                        </>
                      )}
                    </div>
                  </div>

                  {job.status === 'running' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                        <span>
                          <strong style={{ color: '#3b82f6' }}>{job.progress.phase}</strong>{' '}
                          <span style={{ opacity: 0.7 }}>{job.progress.currentFile}</span>
                          {job.progress.currentNewName && (
                            <span style={{ opacity: 0.5 }}> → </span>
                          )}
                          {job.progress.currentNewName && (
                            <span style={{ color: '#3b82f6', opacity: 0.9 }}>{job.progress.currentNewName}</span>
                          )}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="queue-progress-bg">
                        <div style={{ background: '#3b82f6', height: '100%', width: `${pct}%`, transition: 'width 0.2s ease' }} />
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
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
                  <button onClick={handleRestartAll} className="btn-avvia-tutto" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}>
                    <IconPlay /> Riavvia tutto
                  </button>
                </div>
              )}
              {interruptedJobs.map(job => (
                <div key={job.id} className="session-card" style={{ marginBottom: '8px', borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: '13px' }}>{job.rootFolderName}</strong>
                      <span style={{ fontSize: '11px', color: '#f59e0b', marginLeft: '8px' }}>Interrotto — {job.preview.length} file</span>
                    </div>
                    <button onClick={() => handleRestartJob(job.id)} className="btn-primary" style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IconPlay /> Riavvia
                    </button>
                    <button onClick={() => { queueRef.current = queueRef.current.filter(j => j.id !== job.id); setQueue([...queueRef.current]) }} className="btn-secondary" style={{ fontSize: '11px', padding: '3px 6px', color: 'var(--danger)' }}>
                      <IconXSmall />
                    </button>
                  </div>
                </div>
              ))}
              {queuedJobs.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In coda ({queuedJobs.length})</span>
                  <button onClick={handleStartAll} className="btn-avvia-tutto">
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
                      <button onClick={() => handleStartJob(job.id)} className="btn-primary" style={{ fontSize: '11px', padding: '3px 9px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconPlay /> Avvia
                      </button>
                      <button onClick={() => handleRemoveQueued(job.id)} className="btn-secondary" style={{ fontSize: '11px', padding: '3px 6px', color: 'var(--danger)' }} title="Rimuovi">
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
                      <span style={{ fontSize: '12px', color: '#3b82f6', flexShrink: 0 }}>
                        {job.status === 'running' ? `${pct}%` : '⏳'}
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
      {folderTooltip?.items && (
        <div style={{
          position: 'fixed', left: folderTooltip.x, top: folderTooltip.y,
          zIndex: 2000, pointerEvents: 'none',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          padding: '6px', minWidth: '220px', maxWidth: '300px',
        }}>
          {folderTooltip.items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '4px 6px',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
            }}>
              {item.thumb
                ? <img src={item.thumb} style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} alt="" />
                : <span style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'var(--border)', flexShrink: 0, display: 'block' }} />
              }
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            </div>
          ))}
        </div>
      )}

      {quickLookOpen && (
        <QuickLookModal files={selectedFiles} onClose={() => setQuickLookOpen(false)} />
      )}
    </div>
  )
}
