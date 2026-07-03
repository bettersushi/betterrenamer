import { useRef, useState, useCallback } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

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
      // Serve core files from our own domain to avoid CDN CORS issues
      await ff.load({
        coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js',   'text/javascript'),
        wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
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
