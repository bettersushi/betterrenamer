import { useState } from 'react'
import FolderPickerModal from './FolderPickerModal'
import { useRenameQueue } from '../context/RenameQueueContext'
import { isVideoFile, needsMediaMove, buildRenamePreviewForConfig } from '../renameQueueEngine'

const PATTERNS = [
  { value: 'legacy', label: 'Legacy (auto-detect)' },
  { value: 'folder-ext-seq', label: 'Cartella_ext_seq' },
  { value: 'seq-ext', label: 'seq_ext' },
  { value: 'folder-seq', label: 'Cartella_seq' },
  { value: 'custom-free', label: 'Personalizzato' },
]

// initialSelection: { id, name } cartella già selezionata, oppure null per farla scegliere qui dentro
export default function RenameMegaModal({ auth, initialSelection = null, onClose }) {
  const { enqueueJob } = useRenameQueue()
  const [folder, setFolder] = useState(initialSelection)
  const [showFolderPicker, setShowFolderPicker] = useState(!initialSelection)

  const [mode, setMode] = useState('legacy')
  const [moveOnly, setMoveOnly] = useState(false)
  const [includeRoot, setIncludeRoot] = useState(true)
  const [organizeMedia, setOrganizeMedia] = useState(true)
  const [pattern, setPattern] = useState('folder-ext-seq')
  const [separator, setSeparator] = useState('_')
  const [startNumber, setStartNumber] = useState(1)
  const [padding, setPadding] = useState(3)
  const [customPrefix, setCustomPrefix] = useState('')
  const [customAddSeq, setCustomAddSeq] = useState(true)
  const [customSeqSeparator, setCustomSeqSeparator] = useState('-')

  const [preview, setPreview] = useState([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  const effectivePattern = moveOnly ? 'legacy' : mode === 'legacy' ? 'legacy' : pattern
  const effectiveOrganizeMedia = moveOnly ? true : organizeMedia
  const showMoveColumn = moveOnly || effectiveOrganizeMedia
  const needsAnyAction = (item) => !item.skip || needsMediaMove(item, moveOnly, effectiveOrganizeMedia)

  const handleGeneratePreview = async () => {
    if (!folder) return
    setPreviewLoading(true)
    setPreviewError('')
    try {
      const list = await buildRenamePreviewForConfig(auth.accessToken, folder, {
        pattern: effectivePattern,
        separator, startNumber, padding,
        customPrefix, customAddSeq, customSeqSeparator,
        recursive: mode !== 'legacy' ? includeRoot : includeRoot,
      })
      setPreview(list)
    } catch (err) {
      setPreviewError(err.message || 'Errore durante la generazione della preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleAddToQueue = () => {
    if (preview.length === 0 || !folder) return
    const toProcess = preview.filter(p => !p.skip || needsMediaMove(p, moveOnly, effectiveOrganizeMedia))
    enqueueJob({
      rootFolderName: folder.name,
      rootFolderId: folder.id,
      mode: effectivePattern,
      moveOnly,
      organizeMedia: effectiveOrganizeMedia,
      preview: toProcess.map(p => ({ ...p })),
      skipCount: preview.length - toProcess.length,
      progress: { current: 0, total: toProcess.length, currentFile: '', phase: '' },
    })
    onClose()
  }

  return (
    <>
      <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div style={modal}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>Better Renamer</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Cartella: <strong style={{ color: 'var(--text-primary)' }}>{folder?.name || '—'}</strong>{' '}
            <button onClick={() => setShowFolderPicker(true)} style={linkBtn}>cambia</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <label style={toggleRow}>
              <input type="checkbox" checked={moveOnly} onChange={e => setMoveOnly(e.target.checked)} />
              Solo spostamento (moveOnly)
            </label>
            {!moveOnly && (
              <label style={toggleRow}>
                <input type="checkbox" checked={organizeMedia} onChange={e => setOrganizeMedia(e.target.checked)} />
                Organizza media in sottocartelle
              </label>
            )}
            <label style={toggleRow}>
              <input type="checkbox" checked={includeRoot} onChange={e => setIncludeRoot(e.target.checked)} />
              Includi cartella radice / ricorsivo
            </label>
          </div>

          {!moveOnly && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Pattern di rename</div>
              <select value={mode} onChange={e => setMode(e.target.value)} style={select}>
                <option value="legacy">Legacy (auto-detect)</option>
                <option value="custom">Custom</option>
              </select>
              {mode === 'custom' && (
                <select value={pattern} onChange={e => setPattern(e.target.value)} style={{ ...select, marginTop: 8 }}>
                  {PATTERNS.filter(p => p.value !== 'legacy').map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={handleGeneratePreview} disabled={!folder || previewLoading} style={{ ...btnSecondary, opacity: !folder || previewLoading ? 0.5 : 1 }}>
              {previewLoading ? 'Genero preview...' : 'Genera preview'}
            </button>
          </div>

          {previewError && <div style={{ fontSize: 12, color: 'var(--danger, #dc2626)', marginBottom: 10 }}>{previewError}</div>}

          {preview.length > 0 && (
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 14 }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                  <tr>
                    <th style={th}>Cartella</th>
                    <th style={th}>Originale</th>
                    <th style={th}>{showMoveColumn ? 'Rename' : 'Nuovo nome'}</th>
                    {showMoveColumn && <th style={th}>Spostamento</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...preview.filter(needsAnyAction), ...preview.filter(p => !needsAnyAction(p))].map((item, idx, arr) => {
                    const firstDoneIdx = arr.findIndex(p => !needsAnyAction(p))
                    const isSeparator = firstDoneIdx > 0 && idx === firstDoneIdx
                    const itemNeedsMove = needsMediaMove(item, moveOnly, effectiveOrganizeMedia)
                    return (
                      <tr key={idx} style={{ borderTop: isSeparator ? '2px dotted var(--primary)' : idx > 0 ? '1px solid var(--border)' : 'none', opacity: needsAnyAction(item) ? 1 : 0.45 }}>
                        <td style={{ ...td, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '11px' }}>{item.folderName}</td>
                        <td style={td}>{item.oldName}</td>
                        <td style={{ ...td, fontWeight: 500, color: item.skip ? 'var(--text-muted)' : 'var(--success, #16a34a)' }}>
                          {moveOnly ? <span style={{ color: 'var(--text-muted)' }}>già ok ✓</span> : item.skip ? 'già ok ✓' : item.newName}
                        </td>
                        {showMoveColumn && (
                          <td style={{ ...td, fontWeight: 500, color: itemNeedsMove ? 'var(--primary)' : 'var(--text-muted)' }}>
                            {itemNeedsMove ? <span>→ {item.folderName} {isVideoFile(item.oldName, item.mimeType) ? 'Vid' : 'Gif'}</span> : 'già ok ✓'}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={btnSecondary}>Annulla</button>
            <button onClick={handleAddToQueue} disabled={preview.length === 0} style={{ ...btnPrimary, opacity: preview.length === 0 ? 0.5 : 1 }}>
              Aggiungi alla coda
            </button>
          </div>
        </div>
      </div>

      {showFolderPicker && (
        <FolderPickerModal
          accessToken={auth.accessToken}
          title="Scegli la cartella da rinominare"
          onClose={() => { if (!folder) onClose(); else setShowFolderPicker(false) }}
          onConfirm={(f) => { setFolder(f); setShowFolderPicker(false); setPreview([]) }}
        />
      )}
    </>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }
const modal = { background: 'var(--surface)', borderRadius: 14, padding: '20px 22px', width: 640, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid var(--border)' }
const toggleRow = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }
const select = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }
const th = { padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)' }
const td = { padding: '4px 10px', fontSize: '13px' }
const linkBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 12, fontFamily: 'inherit', padding: 0 }
const btnPrimary = { padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnSecondary = { padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
