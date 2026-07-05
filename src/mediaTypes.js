// Shared media-type helpers used by SearchPage (grid/filters) and SimilarityContext (global scan).

export const MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp', '.tiff', '.tif', '.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])

export function getExt(name) {
  return name.includes('.') ? name.substring(name.lastIndexOf('.')).toLowerCase() : ''
}
export function isMediaFile(f) {
  if (f.mimeType === 'application/vnd.google-apps.shortcut') return false
  const ext = getExt(f.name)
  if (MEDIA_EXTENSIONS.has(ext)) return true
  if (f.mimeType && ['image/', 'video/'].some(m => f.mimeType.startsWith(m))) return true
  return false
}
export function isVideoFile(f) {
  if (f.mimeType && f.mimeType.includes('video')) return true
  return VIDEO_EXTENSIONS.has(getExt(f.name))
}
