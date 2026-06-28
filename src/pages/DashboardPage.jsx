import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listFiles, listFilesRecursive, batchRenameFiles, getOrCreateFolder, moveFile } from '../drive'
import { saveSession } from '../logs'
import './DashboardPage.css'

const MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp', '.tiff', '.tif', '.mp4', '.mov', '.avi', '.mkv', '.m4v', '.wmv', '.3gp', '.webm'])
const MEDIA_MIMETYPES = ['image/', 'video/']

function isMediaFile(file) {
  const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : ''
  if (MEDIA_EXTENSIONS.has(ext)) return true
  if (file.mimeType && MEDIA_MIMETYPES.some(m => file.mimeType.startsWith(m))) return true
  return false
}

function generateLegacyName(folderName, file, counter) {
  const sanitized = folderName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : ''
  let prefix = ''
  if (file.mimeType && file.mimeType.includes('video')) prefix = 'vid-'
  else if (ext.toLowerCase() === '.gif') prefix = 'gif-'
  return `${sanitized}-${prefix}${counter}${ext}`
}

function buildLegacyPreview(groups, startCounter = 100000) {
  const preview = []
  for (const group of groups) {
    let counter = startCounter
    for (const file of group.files) {
      if (!isMediaFile(file)) continue
      const newName = generateLegacyName(group.folderName, file, counter)
      preview.push({ id: file.id, oldName: file.name, newName, folderName: group.folderName, folderId: group.folderId, mimeType: file.mimeType })
      counter += Math.floor(Math.random() * 1000) + 100
    }
  }
  return preview
}

