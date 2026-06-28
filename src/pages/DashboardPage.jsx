import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listFiles, listFilesRecursive, batchRenameFiles, getOrCreateFolder, moveFile } from '../drive'
import { saveSession } from '../logs'
import './DashboardPage.css'

const MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp', '.tiff', '.tif', '.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])

function getExt(name) {
  return name.includes('.') ? name.substring(name.lastIndexOf('.')).toLowerCase() : ''
}
function isMediaFile(file) {
  const ext = getExt(file.name)
  if (MEDIA_EXTENSIONS.has(ext)) return true
  if (file.mimeType && ['image/', 'video/'].some(m => file.mimeType.startsWith(m))) return true
  return false
}
function isVideoFile(name, mimeType) {
  if (mimeType && mimeType.includes('video')) return true
  return VIDEO_EXTENSIONS.has(getExt(name))
}
function generateLegacyName(folderName, fileName, mimeType, counter) {
  const sanitized = folderName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : ''
  let prefix = ''
  if (isVideoFile(fileName, mimeType)) prefix = 'vid-'
  else if (getExt(fileName) === '.gif') prefix = 'gif-'
  return `${sanitized}-${prefix}${counter}${ext}`
}
function buildLegacyPreview(groups) {
  const preview = []
  for (const group of groups) {
    let counter = 100000
    for (const file of group.files) {
      if (!isMediaFile(file)) continue
      const newName = generateLegacyName(group.folderName, file.name, file.mimeType, counter)
      preview.push({ id: file.id, oldName: file.name, newName, folderName: group.folderName, folderId: group.folderId, mimeType: file.mimeType })
      counter += Math.floor(Math.random() * 1000) + 100
    }
  }
  return preview
}

const MAX_PARALLEL = 2
let jobIdCounter = 0

