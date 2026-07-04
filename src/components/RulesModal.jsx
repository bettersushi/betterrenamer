import { useState } from 'react'
import FolderPickerModal from './FolderPickerModal'

const PATTERN_OPTIONS = [
  { value: 'legacy', label: 'Legacy (cartella-counter, vid-/gif- solo su video/gif)' },
  { value: 'folder-ext-seq', label: 'Cartella + Estensione + Sequenza' },
  { value: 'seq-ext', label: 'Sequenza + Estensione' },
  { value: 'folder-seq', label: 'Cartella + Sequenza' },
  { value: 'custom-free', label: 'Personalizzato' },
]

function emptyDraft() {
  return {
    name: '',
    folderId: '',
    folderName: '',
    recursive: false,
    patternConfig: {
      pattern: 'legacy',
      separator: '_',
      startNumber: 1,
      padding: 3,
      customPrefix: '',
      customAddSeq: true,
      customSeqSeparator: '-',
    },
  }
}

export default function RulesModal({ rules, onSave, onClose, onApplyNow, applying, applyMessage, accessToken }) {
  const [draft, setDraft] = useState(null) // null = list view, object = editing/new
  const [showFolderPicker, setShowFolderPicker] = useState(false)

  const startNew = () => setDraft(emptyDraft())
  const startEdit = (rule) => setDraft({ ...rule, patternConfig: { ...rule.patternConfig } })

  const saveDraft = () => {
    if (!draft.name.trim() || !draft.folderId) return
    const existing = rules.find(r => r.id === draft.id)
    if (existing) {
      onSave(rules.map(r => r.id === draft.id ? draft : r))
    } else {
      onSave([...rules, { ...draft, id: crypto.randomUUID() }])
    }
    setDraft(null)
  }

  const deleteRule = (id) => onSave(rules.filter(r => r.id !== id))

  const pc = draft?.patternConfig

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
            {draft ? (rules.find(r => r.id === draft.id) ? 'Modifica regola' : 'Nuova regola') : 'Regole di rinomina'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {!draft ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto', marginBottom: 14 }}>
              {rules.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
                  Nessuna regola definita.
                </div>
              ) : rules.map(rule => (
                <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{rule.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      📁 {rule.folderName}{rule.recursive ? ' (+ sottocartelle)' : ''} · {PATTERN_OPTIONS.find(p => p.value === rule.patternConfig.pattern)?.label}
                    </div>
                  </div>
                  <button onClick={() => startEdit(rule)} style={btnSm}>Modifica</button>
                  <button onClick={() => deleteRule(rule.id)} style={{ ...btnSm, color: '#ef4444' }}>Elimina</button>
                </div>
              ))}
            </div>

            {applyMessage && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>{applyMessage}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <button onClick={startNew} style={btnSecondary}>+ Nuova regola</button>
              <button onClick={onApplyNow} disabled={applying || rules.length === 0} style={btnPrimary}>
                {applying ? 'Applicazione...' : 'Applica ora regole'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-group">
                <label>Nome regola</label>
                <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="es. Foto famiglia" />
              </div>

              <div className="form-group">
                <label>Cartella target</label>
                <button onClick={() => setShowFolderPicker(true)} style={{ ...btnSecondary, textAlign: 'left' }}>
                  {draft.folderName || 'Scegli cartella...'}
                </button>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                <input type="checkbox" checked={draft.recursive} onChange={e => setDraft(d => ({ ...d, recursive: e.target.checked }))} />
                <span style={{ fontSize: 13 }}>Includi sottocartelle</span>
              </label>

              <div className="form-group">
                <label>Pattern</label>
                <select value={pc.pattern} onChange={e => setDraft(d => ({ ...d, patternConfig: { ...d.patternConfig, pattern: e.target.value } }))}>
                  {PATTERN_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              {pc.pattern === 'legacy' ? (
                <div className="pattern-info" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Nome: cartella-counter.ext — ai video viene aggiunto il prefisso vid-, alle gif il prefisso gif-, agli altri file nessun prefisso. Il counter è calcolato automaticamente.
                </div>
              ) : pc.pattern === 'custom-free' ? (
                <>
                  <div className="form-group">
                    <label>Template (placeholder: {'{cartella} {parent} {nonno} {nome} {seq} {data} {anno} {mese} {giorno} {ext}'})</label>
                    <input value={pc.customPrefix} onChange={e => setDraft(d => ({ ...d, patternConfig: { ...d.patternConfig, customPrefix: e.target.value } }))} placeholder="{data}_{nome}" />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                    <input type="checkbox" checked={pc.customAddSeq} onChange={e => setDraft(d => ({ ...d, patternConfig: { ...d.patternConfig, customAddSeq: e.target.checked } }))} />
                    <span style={{ fontSize: 13 }}>Aggiungi sequenza se il template non contiene {'{seq}'}</span>
                  </label>
                </>
              ) : (
                <div className="form-group">
                  <label>Separatore</label>
                  <input value={pc.separator} onChange={e => setDraft(d => ({ ...d, patternConfig: { ...d.patternConfig, separator: e.target.value } }))} />
                </div>
              )}

              {pc.pattern !== 'legacy' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label>Numero iniziale</label>
                    <input type="number" value={pc.startNumber} onChange={e => setDraft(d => ({ ...d, patternConfig: { ...d.patternConfig, startNumber: parseInt(e.target.value) || 1 } }))} />
                  </div>
                  <div className="form-group">
                    <label>Cifre (padding)</label>
                    <input type="number" value={pc.padding} onChange={e => setDraft(d => ({ ...d, patternConfig: { ...d.patternConfig, padding: parseInt(e.target.value) || 1 } }))} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setDraft(null)} style={btnSecondary}>Annulla</button>
              <button onClick={saveDraft} disabled={!draft.name.trim() || !draft.folderId} style={btnPrimary}>Salva regola</button>
            </div>
          </>
        )}
      </div>

      {showFolderPicker && (
        <FolderPickerModal
          accessToken={accessToken}
          title="Cartella target per la regola"
          onClose={() => setShowFolderPicker(false)}
          onConfirm={(folder) => {
            setDraft(d => ({ ...d, folderId: folder.id, folderName: folder.name }))
            setShowFolderPicker(false)
          }}
        />
      )}
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, zIndex: 2500, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const modal = { background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', padding: 20, width: 460, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' }
const btnSm = { padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }
const btnSecondary = { padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }
const btnPrimary = { padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }
