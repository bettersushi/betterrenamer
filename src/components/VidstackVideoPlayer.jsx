import { useRef, useState } from 'react'
import { MediaPlayer, MediaProvider } from '@vidstack/react'
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'

export default function VidstackVideoPlayer({ src, fallbackSrc, type = 'video/mp4', poster, autoPlay, onCanPlay, style }) {
  const [activeSrc, setActiveSrc] = useState(src)
  const triedFallback = useRef(false)

  const handleError = () => {
    if (!triedFallback.current && fallbackSrc && activeSrc !== fallbackSrc) {
      triedFallback.current = true
      setActiveSrc(fallbackSrc)
    }
  }

  return (
    <MediaPlayer
      key={src}
      src={{ src: activeSrc, type }}
      poster={poster}
      autoPlay={autoPlay}
      load="eager"
      posterLoad="eager"
      playsInline
      onCanPlay={onCanPlay}
      onError={handleError}
      className="ql-vidstack-player"
      style={style}
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  )
}