export default function DashboardPage({ auth, onLogout }) {
  const navigate = useNavigate()

  // Browser state
  const [folderPath, setFolderPath] = useState([{ id: 'root', name: 'My Drive' }])
  const [files, setFiles] = useState([])
  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserError, setBrowserError] = useState('')

  // Config
  const [mode, setMode] = useState('legacy')
  const [includeRoot, setIncludeRoot] = useState(false)
  const [organizeMedia, setOrganizeMedia] = useState(true)
  const [pattern, setPattern] = useState('folder-ext-seq')
  const [separator, setSeparator] = useState('_')
  const [startNumber, setStartNumber] = useState(1)
  const [padding, setPadding] = useState(3)

  // Preview inline
  const [preview, setPreview] = useState([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [previewFolder, setPreviewFolder] = useState(null) // cartella a cui si riferisce la preview

  // Queue
  const [queue, setQueue] = useState([])
  const queueRef = useRef([])
  const runningCount = useRef(0)

  const updateJob = useCallback((id, updates) => {
    queueRef.current = queueRef.current.map(j => j.id === id ? { ...j, ...updates } : j)
    setQueue([...queueRef.current])
  }, [])

  const processJob = useCallback(async (job) => {
    runningCount.current++
    updateJob(job.id, { status: 'running', progress: { current: 0, total: job.preview.length, currentFile: '', phase: 'Avvio...' } })

    const entries = []
    const folderCache = {}

    const getMediaFolder = async (parentId, parentName, suffix) => {
      const key = `${parentId}:${suffix}`
      if (!folderCache[key]) {
        folderCache[key] = await getOrCreateFolder(auth.accessToken, `${parentName} ${suffix}`, parentId)
      }
      return folderCache[key]
    }

    const moveItems = job.organizeMedia
      ? job.preview.filter(item => isVideoFile(item.oldName, item.mimeType) || getExt(item.oldName) === '.gif')
      : []

    const total = moveItems.length + job.preview.length
    let current = 0

    // Fase 1: sposta
    for (const item of moveItems) {
      current++
      updateJob(job.id, { progress: { current, total, currentFile: item.oldName, phase: `Sposto → ${item.folderName} ${isVideoFile(item.oldName, item.mimeType) ? 'Vid' : 'Gif'}` } })
      try {
        const suffix = isVideoFile(item.oldName, item.mimeType) ? 'Vid' : 'Gif'
        const destFolder = await getMediaFolder(item.folderId, item.folderName, suffix)
        await moveFile(auth.accessToken, item.id, destFolder.id, item.folderId)
        item.folderId = destFolder.id
        item.folderName = destFolder.name
        entries.push({ type: 'move', oldName: item.oldName, newName: item.oldName, folderName: destFolder.name, success: true })
      } catch (err) {
        entries.push({ type: 'move', oldName: item.oldName, newName: item.oldName, folderName: item.folderName, success: false, error: err.message })
      }
    }

    // Fase 2: rinomina
    for (let i = 0; i < job.preview.length; i++) {
      const item = job.preview[i]
      current++
      updateJob(job.id, { progress: { current, total, currentFile: item.oldName, phase: 'Rinomino' } })
      try {
        await batchRenameFiles(auth.accessToken, [{ id: item.id, oldName: item.oldName, newName: item.newName }])
        entries.push({ type: 'rename', ...item, success: true })
      } catch (err) {
        entries.push({ type: 'rename', ...item, success: false, error: err.message })
      }
      if ((i + 1) % 50 === 0) await new Promise(r => setTimeout(r, 500))
    }

    saveSession({ date: new Date().toISOString(), rootFolder: job.rootFolderName, mode: job.mode, entries })
    updateJob(job.id, { status: 'done', entries, progress: { current: total, total, currentFile: '', phase: 'Completato' } })
    runningCount.current--

    // Avvia prossimi job in coda
    startPending()
  }, [auth.accessToken, updateJob])

  const startPending = useCallback(() => {
    while (runningCount.current < MAX_PARALLEL) {
      const next = queueRef.current.find(j => j.status === 'pending')
      if (!next) break
      processJob(next)
    }
  }, [processJob])

  const handleAddToQueue = () => {
    if (preview.length === 0 || !previewFolder) return
    const job = {
      id: ++jobIdCounter,
      rootFolderName: previewFolder.name,
      rootFolderId: previewFolder.id,
      mode,
      organizeMedia,
      preview: preview.map(p => ({ ...p })),
      status: 'pending',
      progress: { current: 0, total: preview.length, currentFile: '', phase: '' },
      entries: [],
    }
    queueRef.current = [...queueRef.current, job]
    setQueue([...queueRef.current])
    setPreview([])
    setPreviewFolder(null)
    startPending()
  }

  const loadFolder = async (folderId) => {
    setBrowserLoading(true)
    setBrowserError('')
    try {
      const data = await listFiles(auth.accessToken, folderId)
      setFiles(data.files || [])
    } catch (err) {
      setBrowserError('Errore nel caricamento: ' + err.message)
    } finally {
      setBrowserLoading(false)
    }
  }

  useEffect(() => { loadFolder('root') }, [auth.accessToken])

  const handleFolderClick = (folder) => {
    const newPath = [...folderPath, folder]
    setFolderPath(newPath)
    loadFolder(folder.id)
  }

  const handleBackClick = () => {
    if (folderPath.length > 1) {
      const newPath = folderPath.slice(0, -1)
      setFolderPath(newPath)
      loadFolder(newPath[newPath.length - 1].id)
    }
  }

  const handleGeneratePreview = async () => {
    setPreviewLoading(true)
    setPreviewError('')
    setPreview([])
    const currentFolder = folderPath[folderPath.length - 1]
    setPreviewFolder(currentFolder)
    try {
      if (mode === 'legacy') {
        const groups = await listFilesRecursive(auth.accessToken, currentFolder.id, currentFolder.name, includeRoot)
        const built = buildLegacyPreview(groups)
        if (built.length === 0) {
          setPreviewError('Nessun file media trovato' + (includeRoot ? '' : ' nelle sottocartelle') + '.')
        } else {
          setPreview(built)
        }
      } else {
        const nonFolderFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
        const previewList = nonFolderFiles.map((file, index) => {
          const num = (startNumber + index).toString().padStart(padding, '0')
          const ext = file.name.substring(file.name.lastIndexOf('.')) || ''
          const extName = ext.slice(1) || 'file'
          let newName = ''
          if (pattern === 'folder-ext-seq') newName = `${currentFolder.name}${separator}${extName}${separator}${num}${ext}`
          else if (pattern === 'seq-ext') newName = `${num}${separator}${extName}${ext}`
          else if (pattern === 'folder-seq') newName = `${currentFolder.name}${separator}${num}${ext}`
          return { id: file.id, oldName: file.name, newName, folderName: currentFolder.name, folderId: currentFolder.id, mimeType: file.mimeType }
        })
        setPreview(previewList)
      }
    } catch (err) {
      setPreviewError('Errore: ' + err.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleLogout = () => { onLogout(); navigate('/login') }

  const queueHasItems = queue.length > 0
  const runningJobs = queue.filter(j => j.status === 'running')
  const pendingJobs = queue.filter(j => j.status === 'pending')
  const doneJobs = queue.filter(j => j.status === 'done' || j.status === 'error')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <div className="header" style={{ padding: '12px 24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', margin: 0 }}>🔄 BetterRenamer</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Batch rename per Google Drive</p>
        </div>
        <div className="header-actions">
          <div className="user-info">
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Autenticato come</div>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>{auth.email}</div>
          </div>
          <button onClick={() => navigate('/logs')} className="btn-secondary">📋 Logs</button>
          <button onClick={handleLogout} className="btn-secondary">Logout</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 1fr', gap: '16px', padding: '16px 24px', flex: 1, minHeight: 0 }}>

        {/* Colonna 1: Browser */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Esplora cartelle</h3>
          <div className="breadcrumb" style={{ fontSize: '12px' }}>
            {folderPath.map((folder, idx) => (
              <span key={idx}>
                {idx > 0 && <span> / </span>}
                {idx === folderPath.length - 1 ? <strong>{folder.name}</strong> : (
                  <a href="#" onClick={(e) => {
                    e.preventDefault()
                    const newPath = folderPath.slice(0, idx + 1)
                    setFolderPath(newPath)
                    loadFolder(newPath[newPath.length - 1].id)
                  }}>{folder.name}</a>
                )}
              </span>
            ))}
          </div>
          {browserError && <div className="error-message" style={{ fontSize: '12px' }}>{browserError}</div>}
          <div className="file-list" style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            {browserLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '13px' }}>Caricamento...</div>
            ) : files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>Nessun file</div>
            ) : (
              files.map(file => (
                <div
                  key={file.id}
                  onClick={() => { if (file.mimeType === 'application/vnd.google-apps.folder') handleFolderClick(file) }}
                  className={`file-item ${file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : ''}`}
                  style={{ fontSize: '13px', padding: '6px 10px' }}
                >
                  <span className="file-icon">{file.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄'}</span>
                  <span className="file-name">{file.name}</span>
                </div>
              ))
            )}
          </div>
          {folderPath.length > 1 && (
            <button onClick={handleBackClick} className="btn-secondary" style={{ width: '100%', fontSize: '13px', padding: '6px' }}>← Indietro</button>
          )}
        </div>

        {/* Colonna 2: Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Configura pattern</h3>

          <div className="form-group">
            <label>Modalità</label>
            <select value={mode} onChange={(e) => { setMode(e.target.value); setPreview([]) }}>
              <option value="legacy">Legacy (cartella-counter)</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {mode === 'legacy' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="includeRoot" checked={includeRoot} onChange={(e) => { setIncludeRoot(e.target.checked); setPreview([]) }} style={{ width: 'auto', margin: 0 }} />
                <label htmlFor="includeRoot" style={{ margin: 0, cursor: 'pointer', fontSize: '13px' }}>Includi file nella cartella selezionata</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="organizeMedia" checked={organizeMedia} onChange={(e) => setOrganizeMedia(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                <label htmlFor="organizeMedia" style={{ margin: 0, cursor: 'pointer', fontSize: '13px' }}>Sposta video/gif in sottocartelle <em>(Air Vid, Air Gif)</em></label>
              </div>
              <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#888', lineHeight: '1.6' }}>
                Pattern: <code>cartella-[prefix]counter.ext</code><br />
                Prefissi: <code>vid-</code> video · <code>gif-</code> gif<br />
                Sort: data modifica · Ricorsivo
              </div>
            </>
          )}

          {mode === 'custom' && (
            <>
              <div className="form-group">
                <label>Pattern</label>
                <select value={pattern} onChange={(e) => { setPattern(e.target.value); setPreview([]) }}>
                  <option value="folder-ext-seq">Cartella + Estensione + Sequenza</option>
                  <option value="seq-ext">Sequenza + Estensione</option>
                  <option value="folder-seq">Cartella + Sequenza</option>
                </select>
              </div>
              <div className="form-group">
                <label>Separatore</label>
                <input type="text" value={separator} onChange={(e) => { setSeparator(e.target.value); setPreview([]) }} maxLength="3" />
              </div>
              <div className="form-group">
                <label>Numero iniziale</label>
                <input type="number" value={startNumber} onChange={(e) => { setStartNumber(parseInt(e.target.value)); setPreview([]) }} />
              </div>
              <div className="form-group">
                <label>Padding numerico</label>
                <input type="number" value={padding} onChange={(e) => { setPadding(parseInt(e.target.value)); setPreview([]) }} min="1" max="10" />
              </div>
            </>
          )}

          <button onClick={handleGeneratePreview} className="btn-primary" disabled={previewLoading}>
            {previewLoading ? 'Analisi in corso...' : '🔍 Genera preview'}
          </button>
        </div>

        {/* Colonna 3: Preview inline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              Preview
              {preview.length > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>{preview.length} file · {previewFolder?.name}</span>}
            </h3>
          </div>

          {previewError && <div className="error-message" style={{ fontSize: '12px' }}>{previewError}</div>}

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            {preview.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                {previewLoading ? 'Analisi cartelle in corso...' : 'Genera una preview per vedere i file che verranno rinominati.'}
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Cartella</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Originale</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Nuovo nome</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '5px 10px', color: '#aaa', whiteSpace: 'nowrap' }}>{item.folderName}</td>
                      <td style={{ padding: '5px 10px', color: 'var(--text-secondary)' }}>{item.oldName}</td>
                      <td style={{ padding: '5px 10px', color: 'var(--success, #16a34a)', fontWeight: 500 }}>{item.newName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {preview.length > 0 && (
            <button onClick={handleAddToQueue} className="btn-primary">
              ➕ Aggiungi alla coda ({preview.length} file)
            </button>
          )}
        </div>
      </div>

      {/* Queue panel */}
      {queueHasItems && (
        <div style={{ borderTop: '2px solid #e5e7eb', background: '#fafafa', padding: '12px 24px', maxHeight: '260px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              📋 Coda
              {runningJobs.length > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#3b82f6' }}>{runningJobs.length} in esecuzione</span>}
              {pendingJobs.length > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#888' }}>{pendingJobs.length} in attesa</span>}
              {doneJobs.length > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#16a34a' }}>{doneJobs.length} completati</span>}
            </h3>
            {doneJobs.length === queue.length && (
              <button
                onClick={() => { queueRef.current = []; setQueue([]) }}
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '4px 10px' }}
              >
                Svuota
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {queue.map(job => {
              const pct = job.progress.total > 0 ? Math.round((job.progress.current / job.progress.total) * 100) : 0
              const successCount = job.entries.filter(e => e.success).length
              const failCount = job.entries.filter(e => !e.success).length

              return (
                <div key={job.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: job.status === 'running' ? '6px' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>
                        {job.status === 'pending' && '⏳'}
                        {job.status === 'running' && '🔄'}
                        {job.status === 'done' && '✅'}
                        {job.status === 'error' && '❌'}
                      </span>
                      <strong style={{ fontSize: '13px' }}>{job.rootFolderName}</strong>
                      <span style={{ fontSize: '11px', color: '#888' }}>[{job.mode}]</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      {job.status === 'pending' && 'In attesa...'}
                      {job.status === 'running' && `${job.progress.current} / ${job.progress.total}`}
                      {job.status === 'done' && (
                        <>
                          <span style={{ color: '#16a34a' }}>{successCount} ok</span>
                          {failCount > 0 && <span style={{ color: '#dc2626', marginLeft: '6px' }}>{failCount} errori</span>}
                        </>
                      )}
                    </div>
                  </div>

                  {job.status === 'running' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                        <span><strong style={{ color: '#3b82f6' }}>{job.progress.phase}</strong> {job.progress.currentFile}</span>
                        <span>{pct}%</span>
                      </div>
                      <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                        <div style={{ background: '#3b82f6', height: '100%', width: `${pct}%`, transition: 'width 0.2s ease' }} />
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
