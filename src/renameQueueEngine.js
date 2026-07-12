// Pure helpers + cross-tab lock utilities shared between DashboardPage (preview building)
// and RenameQueueContext (queue processing engine), so both stay in sync without duplication.

export const MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp', '.tiff', '.tif', '.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])

export function getExt(name) {
  return name.includes('.') ? name.substring(name.lastIndexOf('.')).toLowerCase() : ''
}
export function isMediaFile(file) {
  if (file.mimeType === 'application/vnd.google-apps.shortcut') return false
  const ext = getExt(file.name)
  if (MEDIA_EXTENSIONS.has(ext)) return true
  if (file.mimeType && ['image/', 'video/'].some(m => file.mimeType.startsWith(m))) return true
  return false
}
export function isVideoFile(name, mimeType) {
  if (mimeType && mimeType.includes('video')) return true
  return VIDEO_EXTENSIONS.has(getExt(name))
}
export function formatETA(ms) {
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return `${min}m ${sec}s`
  const h = Math.floor(min / 60)
  return `${h}h ${min % 60}m`
}
export function jobSubfolders(job) {
  const source = job.preview && job.preview.length > 0 ? job.preview : job.entries
  if (!source) return []
  return [...new Set(source.map(p => p.folderName).filter(n => n && n !== job.rootFolderName))]
}
export function baseFolderName(folderName) {
  return folderName.replace(/ (Vid|Gif)$/, '').replace(/^[-_*]+/, '')
}
export function needsMediaMove(item, moveOnly, organizeMedia) {
  if (!moveOnly && !organizeMedia) return false
  const isVideo = isVideoFile(item.oldName, item.mimeType)
  const isGif = getExt(item.oldName) === '.gif'
  if (!isVideo && !isGif) return false
  const suffix = isVideo ? 'Vid' : 'Gif'
  return item.folderName !== `${baseFolderName(item.folderName)} ${suffix}`
}
export function generateLegacyName(folderName, fileName, mimeType, counter) {
  const sanitized = baseFolderName(folderName).toLowerCase().replace(/[^a-z0-9]/g, '-')
  const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : ''
  let prefix = ''
  if (isVideoFile(fileName, mimeType)) prefix = 'vid-'
  else if (getExt(fileName) === '.gif') prefix = 'gif-'
  return `${sanitized}-${prefix}${counter}${ext}`
}
export function matchesLegacyPattern(folderName, fileName, mimeType) {
  const sanitized = baseFolderName(folderName).toLowerCase().replace(/[^a-z0-9]/g, '-')
  const ext = getExt(fileName).replace('.', '\\.')
  const prefix = isVideoFile(fileName, mimeType) ? 'vid-' : getExt(fileName) === '.gif' ? 'gif-' : ''
  return new RegExp(`^${sanitized}-${prefix}\\d+${ext}$`).test(fileName)
}
export function extractLegacyCounter(folderName, fileName) {
  const sanitized = baseFolderName(folderName).toLowerCase().replace(/[^a-z0-9]/g, '-')
  const ext = getExt(fileName).replace('.', '\\.')
  const m = fileName.match(new RegExp(`^${sanitized}-(?:vid-|gif-)?(\\d+)${ext}$`))
  return m ? parseInt(m[1], 10) : null
}
export function buildLegacyPreview(groups) {
  const preview = []
  for (const group of groups) {
    // Passata 1: trovare il counter max tra file già rinominati
    let counter = 100000
    for (const file of group.files) {
      if (!isMediaFile(file)) continue
      if (matchesLegacyPattern(group.folderName, file.name, file.mimeType)) {
        const n = extractLegacyCounter(group.folderName, file.name)
        if (n !== null && n >= counter) counter = n + 1000
      }
    }
    // Passata 2: costruire preview, assegnando counter solo ai file nuovi
    for (const file of group.files) {
      if (!isMediaFile(file)) continue
      const skip = matchesLegacyPattern(group.folderName, file.name, file.mimeType)
      const newName = skip ? file.name : generateLegacyName(group.folderName, file.name, file.mimeType, counter)
      preview.push({ id: file.id, oldName: file.name, newName, folderName: group.folderName, folderId: group.folderId, mimeType: file.mimeType, thumbnailLink: file.thumbnailLink || null, skip })
      if (!skip) counter += Math.floor(Math.random() * 1000) + 100
    }
  }
  return preview
}

export const MAX_PARALLEL = 2
let jobIdCounter = 0
export function nextJobId() { return ++jobIdCounter }

export const TAB_ID = crypto.randomUUID()
export const LOCK_KEY = 'br_processing_lock'
export const LOCK_TTL = 20000 // ms — lock scade se non refreshato

export function readLock() {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY)) } catch { return null }
}
export function acquireLock() {
  const existing = readLock()
  if (existing && existing.tabId !== TAB_ID && Date.now() - existing.ts < LOCK_TTL) return false
  localStorage.setItem(LOCK_KEY, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }))
  return true
}
export function refreshLock() {
  const existing = readLock()
  if (existing?.tabId === TAB_ID) localStorage.setItem(LOCK_KEY, JSON.stringify({ tabId: TAB_ID, ts: Date.now() }))
}
export function releaseLock() {
  const existing = readLock()
  if (existing?.tabId === TAB_ID) localStorage.removeItem(LOCK_KEY)
}
