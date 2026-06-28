import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listFiles, batchRenameFiles } from '../drive'
import './DashboardPage.css'

export default function DashboardPage({ auth, onLogout }) {
  const navigate = useNavigate()
  const [folderPath, setFolderPath] = useState([{ id: 'root', name: 'My Drive' }])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('browse') // browse, configure, preview, processing

  // Pattern configurazione
  const [pattern, setPattern] = useState('folder-ext-seq')
  const [separator, setSeparator] = useState('_')
  const [startNumber, setStartNumber] = useState(1)
  const [padding, setPadding] = useState(3)
  const [preview, setPreview] = useState([])
  const [results, setResults] = useState([])

  // Carica i file della cartella corrente
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

  useEffect(() => {
    loadFolder('root')
  }, [auth.accessToken])

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

  const handleGeneratePreview = () => {
    const nonFolderFiles = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
    const currentFolder = folderPath[folderPath.length - 1]

    const previewList = nonFolderFiles.map((file, index) => {
      const num = (startNumber + index).toString().padStart(padding, '0')
      const ext = file.name.substring(file.name.lastIndexOf('.')) || ''
      const extName = ext.slice(1) || 'file'

      let newName = ''
      if (pattern === 'folder-ext-seq') {
        newName = `${currentFolder.name}${separator}${extName}${separator}${num}${ext}`
      } else if (pattern === 'seq-ext') {
        newName = `${num}${separator}${extName}${ext}`
      } else if (pattern === 'folder-seq') {
        newName = `${currentFolder.name}${separator}${num}${ext}`
      }

      return {
        id: file.id,
        oldName: file.name,
        newName: newName,
      }
    })

    setPreview(previewList)
    setStep('preview')
  }

  const handleApplyRenames = async () => {
    setStep('processing')
    setLoading(true)
    setError('')

    try {
      const renameList = preview.map(p => ({
        id: p.id,
        oldName: p.oldName,
        newName: p.newName,
      }))

      const renameResults = await batchRenameFiles(auth.accessToken, renameList)
      setResults(renameResults)
      setStep('done')
      // Ricarica i file dopo il rename
      await new Promise(r => setTimeout(r, 1000))
      loadFolder(folderPath[folderPath.length - 1].id)
    } catch (err) {
      setError('Errore durante il rename: ' + err.message)
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  const handleResetToDashboard = () => {
    setStep('browse')
    setPreview([])
    setResults([])
    setError('')
  }

  // === STEP: BROWSE ===
  if (step === 'browse') {
    return (
      <div className="container">
        <div className="header">
          <div>
            <h1>🔄 BetterRenamer</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Batch rename per Google Drive
            </p>
          </div>
          <div className="header-actions">
            <div className="user-info">
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Autenticato come</div>
              <div style={{ fontWeight: 600 }}>{auth.email}</div>
            </div>
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Sinistra: File browser */}
          <div>
            <h3 style={{ marginBottom: '12px' }}>Esplora cartelle</h3>
            <div className="breadcrumb">
              {folderPath.map((folder, idx) => (
                <span key={idx}>
                  {idx > 0 && <span> / </span>}
                  {idx === folderPath.length - 1 ? (
                    <strong>{folder.name}</strong>
                  ) : (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        const newPath = folderPath.slice(0, idx + 1)
                        setFolderPath(newPath)
                        loadFolder(newPath[newPath.length - 1].id)
                      }}
                    >
                      {folder.name}
                    </a>
                  )}
                </span>
              ))}
            </div>

            <div className="file-list">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  Caricamento...
                </div>
              ) : files.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  Nessun file
                </div>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => {
                      if (file.mimeType === 'application/vnd.google-apps.folder') {
                        handleFolderClick(file)
                      }
                    }}
                    className={`file-item ${file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : ''}`}
                  >
                    <span className="file-icon">
                      {file.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄'}
                    </span>
                    <span className="file-name">{file.name}</span>
                  </div>
                ))
              )}
            </div>

            {folderPath.length > 1 && (
              <button onClick={handleBackClick} className="btn-secondary" style={{ width: '100%', marginTop: '12px' }}>
                ← Indietro
              </button>
            )}
          </div>

          {/* Destra: Configurazione */}
          <div>
            <h3 style={{ marginBottom: '12px' }}>Configura pattern</h3>

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
              <input
                type="text"
                value={separator}
                onChange={(e) => setSeparator(e.target.value)}
                maxLength="3"
              />
            </div>

            <div className="form-group">
              <label>Numero iniziale</label>
              <input type="number" value={startNumber} onChange={(e) => setStartNumber(parseInt(e.target.value))} />
            </div>

            <div className="form-group">
              <label>Padding numerico</label>
              <input type="number" value={padding} onChange={(e) => setPadding(parseInt(e.target.value))} min="1" max="10" />
            </div>

            <button onClick={handleGeneratePreview} className="btn-primary" style={{ width: '100%' }}>
              Genera preview
            </button>
          </div>
        </div>
      </div>
    )
  }

  // === STEP: PREVIEW ===
  if (step === 'preview') {
    const successCount = preview.length
    return (
      <div className="container">
        <div className="header">
          <h1>🔄 Preview rinominazioni</h1>
          <div className="header-actions">
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div className="badge success">{successCount} file da rinominare</div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nome attuale</th>
                <th>Nuovo nome</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((file, idx) => (
                <tr key={idx}>
                  <td style={{ color: 'var(--text-secondary)' }}>{file.oldName}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{file.newName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button onClick={() => setStep('browse')} className="btn-secondary" style={{ flex: 1 }}>
            Modifica configurazione
          </button>
          <button onClick={handleApplyRenames} disabled={loading} className="btn-primary" style={{ flex: 1 }}>
            {loading ? 'Rinominando...' : 'Applica rinominazioni'}
          </button>
        </div>
      </div>
    )
  }

  // === STEP: DONE ===
  if (step === 'done') {
    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return (
      <div className="container">
        <div className="header">
          <h1>✅ Operazione completata</h1>
          <div className="header-actions">
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {successCount}
            </div>
            <div className="stat-label">Rinominati</div>
          </div>
          {failCount > 0 && (
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--danger)' }}>
                {failCount}
              </div>
              <div className="stat-label">Errori</div>
            </div>
          )}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>File</th>
                <th>Messaggio</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '18px' }}>{result.success ? '✅' : '❌'}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{result.oldName}</td>
                  <td style={{ color: result.success ? 'var(--success)' : 'var(--danger)' }}>
                    {result.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={handleResetToDashboard} className="btn-primary" style={{ width: '100%', marginTop: '20px' }}>
          Nuova sessione
        </button>
      </div>
    )
  }
}
