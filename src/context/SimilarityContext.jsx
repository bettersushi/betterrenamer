import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { listFilesRecursive } from '../drive'
import { isMediaFile } from '../mediaTypes'
import { computePHash, hammingDistance, PHASH_CACHE_KEY, GLOBAL_SIM_CAP } from '../phash'

const SimilarityCtx = createContext(null)

export function SimilarityProvider({ auth, children }) {
  const authRef = useRef(auth)
  useEffect(() => { authRef.current = auth }, [auth])

  const [balloons, setBalloons] = useState([])
  const pHashCache = useRef({})
  const [pendingView, setPendingView] = useState(null) // { refPhoto, results } consumed once by SearchPage

  const updateBalloon = useCallback((id, patch) =>
    setBalloons(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b)), [])
  const removeBalloon = useCallback((id) =>
    setBalloons(bs => bs.filter(b => b.id !== id)), [])

  // Similarity within a given folder's already-loaded photo list
  const handleSimilarity = useCallback(async (photo, allPhotos) => {
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
  }, [updateBalloon])

  // Similarity across an entire folder tree (recursive Drive scan)
  const handleGlobalSimilarity = useCallback(async (photo, scopeFolder) => {
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
    setBalloons(bs => [...bs, { id, type: 'global', status: 'listing', refPhoto: photo, abortRef, listingFolder: scopeFolder.name, listingCount: 0 }])
    let allMedia = []
    try {
      const folders = await listFilesRecursive(authRef.current.accessToken, scopeFolder.id, scopeFolder.name, true)
      for (const f of folders) {
        if (abortRef.cancelled) return
        const media = f.files.filter(isMediaFile)
        allMedia.push(...media)
        updateBalloon(id, { listingCount: allMedia.length, listingFolder: f.folderName })
      }
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
  }, [updateBalloon])

  const viewResults = useCallback((refPhoto, results) => {
    setPendingView({ refPhoto, results })
  }, [])

  const consumePendingView = useCallback(() => {
    setPendingView(null)
  }, [])

  const value = {
    balloons, updateBalloon, removeBalloon,
    handleSimilarity, handleGlobalSimilarity,
    pendingView, viewResults, consumePendingView,
  }

  return <SimilarityCtx.Provider value={value}>{children}</SimilarityCtx.Provider>
}

export function useSimilarity() {
  const ctx = useContext(SimilarityCtx)
  if (!ctx) throw new Error('useSimilarity must be used within SimilarityProvider')
  return ctx
}
