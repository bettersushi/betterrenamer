import { useRef, useState, useCallback } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

export function useFFmpeg() {
  const ffmpegRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [progress, setProgress] = useState(0)
  const loadingRef = useRef(false)

  const load = useCallback(async () => {
    if (ffmpegRef.current && loaded) return
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const ff = new FFmpeg()
      ff.on('progress', ({ progress: p }) => setProgress(p))
      await ff.load({
        coreURL:   await toBlobURL(`${BASE}/ffmpeg-core.js`,   'text/javascript'),
        wasmURL:   await toBlobURL(`${BASE}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${BASE}/ffmpeg-core.worker.js`, 'text/javascript'),
      })
      ffmpegRef.current = ff
      setLoaded(true)
      return ff
    } finally {
      loadingRef.current = false
    }
  }, [])

  return { ffmpeg: ffmpegRef.current, loaded, load, progress }
}
