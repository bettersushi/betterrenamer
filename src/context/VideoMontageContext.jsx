import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { useFFmpeg } from '../hooks/useFFmpeg'
import { fetchFile } from '@ffmpeg/util'
import { uploadFile } from '../drive'

const VideoMontageCtx = createContext(null)

const QUALITY = {
  '480p':  { scale: 'scale=-2:480',  crf: 28 },
  '720p':  { scale: 'scale=-2:720',  crf: 26 },
  '1080p': { scale: 'scale=-2:1080', crf: 24 },
}

function defaultQualityFor(clips) {
  const totalMB = clips.reduce((s, c) => s + (parseInt(c.file.size) || 0), 0) / (1024 * 1024)
  if (totalMB < 100) return '1080p'
  if (totalMB < 400) return '720p'
  return '480p'
}

export function VideoMontageProvider({ auth, onTokenRefresh, children }) {
  const { ffmpeg, loaded, load, progress } = useFFmpeg()
  const authRef = useRef(auth)
  useEffect(() => { authRef.current = auth }, [auth])

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMeta, setWizardMeta] = useState(null) // { videos, folderId, folderName }
  const [expanded, setExpanded] = useState(false)
  const [job, setJob] = useState(null)
  const jobRef = useRef(null)
  useEffect(() => { jobRef.current = job }, [job])

  const patchJob = useCallback((patch) => {
    setJob(j => j ? { ...j, ...patch } : j)
  }, [])

  const openWizard = useCallback((videos, folderId, folderName) => {
    setWizardMeta({ videos, folderId, folderName })
    setWizardOpen(true)
  }, [])

  const closeWizard = useCallback(() => {
    setWizardOpen(false)
  }, [])

  const prepareExport = useCallback((clips, folderId, folderName) => {
    setJob({
      clips, folderId, folderName,
      quality: defaultQualityFor(clips),
      status: 'idle', currentClip: 0,
      errorMsg: '', outputBlob: null, outputUrl: null, saveStatus: 'idle',
    })
  }, [])

  const setQuality = useCallback((quality) => {
    patchJob({ quality })
  }, [patchJob])

  const fetchWithRetry = useCallback(async (url) => {
    let token = authRef.current.accessToken
    let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401 && onTokenRefresh) {
      const newToken = await onTokenRefresh()
      if (newToken) res = await fetch(url, { headers: { Authorization: `Bearer ${newToken}` } })
    }
    return res
  }, [onTokenRefresh])

  const startExport = useCallback(async () => {
    const current = jobRef.current
    if (!current) return
    patchJob({ status: 'loading', errorMsg: '' })
    try {
      let ff = ffmpeg
      if (!loaded) ff = await load()
      if (!ff) throw new Error('FFmpeg non disponibile')
      patchJob({ status: 'processing' })
      const { scale, crf } = QUALITY[current.quality]
      const concatLines = []
      const clips = current.clips

      for (let i = 0; i < clips.length; i++) {
        patchJob({ currentClip: i + 1 })
        const { file, trim, crop } = clips[i]
        const res = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`)
        if (!res.ok) throw new Error(`Download fallito: ${file.name}`)
        const blob = await res.blob()
        const inName = `in_${i}.mp4`
        await ff.writeFile(inName, await fetchFile(blob))

        let vf = ''
        if (crop && crop.w > 4 && crop.h > 4) {
          const scaleX = file.videoMediaMetadata?.width  ? file.videoMediaMetadata.width  / crop.vw : 1
          const scaleY = file.videoMediaMetadata?.height ? file.videoMediaMetadata.height / crop.vh : 1
          const rawCx = Math.round(crop.x * scaleX)
          const rawCy = Math.round(crop.y * scaleY)
          const rawCw = Math.round(crop.w * scaleX)
          const rawCh = Math.round(crop.h * scaleY)
          const vidW = file.videoMediaMetadata?.width  ?? rawCw
          const vidH = file.videoMediaMetadata?.height ?? rawCh
          const cx = Math.max(0, Math.min(rawCx, vidW - 2))
          const cy = Math.max(0, Math.min(rawCy, vidH - 2))
          const cw = Math.max(2, Math.min(rawCw, vidW - cx))
          const ch = Math.max(2, Math.min(rawCh, vidH - cy))
          vf = `crop=${cw}:${ch}:${cx}:${cy},${scale}`
        } else {
          vf = scale
        }

        const args = ['-y']
        if (trim) { args.push('-ss', String(trim.start), '-to', String(trim.end)) }
        args.push('-i', inName)
        args.push('-vf', vf, '-c:v', 'libx264', '-crf', String(crf), '-preset', 'fast', '-c:a', 'aac')
        const outName = `clip_${i}.mp4`
        args.push(outName)
        await ff.exec(args)
        await ff.deleteFile(inName)
        concatLines.push(`file '${outName}'`)
      }

      const concatTxt = concatLines.join('\n')
      await ff.writeFile('concat.txt', concatTxt)
      await ff.exec(['-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'output.mp4'])

      const data = await ff.readFile('output.mp4')
      const blob = new Blob([data], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)
      patchJob({ outputBlob: blob, outputUrl: url, status: 'done' })

      for (let i = 0; i < clips.length; i++) { try { await ff.deleteFile(`clip_${i}.mp4`) } catch {} }
      try { await ff.deleteFile('output.mp4') } catch {}
      try { await ff.deleteFile('concat.txt') } catch {}
    } catch (e) {
      console.error(e)
      patchJob({ errorMsg: e.message || 'Errore durante l\'elaborazione', status: 'error' })
    }
  }, [ffmpeg, loaded, load, patchJob, fetchWithRetry])

  const saveToDrive = useCallback(async () => {
    const current = jobRef.current
    if (!current?.outputBlob || !current.folderId) return
    patchJob({ saveStatus: 'saving' })
    try {
      const fileName = `00_${(current.folderName || 'reel').replace(/\s+/g, '-').toLowerCase()}-reel.mp4`
      await uploadFile(authRef.current.accessToken, current.outputBlob, fileName, 'video/mp4', current.folderId)
      patchJob({ saveStatus: 'saved' })
    } catch (e) {
      console.error(e)
      patchJob({ saveStatus: 'error' })
    }
  }, [patchJob])

  const dismiss = useCallback(() => {
    setJob(j => { if (j?.outputUrl) URL.revokeObjectURL(j.outputUrl); return null })
    setWizardOpen(false)
    setExpanded(false)
  }, [])

  const toggleExpanded = useCallback(() => setExpanded(e => !e), [])

  const value = {
    wizardOpen, wizardMeta, openWizard, closeWizard,
    job, prepareExport, setQuality, startExport, saveToDrive, dismiss,
    expanded, toggleExpanded,
    ffmpegProgress: progress,
  }

  return <VideoMontageCtx.Provider value={value}>{children}</VideoMontageCtx.Provider>
}

export function useVideoMontage() {
  const ctx = useContext(VideoMontageCtx)
  if (!ctx) throw new Error('useVideoMontage must be used within VideoMontageProvider')
  return ctx
}
