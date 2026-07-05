import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { listFiles, searchFilesGlobal } from '../drive'
import { isMediaFile } from '../mediaTypes'

const SearchStateCtx = createContext(null)

function saveNavHistory(entries) {
  try {
    localStorage.setItem('br_nav_history', JSON.stringify(entries.map(({ snapshot, ...rest }) => rest)))
  } catch {}
}

export function SearchStateProvider({ auth, onTokenRefresh, children }) {
  const authRef = useRef(auth)
  useEffect(() => { authRef.current = auth }, [auth])

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

  // Search & similarity view state
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalResults, setGlobalResults] = useState(null)
  const [globalLoading, setGlobalLoading] = useState(false)
  const globalTimerRef = useRef(null)
  const [similarTo, setSimilarTo] = useState(null)
  const [similarResults, setSimilarResults] = useState([])
  const [currentSubfolders, setCurrentSubfolders] = useState([])

  // Selection
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Filters / view prefs
  const [mediaFilter, setMediaFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('modified')
  const [sortDir, setSortDir] = useState('desc')
  const [showSubfolders, setShowSubfolders] = useState(true)

  // Nav history (persisted independently in localStorage) + view stack (in-memory only)
  const [navHistory, setNavHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('br_nav_history')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [viewStack, setViewStack] = useState([])

  // Scroll position of the results grid — a plain ref (no re-render needed)
  const gridScrollTopRef = useRef(0)

  const bootstrappedRef = useRef(false)

  // Refs mirroring frequently-read state, so callbacks below can read the
  // latest values without needing to be re-created (and re-memoized) on
  // every single state change.
  const stateRef = useRef({})
  useEffect(() => {
    stateRef.current = { activeFolderId, activeFolderName, allPhotos, globalQuery, globalResults, similarTo, similarResults, currentSubfolders }
  })
  const treePhotosRef = useRef({})
  useEffect(() => { treePhotosRef.current = treePhotos }, [treePhotos])
  const treeChildrenRef = useRef({})
  useEffect(() => { treeChildrenRef.current = treeChildren }, [treeChildren])
  const treeExpandedRef = useRef({ root: true })
  useEffect(() => { treeExpandedRef.current = treeExpanded }, [treeExpanded])

  const fetchFolder = useCallback(async (folderId) => {
    try {
      const data = await listFiles(authRef.current.accessToken, folderId)
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
  }, [onTokenRefresh])

  const pushView = useCallback(() => {
    const s = stateRef.current
    const snapshot = { activeFolderId: s.activeFolderId, activeFolderName: s.activeFolderName, allPhotos: s.allPhotos, globalQuery: s.globalQuery, globalResults: s.globalResults, similarTo: s.similarTo, similarResults: s.similarResults, currentSubfolders: s.currentSubfolders }
    let entry
    if (s.similarTo) {
      entry = { type: 'similarity', label: s.similarTo.name, key: 'sim:' + s.similarTo.id, snapshot }
    } else if (s.globalResults !== null) {
      entry = { type: 'search', label: s.globalQuery || 'Ricerca', key: 'q:' + s.globalQuery, query: s.globalQuery, snapshot }
    } else {
      entry = { type: 'folder', label: s.activeFolderName, key: 'f:' + s.activeFolderId, folderId: s.activeFolderId, snapshot }
    }
    setNavHistory(h => {
      const next = [entry, ...h.filter(e => e.key !== entry.key)].slice(0, 10)
      saveNavHistory(next)
      return next
    })
    setViewStack(vs => [...vs, snapshot])
  }, [])

  const restoreState = useCallback((snapshot) => {
    setActiveFolderId(snapshot.activeFolderId)
    setActiveFolderName(snapshot.activeFolderName)
    setAllPhotos(snapshot.allPhotos)
    setGlobalQuery(snapshot.globalQuery)
    setGlobalResults(snapshot.globalResults)
    setSimilarTo(snapshot.similarTo)
    setSimilarResults(snapshot.similarResults)
    setCurrentSubfolders(snapshot.currentSubfolders || [])
  }, [])

  const popView = useCallback(() => {
    setViewStack(s => {
      const prev = s[s.length - 1]
      if (!prev) return s
      restoreState(prev)
      return s.slice(0, -1)
    })
  }, [restoreState])

  const selectFolder = useCallback(async (folderId, folderName, pushHistory = true) => {
    if (pushHistory) pushView()
    setActiveFolderId(folderId)
    setActiveFolderName(folderName)
    setSimilarTo(null); setSimilarResults([])
    setGlobalResults(null); setGlobalQuery('')

    if (treePhotosRef.current[folderId]) {
      setAllPhotos(treePhotosRef.current[folderId])
      setCurrentSubfolders(treeChildrenRef.current[folderId] || [])
      return
    }
    setLoading(true)
    try {
      const { subfolders, photos } = await fetchFolder(folderId)
      setTreeChildren(t => ({ ...t, [folderId]: subfolders }))
      setTreePhotos(t => ({ ...t, [folderId]: photos }))
      setAllPhotos(photos)
      setCurrentSubfolders(subfolders)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [fetchFolder, pushView])

  const handleRefreshGrid = useCallback(async () => {
    const s = stateRef.current
    if (s.globalResults !== null) {
      if (s.globalQuery.trim()) {
        setGlobalLoading(true)
        try {
          const data = await searchFilesGlobal(authRef.current.accessToken, s.globalQuery.trim())
          setGlobalResults(data.files || [])
        } catch (e) { console.error(e) }
        finally { setGlobalLoading(false) }
      }
      return
    }
    if (s.similarTo) return
    setLoading(true)
    try {
      const { subfolders, photos } = await fetchFolder(s.activeFolderId)
      setTreeChildren(t => ({ ...t, [s.activeFolderId]: subfolders }))
      setTreePhotos(t => ({ ...t, [s.activeFolderId]: photos }))
      setAllPhotos(photos)
      setCurrentSubfolders(subfolders)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [fetchFolder])

  const handleTreeToggle = useCallback(async (folder, siblingIds = []) => {
    const id = folder.id
    const willExpand = !treeExpandedRef.current[id]
    setTreeExpanded(t => {
      const next = { ...t, [id]: willExpand }
      if (willExpand) siblingIds.forEach(sid => { if (sid !== id) next[sid] = false })
      return next
    })
    if (willExpand && !treeChildrenRef.current[id]) {
      setTreeLoading(t => ({ ...t, [id]: true }))
      try {
        const { subfolders, photos } = await fetchFolder(id)
        setTreeChildren(t => ({ ...t, [id]: subfolders }))
        setTreePhotos(t => ({ ...t, [id]: photos }))
      } catch (e) { console.error(e) }
      finally { setTreeLoading(t => ({ ...t, [id]: false })) }
    }
  }, [fetchFolder])

  const handleFolderJump = useCallback(async (photo) => {
    if (!photo.parents?.[0]) return
    pushView()
    const folderId = photo.parents[0]
    let folderName = photo._parentName || null
    if (!folderName) {
      try {
        const params = new URLSearchParams({ fields: 'id,name' })
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?${params}`, {
          headers: { Authorization: `Bearer ${authRef.current.accessToken}` },
        })
        if (res.ok) { const d = await res.json(); folderName = d.name }
      } catch {}
    }
    folderName = folderName || 'Cartella'
    setActiveFolderId(folderId)
    setActiveFolderName(folderName)
    setSimilarTo(null); setSimilarResults([])
    setGlobalResults(null); setGlobalQuery('')

    if (treePhotosRef.current[folderId]) {
      setAllPhotos(treePhotosRef.current[folderId])
      return
    }
    setLoading(true)
    fetchFolder(folderId).then(({ subfolders, photos }) => {
      setTreeChildren(t => ({ ...t, [folderId]: subfolders }))
      setTreePhotos(t => ({ ...t, [folderId]: photos }))
      setAllPhotos(photos)
      setCurrentSubfolders(subfolders)
    }).catch(console.error).finally(() => setLoading(false))
  }, [pushView, fetchFolder])

  const handleGlobalSearch = useCallback((q) => {
    setGlobalQuery(q)
    clearTimeout(globalTimerRef.current)
    if (!q.trim()) { setGlobalResults(null); return }
    setCurrentSubfolders([])
    globalTimerRef.current = setTimeout(async () => {
      setGlobalLoading(true)
      try {
        const data = await searchFilesGlobal(authRef.current.accessToken, q.trim())
        const files = data.files || []
        setGlobalResults(files)
        const s = stateRef.current
        setNavHistory(h => {
          const snapshot = { activeFolderId: s.activeFolderId, activeFolderName: s.activeFolderName, allPhotos: s.allPhotos, globalQuery: q, globalResults: files, similarTo: null, similarResults: [] }
          const entry = { type: 'search', label: q, key: 'q:' + q, query: q, snapshot }
          const next = [entry, ...h.filter(e => e.key !== entry.key)].slice(0, 10)
          saveNavHistory(next)
          return next
        })
      } catch (e) { console.error(e) }
      finally { setGlobalLoading(false) }
    }, 500)
  }, [])

  const bootstrap = useCallback(async (urlFolder, urlName) => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    setLoading(true)
    try {
      const { subfolders, photos } = await fetchFolder('root')
      setTreeChildren(t => ({ ...t, root: subfolders }))
      setTreePhotos(t => ({ ...t, root: photos }))
      if (urlFolder) {
        setActiveFolderId(urlFolder)
        setActiveFolderName(urlName)
        const { subfolders: sf, photos: fp } = await fetchFolder(urlFolder)
        setTreeChildren(t => ({ ...t, [urlFolder]: sf }))
        setTreePhotos(t => ({ ...t, [urlFolder]: fp }))
        setAllPhotos(fp)
        setCurrentSubfolders(sf)
      } else {
        setAllPhotos(photos)
        setCurrentSubfolders(subfolders)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [fetchFolder])

  const value = {
    treeExpanded, treeChildren, treeLoading, treePhotos,
    activeFolderId, activeFolderName,
    allPhotos, loading,
    globalQuery, setGlobalQuery, globalResults, setGlobalResults, globalLoading,
    similarTo, setSimilarTo, similarResults, setSimilarResults,
    currentSubfolders, setCurrentSubfolders,
    selectionMode, setSelectionMode, selectedIds, setSelectedIds,
    mediaFilter, setMediaFilter, sortOrder, setSortOrder, sortDir, setSortDir,
    showSubfolders, setShowSubfolders,
    navHistory, viewStack,
    gridScrollTopRef,
    fetchFolder,
    pushView, popView, restoreState,
    selectFolder,
    handleTreeToggle,
    handleRefreshGrid,
    handleFolderJump,
    handleGlobalSearch,
    bootstrap,
    setActiveFolderId, setActiveFolderName, setAllPhotos,
    setTreeChildren, setTreePhotos, setTreeExpanded, setTreeLoading,
  }

  return <SearchStateCtx.Provider value={value}>{children}</SearchStateCtx.Provider>
}

export function useSearchState() {
  const ctx = useContext(SearchStateCtx)
  if (!ctx) throw new Error('useSearchState must be used within SearchStateProvider')
  return ctx
}
