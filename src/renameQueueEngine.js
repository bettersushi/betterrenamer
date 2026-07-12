// Pure helpers + cross-tab lock utilities shared between DashboardPage (preview building)
// and RenameQueueContext (queue processing engine), so both stay in sync without duplication.

import { listFiles, listFilesRecursive, getFolderAncestors } from './drive'

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

export function resolvePlaceholders(template, { folderName, parentName, nonnoName, file, num, ext, extName }) {
  const modified = file.modifiedTime ? new Date(file.modifiedTime) : new Date()
  const anno = modified.getFullYear().toString()
  const mese = (modified.getMonth() + 1).toString().padStart(2, '0')
  const giorno = modified.getDate().toString().padStart(2, '0')
  const originalBase = file.name.includes('.') ? file.name.slice(0, file.name.lastIndexOf('.')) : file.name
  return template
    .replace(/{cartella}/g, folderName)
    .replace(/{parent}/g, parentName || folderName)
    .replace(/{nonno}/g, nonnoName || parentName || folderName)
    .replace(/{nome}/g, originalBase)
    .replace(/{seq}/g, num)
    .replace(/{data}/g, `${anno}${mese}${giorno}`)
    .replace(/{anno}/g, anno)
    .replace(/{mese}/g, mese)
    .replace(/{giorno}/g, giorno)
    .replace(/{ext}/g, extName)
}

// config = { pattern, separator, startNumber, padding, customPrefix, customAddSeq, customSeqSeparator, recursive }
export async function buildRenamePreviewForConfig(accessToken, folder, config) {
  const { pattern, separator, startNumber, padding, customPrefix, customAddSeq, customSeqSeparator, recursive } = config
  let fileGroups
  if (recursive) {
    fileGroups = await listFilesRecursive(accessToken, folder.id, folder.name, true)
  } else {
    const data = await listFiles(accessToken, folder.id)
    const nonFolderFiles = (data.files || []).filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && f.mimeType !== 'application/vnd.google-apps.shortcut')
    fileGroups = [{ files: nonFolderFiles, folderName: folder.name, folderId: folder.id }]
  }

  if (pattern === 'legacy') return buildLegacyPreview(fileGroups)

  const template = pattern === 'custom-free' ? (customPrefix || '{nome}') : ''
  const needsAncestors = template.includes('{parent}') || template.includes('{nonno}')
  const ancestorsMap = {}
  if (needsAncestors) {
    const uniqueIds = [...new Set(fileGroups.map(g => g.folderId))]
    await Promise.all(uniqueIds.map(async id => {
      try { ancestorsMap[id] = await getFolderAncestors(accessToken, id, 2) } catch { ancestorsMap[id] = [] }
    }))
  }

  const previewList = []
  let globalIndex = 0
  for (const group of fileGroups) {
    const ancestors = ancestorsMap[group.folderId] || []
    const parentName = ancestors[0]?.name || ''
    const nonnoName = ancestors[1]?.name || ''
    let groupIndex = 0
    for (const file of group.files) {
      const index = recursive ? groupIndex : globalIndex
      const num = (startNumber + index).toString().padStart(padding, '0')
      const ext = file.name.substring(file.name.lastIndexOf('.')) || ''
      const extName = ext.slice(1) || 'file'
      let newName = ''
      if (pattern === 'folder-ext-seq') newName = `${group.folderName}${separator}${extName}${separator}${num}${ext}`
      else if (pattern === 'seq-ext') newName = `${num}${separator}${extName}${ext}`
      else if (pattern === 'folder-seq') newName = `${group.folderName}${separator}${num}${ext}`
      else if (pattern === 'custom-free') {
        const hasSeqToken = template.includes('{seq}')
        const resolved = resolvePlaceholders(template, { folderName: group.folderName, parentName, nonnoName, file, num, ext, extName })
        newName = hasSeqToken || !customAddSeq
          ? `${resolved}${ext}`
          : `${resolved}${customSeqSeparator}${num}${ext}`
      }
      previewList.push({ id: file.id, oldName: file.name, newName, folderName: group.folderName, folderId: group.folderId, mimeType: file.mimeType, thumbnailLink: file.thumbnailLink || null, skip: file.name === newName })
      groupIndex++
      globalIndex++
    }
  }
  return previewList
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
