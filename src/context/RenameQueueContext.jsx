import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { listFiles, listFilesRecursive, getOrCreateFolder, moveFile, renameFile, listSubfolders, patchFileMetadata } from '../drive'
import { saveSession } from '../logs'
import {
  MAX_PARALLEL, nextJobId,
  isVideoFile, getExt, baseFolderName, buildLegacyPreview,
  TAB_ID, LOCK_KEY, readLock, acquireLock, refreshLock, releaseLock,
} from '../renameQueueEngine'

const RenameQueueCtx = createContext(null)

export function RenameQueueProvider({ auth, children }) {
  const authRef = useRef(auth)
  useEffect(() => { authRef.current = auth }, [auth])

  // Cross-tab lock — prevent two windows from running jobs simultaneously
  const [lockedByOther, setLockedByOther] = useState(() => {
    const l = readLock(); return !!(l && l.tabId !== TAB_ID && Date.now() - l.ts < 20000)
  })
  const lockRefreshInterval = useRef(null)

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== LOCK_KEY) return
      const l = readLock()
      setLockedByOther(!!(l && l.tabId !== TAB_ID && Date.now() - l.ts < 20000))
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
    queueRef.current = queueRef.current.map(j => {
      if (j.id !== id) return j
      const merged = { ...j, ...updates }
      if (updates.status === 'running' && !j.startedAt) merged.startedAt = Date.now()
      if (merged.progress && merged.startedAt && merged.progress.current > 0 && merged.progress.total > 0) {
        const elapsed = Date.now() - merged.startedAt
        const rate = elapsed / merged.progress.current
        const remaining = merged.progress.total - merged.progress.current
        merged.progress = { ...merged.progress, etaMs: Math.max(0, Math.round(rate * remaining)) }
      }
      return merged
    })
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
    const auth = authRef.current

    const getMediaFolder = async (parentId, parentName, suffix) => {
      const key = `${parentId}:${suffix}`
      if (!folderCache[key]) {
        folderCache[key] = await getOrCreateFolder(auth.accessToken, `${parentName} ${suffix}`, parentId)
      }
      return folderCache[key]
    }

    const moveItems = (job.moveOnly || job.organizeMedia)
      ? job.preview.filter(item => isVideoFile(item.oldName, item.mimeType) || getExt(item.oldName) === '.gif')
      : []

    const renameItems = job.moveOnly ? [] : job.preview
    const total = moveItems.length + renameItems.length
    let current = 0

    // Fase 1: rinomina (skip in moveOnly)
    for (let i = 0; i < renameItems.length; i++) {
      const item = renameItems[i]
      current++
      if (item.skip) {
        entries.push({ type: 'rename', ...item, success: true, skipped: true })
        continue
      }
      updateJob(job.id, { progress: { current, total, currentFile: item.oldName, currentNewName: item.newName, phase: 'Rinomino' } })
      try {
        await renameFile(auth.accessToken, item.id, item.newName)
        entries.push({ type: 'rename', ...item, success: true })
      } catch (err) {
        entries.push({ type: 'rename', ...item, success: false, error: err.message })
      }
      if ((i + 1) % 50 === 0) await new Promise(r => setTimeout(r, 500))
    }

    // Fase 2: sposta
    for (const item of moveItems) {
      current++
      const suffix = isVideoFile(item.oldName, item.mimeType) ? 'Vid' : 'Gif'
      const alreadyInPlace = item.folderName === `${baseFolderName(item.folderName)} ${suffix}`
      if (alreadyInPlace) {
        entries.push({ type: 'move', oldName: item.oldName, newName: item.newName, folderName: item.folderName, success: true, skipped: true })
        continue
      }
      updateJob(job.id, { progress: { current, total, currentFile: item.oldName, phase: `Sposto → ${item.folderName} ${suffix}` } })
      try {
        const destFolder = await getMediaFolder(item.folderId, item.folderName, suffix)
        await moveFile(auth.accessToken, item.id, destFolder.id, item.folderId)
        item.folderId = destFolder.id
        item.folderName = destFolder.name
        entries.push({ type: 'move', oldName: item.oldName, newName: item.newName, folderName: destFolder.name, success: true })
      } catch (err) {
        entries.push({ type: 'move', oldName: item.oldName, newName: item.newName, folderName: item.folderName, success: false, error: err.message })
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateJob])

  const processBatchOp = useCallback(async (job) => {
    runningCount.current++
    updateJob(job.id, { status: 'running', progress: { current: 0, total: 0, currentFile: '', phase: 'Avvio...' } })
    const auth = authRef.current

    try {
      if (job.type === 'colorByKeyword') {
        let colored = 0
        const rules = (job.rules || []).filter(r => r.keyword?.trim() && r.color)
        if (job.scope === 'drive') {
          // Query diretta Drive per ogni keyword
          for (const rule of rules) {
            let pageToken = null
            do {
              const escaped = rule.keyword.replace(/'/g, "\\'")
              const params = new URLSearchParams({
                q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name contains '${escaped}'`,
                fields: 'files(id,name,folderColorRgb),nextPageToken',
                pageSize: 200,
              })
              if (pageToken) params.set('pageToken', pageToken)
              const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
                headers: { Authorization: `Bearer ${auth.accessToken}` },
              })
              const data = await res.json()
              for (const folder of data.files || []) {
                if (folder.folderColorRgb === rule.color) continue
                updateJob(job.id, { progress: { current: ++colored, total: colored, currentFile: folder.name, phase: `"${rule.keyword}"` } })
                await patchFileMetadata(auth.accessToken, folder.id, { folderColorRgb: rule.color })
              }
              pageToken = data.nextPageToken || null
            } while (pageToken)
          }
        } else {
          // Scope cartella: ricorsione per trovare cartelle a qualsiasi profondità
          const processFolder = async (folderId) => {
            const subs = await listSubfolders(auth.accessToken, folderId)
            for (const folder of subs) {
              for (const rule of rules) {
                if (folder.name.toLowerCase().includes(rule.keyword.toLowerCase()) && folder.folderColorRgb !== rule.color) {
                  updateJob(job.id, { progress: { current: ++colored, total: colored, currentFile: folder.name, phase: `"${rule.keyword}"` } })
                  await patchFileMetadata(auth.accessToken, folder.id, { folderColorRgb: rule.color })
                }
              }
              await processFolder(folder.id)
            }
          }
          await processFolder(job.folderId)
        }
        updateJob(job.id, { status: 'done', progress: { current: colored, total: colored, currentFile: '', phase: `${colored} cartelle colorate` } })

      } else if (job.type === 'colorAllSubfolders') {
        let colored = 0
        const propagateColor = async (folderId, color) => {
          const subs = await listSubfolders(auth.accessToken, folderId)
          for (const sub of subs) {
            if (sub.folderColorRgb !== color) {
              updateJob(job.id, { progress: { current: ++colored, total: colored, currentFile: sub.name, phase: 'Coloro' } })
              await patchFileMetadata(auth.accessToken, sub.id, { folderColorRgb: color })
            }
            await propagateColor(sub.id, color)
          }
        }
        const rootFolderId = job.scope === 'drive' ? 'root' : job.folderId
        const topFolders = await listSubfolders(auth.accessToken, rootFolderId)
        for (const folder of topFolders) {
          if (folder.folderColorRgb) await propagateColor(folder.id, folder.folderColorRgb)
        }
        updateJob(job.id, { status: 'done', progress: { current: colored, total: colored, currentFile: '', phase: `${colored} cartelle colorate` } })

      } else if (job.type === 'normalizeNames') {
        const normalize = (name) => {
          const dot = name.lastIndexOf('.')
          const base = dot > 0 ? name.slice(0, dot) : name
          const ext = dot > 0 ? name.slice(dot).toLowerCase() : ''
          const norm = base.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._\-]/g, '')
          return norm + ext
        }
        const collectFiles = async (folderId) => {
          const data = await listFiles(auth.accessToken, folderId)
          const all = data.files || []
          const files = all.filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
          const folders = all.filter(f => f.mimeType === 'application/vnd.google-apps.folder')
          let result = [...files]
          if (job.scope === 'drive') {
            for (const f of folders) result = result.concat(await collectFiles(f.id))
          }
          return result
        }
        const allFiles = await collectFiles(job.scope === 'drive' ? 'root' : job.folderId)
        const toRename = allFiles.filter(f => normalize(f.name) !== f.name)
        let done = 0
        for (const f of toRename) {
          const newName = normalize(f.name)
          updateJob(job.id, { progress: { current: ++done, total: toRename.length, currentFile: f.name, phase: 'Rinomino' } })
          await renameFile(auth.accessToken, f.id, newName)
        }
        updateJob(job.id, { status: 'done', progress: { current: done, total: toRename.length, currentFile: '', phase: `${done} file rinominati` } })
      }
    } catch (err) {
      updateJob(job.id, { status: 'error', progress: { current: 0, total: 0, currentFile: '', phase: err.message } })
    }

    runningCount.current--
    startPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateJob])

  const startPending = useCallback(() => {
    while (runningCount.current < MAX_PARALLEL) {
      const next = queueRef.current.find(j => j.status === 'pending')
      if (!next) break
      if (next.type === 'colorByKeyword' || next.type === 'colorAllSubfolders' || next.type === 'normalizeNames') {
        processBatchOp(next)
      } else {
        processJob(next)
      }
    }
  }, [processJob, processBatchOp])

  const enqueueJob = useCallback((jobConfig) => {
    const job = { id: nextJobId(), status: 'queued', entries: [], ...jobConfig }
    queueRef.current = [...queueRef.current, job]
    setQueue([...queueRef.current])
    return job.id
  }, [])

  const enqueueRaw = useCallback((jobConfig) => {
    const job = { id: nextJobId(), entries: [], ...jobConfig }
    queueRef.current = [...queueRef.current, job]
    setQueue([...queueRef.current])
    if (job.status === 'pending') startPending()
    return job.id
  }, [startPending])

  const reanalizeAndQueue = useCallback(async (jobId) => {
    const job = queueRef.current.find(j => j.id === jobId)
    if (!job) return
    updateJob(jobId, { status: 'pending', progress: { current: 0, total: 0, currentFile: '', phase: 'Ri-analisi...' } })
    try {
      const groups = await listFilesRecursive(authRef.current.accessToken, job.rootFolderId, job.rootFolderName, true)
      const preview = buildLegacyPreview(groups).filter(p => !p.skip)
      updateJob(jobId, { status: 'pending', preview, progress: { current: 0, total: preview.length, currentFile: '', phase: '' }, entries: [] })
      startPending()
    } catch (e) {
      updateJob(jobId, { status: 'interrupted', progress: { current: 0, total: 0, currentFile: '', phase: '' } })
    }
  }, [updateJob, startPending])

  const restartJob = useCallback((jobId) => { reanalizeAndQueue(jobId) }, [reanalizeAndQueue])

  const restartAll = useCallback(() => {
    const interrupted = queueRef.current.filter(j => j.status === 'interrupted')
    interrupted.forEach(j => reanalizeAndQueue(j.id))
  }, [reanalizeAndQueue])

  const startJob = useCallback((jobId) => {
    queueRef.current = queueRef.current.map(j => j.id === jobId && j.status === 'queued' ? { ...j, status: 'pending' } : j)
    setQueue([...queueRef.current])
    startPending()
  }, [startPending])

  const startAll = useCallback(() => {
    queueRef.current = queueRef.current.map(j => j.status === 'queued' ? { ...j, status: 'pending' } : j)
    setQueue([...queueRef.current])
    startPending()
  }, [startPending])

  const removeQueued = useCallback((jobId) => {
    queueRef.current = queueRef.current.filter(j => !(j.id === jobId && j.status === 'queued'))
    setQueue([...queueRef.current])
  }, [])

  const removeJob = useCallback((jobId) => {
    queueRef.current = queueRef.current.filter(j => j.id !== jobId)
    setQueue([...queueRef.current])
  }, [])

  const clearCompleted = useCallback(() => {
    queueRef.current = queueRef.current.filter(j => j.status !== 'done' && j.status !== 'error')
    setQueue([...queueRef.current])
  }, [])

  const queueHasItems = queue.length > 0
  const interruptedJobs = queue.filter(j => j.status === 'interrupted')
  const queuedJobs = queue.filter(j => j.status === 'queued')
  const runningJobs = queue.filter(j => j.status === 'running')
  const pendingJobs = queue.filter(j => j.status === 'pending')
  const doneJobs = queue.filter(j => j.status === 'done' || j.status === 'error')

  const value = {
    queue, queueHasItems, interruptedJobs, queuedJobs, runningJobs, pendingJobs, doneJobs,
    lockedByOther, setLockedByOther,
    enqueueJob, enqueueRaw,
    startJob, startAll, removeQueued, removeJob,
    restartJob, restartAll, clearCompleted,
  }

  return <RenameQueueCtx.Provider value={value}>{children}</RenameQueueCtx.Provider>
}

export function useRenameQueue() {
  const ctx = useContext(RenameQueueCtx)
  if (!ctx) throw new Error('useRenameQueue must be used within RenameQueueProvider')
  return ctx
}
