import { MediaPlayer, MediaProvider } from '@vidstack/react'
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'

export default function VidstackVideoPlayer({ src, poster, autoPlay, onCanPlay, style }) {
  return (
    <MediaPlayer
      src={src}
      poster={poster}
      autoPlay={autoPlay}
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
