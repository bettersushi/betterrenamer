import { useRef } from 'react'
import { MediaPlayer, MediaProvider } from '@vidstack/react'
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'

export default function VidstackVideoPlayer({ src, type = 'video/mp4', poster, autoPlay, onCanPlay, onAspectRatio, style }) {
  const playerRef = useRef(null)

  const handleLoadedMetadata = () => {
    const videoEl = playerRef.current?.provider?.video
    if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
      onAspectRatio?.(`${videoEl.videoWidth} / ${videoEl.videoHeight}`)
    }
  }

  return (
    <MediaPlayer
      ref={playerRef}
      src={{ src, type }}
      poster={poster}
      autoPlay={autoPlay}
      preload="auto"
      load="eager"
      posterLoad="eager"
      playsInline
      crossOrigin
      onCanPlay={onCanPlay}
      onLoadedMetadata={handleLoadedMetadata}
      className="ql-vidstack-player"
      style={style}
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  )
}