export default function DashboardPage({ auth, onLogout }) {
  const navigate = useNavigate()
  const [folderPath, setFolderPath] = useState([{ id: 'root', name: 'My Drive' }])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('browse')

  // Configurazione
  const [mode, setMode] = useState('legacy') // legacy | custom
  const [includeRoot, setIncludeRoot] = useState(false)
  const [pattern, setPattern] = useState('folder-ext-seq')
  const [separator, setSeparator] = useState('_')
  const [startNumber, setStartNumber] = useState(1)
  const [padding, setPadding] = useState(3)

  // Opzioni legacy
  const [organizeMedia, setOrganizeMedia] = useState(true)

  // Preview e risultati
  const [preview, setPreview] = useState([])
  const [results, setResults] = useState([])

  // Progress
  const [progress, setProgress] = useState({ current: 0, total: 0, currentFile: '', phase: '' })

  const loadFolder = async (folderId) => {
    setLoading(true)
    setError('')
    try {
      const data = await listFiles(auth.accessToken, folderId)
      setFiles(data.files || [])
    } catch (err) {
      setError('Errore nel caricamento: ' + err.message)
    } finally {
      setLoading(false)
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
    setLoading(true)
    setError('')
    try {
      const currentFolder = folderPath[folderPath.length - 1]

      if (mode === 'legacy') {
        const groups = await listFilesRecursive(auth.accessToken, currentFolder.id, currentFolder.name, includeRoot)
        if (groups.length === 0 || groups.every(g => g.files.length === 0)) {
          setError('Nessun file trovato' + (includeRoot ? '' : ' nelle sottocartelle') + '.')
          setLoading(false)
          return
        }
        setPreview(buildLegacyPreview(groups))
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
          return { id: file.id, oldName: file.name, newName, folderName: currentFolder.name }
        })
        setPreview(previewList)
      }

      setStep('preview')
    } catch (err) {
      setError('Errore nella generazione preview: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyRenames = async () => {
    setStep('processing')
    setError('')
    const entries = []
    const currentFolder = folderPath[folderPath.length - 1]

    // Cache cartelle vid/gif per parentId per non ricrearle ogni volta
    const folderCache = {}
    const getMediaFolder = async (parentId, parentName, suffix) => {
      const key = `${parentId}:${suffix}`
      if (!folderCache[key]) {
        folderCache[key] = await getOrCreateFolder(auth.accessToken, `${parentName} ${suffix}`, parentId)
      }
      return folderCache[key]
    }

    // Fase 1: sposta video e gif (solo modalità legacy con organizeMedia attivo)
    const moveItems = mode === 'legacy' && organizeMedia
      ? preview.filter(item => {
          const ext = item.oldName.includes('.') ? item.oldName.substring(item.oldName.lastIndexOf('.')).toLowerCase() : ''
          return item.mimeType?.includes('video') || ext === '.gif'
        })
      : []

    const total = moveItems.length + preview.length
    let current = 0

    if (moveItems.length > 0) {
      for (const item of moveItems) {
        current++
        const ext = item.oldName.includes('.') ? item.oldName.substring(item.oldName.lastIndexOf('.')).toLowerCase() : ''
        const isGif = ext === '.gif'
        const suffix = isGif ? 'Gif' : 'Vid'
        setProgress({ current, total, currentFile: item.oldName, phase: `Sposto in ${item.folderName} ${suffix}` })
        try {
          const destFolder = await getMediaFolder(item.folderId, item.folderName, suffix)
          await moveFile(auth.accessToken, item.id, destFolder.id, item.folderId)
          // Aggiorna folderId e folderName nel preview per il rename successivo
          item.folderId = destFolder.id
          item.folderName = destFolder.name
          entries.push({ type: 'move', oldName: item.oldName, newName: item.oldName, folderName: `${item.folderName}`, destFolder: destFolder.name, success: true })
        } catch (err) {
          entries.push({ type: 'move', oldName: item.oldName, newName: item.oldName, folderName: item.folderName, success: false, error: err.message })
        }
      }
    }

    // Fase 2: rinomina tutti i file (pausa ogni 50 op per rispettare rate limit Drive)
    for (let i = 0; i < preview.length; i++) {
      const item = preview[i]
      current++
      setProgress({ current, total, currentFile: item.oldName, phase: 'Rinomino' })
      try {
        await batchRenameFiles(auth.accessToken, [{ id: item.id, oldName: item.oldName, newName: item.newName }])
        entries.push({ type: 'rename', ...item, success: true })
      } catch (err) {
        entries.push({ type: 'rename', ...item, success: false, error: err.message })
      }
      if ((i + 1) % 50 === 0) await new Promise(r => setTimeout(r, 500))
    }

    setResults(entries)
    saveSession({
      date: new Date().toISOString(),
      rootFolder: currentFolder.name,
      mode,
      entries,
    })

    setStep('done')
    await new Promise(r => setTimeout(r, 500))
    loadFolder(currentFolder.id)
  }

  const handleLogout = () => { onLogout(); navigate('/login') }
  const handleReset = () => { setStep('browse'); setPreview([]); setResults([]); setError('') }

  // === BROWSE ===
  if (step === 'browse') {
    return (
      <div className="container">
        <div className="header">
          <div>
            <h1>🔄 BetterRenamer</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Batch rename per Google Drive</p>
          </div>
          <div className="header-actions">
            <div className="user-info">
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Autenticato come</div>
              <div style={{ fontWeight: 600 }}>{auth.email}</div>
            </div>
            <button onClick={() => navigate('/logs')} className="btn-secondary">📋 Logs</button>
            <button onClick={handleLogout} className="btn-secondary">Logout</button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h3 style={{ marginBottom: '12px' }}>Esplora cartelle</h3>
            <div className="breadcrumb">
              {folderPath.map((folder, idx) => (
                <span key={idx}>
                  {idx > 0 && <span> / </span>}
                  {idx === folderPath.length - 1 ? (
                    <strong>{folder.name}</strong>
                  ) : (
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

            <div className="file-list">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Caricamento...</div>
              ) : files.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Nessun file</div>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => { if (file.mimeType === 'application/vnd.google-apps.folder') handleFolderClick(file) }}
                    className={`file-item ${file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : ''}`}
                  >
                    <span className="file-icon">{file.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄'}</span>
                    <span className="file-name">{file.name}</span>
                  </div>
                ))
              )}
            </div>

            {folderPath.length > 1 && (
              <button onClick={handleBackClick} className="btn-secondary" style={{ width: '100%', marginTop: '12px' }}>← Indietro</button>
            )}
          </div>

          <div>
            <h3 style={{ marginBottom: '12px' }}>Configura pattern</h3>

            <div className="form-group">
              <label>Modalità</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="legacy">Legacy (cartella-counter)</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {mode === 'legacy' && (
              <>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="checkbox" id="includeRoot" checked={includeRoot} onChange={(e) => setIncludeRoot(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  <label htmlFor="includeRoot" style={{ margin: 0, cursor: 'pointer' }}>Includi file nella cartella selezionata</label>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="checkbox" id="organizeMedia" checked={organizeMedia} onChange={(e) => setOrganizeMedia(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                  <label htmlFor="organizeMedia" style={{ margin: 0, cursor: 'pointer' }}>Sposta video/gif in sottocartelle <em>(es. Air Vid, Air Gif)</em></label>
                </div>
              </>
            )}

            {mode === 'legacy' && (
              <div style={{ background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Pattern: <code>cartella-[prefix]counter.ext</code><br />
                Prefissi: <code>vid-</code> per video, <code>gif-</code> per gif<br />
                Ordinamento: data modifica (dal più vecchio)<br />
                Ricorsivo: processa tutte le sottocartelle
              </div>
            )}

            {mode === 'custom' && (
              <>
                <div className="form-group">
                  <label>Pattern di rename</label>
                  <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
                    <option value="folder-ext-seq">Cartella + Estensione + Sequenza</option>
                    <option value="seq-ext">Sequenza + Estensione</option>
                    <option value="folder-seq">Cartella + Sequenza</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Separatore</label>
                  <input type="text" value={separator} onChange={(e) => setSeparator(e.target.value)} maxLength="3" />
                </div>
                <div className="form-group">
                  <label>Numero iniziale</label>
                  <input type="number" value={startNumber} onChange={(e) => setStartNumber(parseInt(e.target.value))} />
                </div>
                <div className="form-group">
                  <label>Padding numerico</label>
                  <input type="number" value={padding} onChange={(e) => setPadding(parseInt(e.target.value))} min="1" max="10" />
                </div>
              </>
            )}

            <button onClick={handleGeneratePreview} className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Analisi in corso...' : 'Genera preview'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // === PREVIEW ===
  if (step === 'preview') {
    return (
      <div className="container">
        <div className="header">
          <h1>🔄 Preview rinominazioni</h1>
          <div className="header-actions">
            <button onClick={handleLogout} className="btn-secondary">Logout</button>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div className="badge success">{preview.length} file da rinominare</div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Cartella</th>
                <th>Nome attuale</th>
                <th>Nuovo nome</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((file, idx) => (
                <tr key={idx}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{file.folderName}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{file.oldName}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{file.newName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button onClick={() => setStep('browse')} className="btn-secondary" style={{ flex: 1 }}>Modifica configurazione</button>
          <button onClick={handleApplyRenames} className="btn-primary" style={{ flex: 1 }}>Applica rinominazioni</button>
        </div>
      </div>
    )
  }

  // === PROCESSING ===
  if (step === 'processing') {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
    return (
      <div className="container">
        <div className="header"><h1>⏳ Rinominazione in corso...</h1></div>
        <div style={{ marginTop: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
            <span><strong style={{ color: 'var(--primary, #3b82f6)', marginRight: '6px' }}>{progress.phase}</strong>{progress.currentFile}</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '12px', overflow: 'hidden' }}>
            <div style={{ background: 'var(--primary, #3b82f6)', height: '100%', width: `${pct}%`, transition: 'width 0.2s ease' }} />
          </div>
          <div style={{ textAlign: 'center', marginTop: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>{pct}%</div>
        </div>
      </div>
    )
  }

  // === DONE ===
  if (step === 'done') {
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    return (
      <div className="container">
        <div className="header">
          <h1>✅ Operazione completata</h1>
          <div className="header-actions">
            <button onClick={() => navigate('/logs')} className="btn-secondary">📋 Logs</button>
            <button onClick={handleLogout} className="btn-secondary">Logout</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{successCount}</div>
            <div className="stat-label">Rinominati</div>
          </div>
          {failCount > 0 && (
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{failCount}</div>
              <div className="stat-label">Errori</div>
            </div>
          )}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr><th>Status</th><th>Cartella</th><th>File</th><th>Messaggio</th></tr>
            </thead>
            <tbody>
              {results.map((r, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center' }}><span style={{ fontSize: '18px' }}>{r.success ? '✅' : '❌'}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{r.folderName}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{r.oldName}</td>
                  <td style={{ color: r.success ? 'var(--success)' : 'var(--danger)' }}>{r.success ? r.newName : r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={handleReset} className="btn-primary" style={{ width: '100%', marginTop: '20px' }}>Nuova sessione</button>
      </div>
    )
  }
}
