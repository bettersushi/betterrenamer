import { MediaPlayer, MediaProvider } from '@vidstack/react'
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'

export default function VidstackVideoPlayer({ src, type = 'video/mp4', poster, autoPlay, onCanPlay, style }) {
  return (
    <MediaPlayer
      src={{ src, type }}
      poster={poster}
      autoPlay={autoPlay}
      load="eager"
      posterLoad="eager"
      playsInline
      crossOrigin
      onCanPlay={onCanPlay}
      className="ql-vidstack-player"
      style={style}
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  )
}
