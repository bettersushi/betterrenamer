# Preview rename: colonne dedicate + fix conteggio coda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nella preview del rename in dashboard, mostrare colonne separate Rename/Spostamento quando la modalità attiva può generare spostamenti, e far sì che il totale mostrato nella coda conti solo i file che verranno effettivamente elaborati (rename o move necessari), non tutti i file controllati in preview.

**Architecture:** Un unico helper puro `needsMediaMove(item, moveOnly, organizeMedia)` in `src/renameQueueEngine.js` replica la logica di "file già nella cartella di destinazione" già usata a runtime in `RenameQueueContext.jsx` (fasi di move), ma calcolabile in fase di preview/enqueue senza duplicare stato. Viene usato in due punti di `src/pages/DashboardPage.jsx`: nel render della tabella preview (per popolare/nascondere la colonna Spostamento) e in `handleAddToQueue` (per filtrare correttamente cosa va in coda e qual è il totale). Nessun campo nuovo viene aggiunto agli oggetti preview — `needsMediaMove` è derivato al volo dal `folderName`/`oldName`/`mimeType` già presenti su ogni item, quindi resta a costo zero mantenere sincronizzati preview-builder e queue-engine.

**Tech Stack:** React 18 + Vite (no test framework nel repo — verifica tramite script Node ad-hoc per la logica pura, e verifica manuale in browser per la UI).

## Global Constraints

- Nessuna nuova dipendenza da aggiungere.
- Non modificare `RenameQueueContext.jsx` (fase di esecuzione già corretta a runtime) né `buildLegacyPreview`/`buildRenamePreviewForConfig` (shape dei preview item invariata).
- Header "Preview (N)" (`DashboardPage.jsx:901`) e bottone "Aggiungi alla coda (N file)" (`DashboardPage.jsx:947`) restano invariati — contano sempre tutti i file controllati, non solo quelli con azioni pendenti.
- Le modalità senza spostamento possibile (nessun pattern legacy/custom con `organizeMedia` disattivato e non `moveOnly`) mantengono la tabella a 3 colonne esistente, nessuna regressione visiva.

---

### Task 1: Helper `needsMediaMove` in `renameQueueEngine.js`

**Files:**
- Modify: `src/renameQueueEngine.js` (aggiungere dopo `baseFolderName`, riga 37)

**Interfaces:**
- Consumes: `isVideoFile(name, mimeType)` e `getExt(name)` e `baseFolderName(folderName)`, già esportate nello stesso file (righe 7-19, 35-37).
- Produces: `export function needsMediaMove(item, moveOnly, organizeMedia)` — `item` è un oggetto preview con almeno `{ oldName, mimeType, folderName }`; ritorna `boolean`. Verrà importata da `src/pages/DashboardPage.jsx` nei Task 2 e 3.

- [ ] **Step 1: Aggiungere la funzione**

In `src/renameQueueEngine.js`, subito dopo la definizione di `baseFolderName` (riga 37, prima di `generateLegacyName`), inserire:

```js
export function needsMediaMove(item, moveOnly, organizeMedia) {
  if (!moveOnly && !organizeMedia) return false
  const isVideo = isVideoFile(item.oldName, item.mimeType)
  const isGif = getExt(item.oldName) === '.gif'
  if (!isVideo && !isGif) return false
  const suffix = isVideo ? 'Vid' : 'Gif'
  return item.folderName !== `${baseFolderName(item.folderName)} ${suffix}`
}
```

Questo replica esattamente la logica già usata a runtime in `RenameQueueContext.jsx:115-116` (quali item sono candidati al move) combinata con `RenameQueueContext.jsx:144-145` (`alreadyInPlace`): un item necessita move solo se è video/gif, la modalità lo prevede, e non è già nella cartella `"{baseFolderName} Vid|Gif"`.

- [ ] **Step 2: Verifica manuale della logica pura**

Eseguire da terminale (nella root del progetto, `type: module` già configurato in `package.json`):

```bash
node -e "
import('./src/renameQueueEngine.js').then(({ needsMediaMove }) => {
  const alreadyInPlace = { oldName: 'clip.mp4', mimeType: 'video/mp4', folderName: 'Foto2024 Vid' }
  const toMove = { oldName: 'clip.mp4', mimeType: 'video/mp4', folderName: 'Foto2024' }
  const notMedia = { oldName: 'doc.pdf', mimeType: 'application/pdf', folderName: 'Foto2024' }

  console.assert(needsMediaMove(alreadyInPlace, true, false) === false, 'FAIL: alreadyInPlace deve essere false')
  console.assert(needsMediaMove(toMove, true, false) === true, 'FAIL: toMove deve essere true')
  console.assert(needsMediaMove(toMove, false, false) === false, 'FAIL: nessuna modalita attiva deve essere false')
  console.assert(needsMediaMove(notMedia, true, true) === false, 'FAIL: file non media deve essere false')
  console.log('OK: tutti gli assert sono passati')
})
"
```

Expected output: `OK: tutti gli assert sono passati` (nessuna riga `FAIL:` stampata).

- [ ] **Step 3: Commit**

```bash
git add src/renameQueueEngine.js
git commit -m "Feat: helper needsMediaMove per calcolare se un item media va spostato"
```

---

### Task 2: Colonna Spostamento nella tabella preview + raggruppamento righe

**Files:**
- Modify: `src/pages/DashboardPage.jsx:15` (import)
- Modify: `src/pages/DashboardPage.jsx:912-941` (tabella preview)

**Interfaces:**
- Consumes: `needsMediaMove(item, moveOnly, organizeMedia)` da Task 1; `moveOnly` (state, riga 278) e `organizeMedia` (state, riga 280) già in scope nel componente `DashboardPage`.
- Produces: nessuna nuova interfaccia esterna — modifica solo il render.

- [ ] **Step 1: Importare l'helper**

In `src/pages/DashboardPage.jsx:15`, cambiare:

```js
import { getExt, isVideoFile, buildLegacyPreview, formatETA } from '../renameQueueEngine'
```

in:

```js
import { getExt, isVideoFile, buildLegacyPreview, formatETA, needsMediaMove } from '../renameQueueEngine'
```

- [ ] **Step 2: Aggiungere le variabili derivate `showMoveColumn` e `needsAnyAction`**

In `src/pages/DashboardPage.jsx:612`, il componente `DashboardPage` ha `return (` che apre il JSX principale. Subito prima di quella riga (dopo l'ultimo hook/handler del componente, quindi tra la riga 611 e la riga 612 attuali), inserire:

```js
  const showMoveColumn = moveOnly || organizeMedia
  const needsAnyAction = (item) => !item.skip || needsMediaMove(item, moveOnly, organizeMedia)

```

- [ ] **Step 3: Sostituire la tabella preview**

In `src/pages/DashboardPage.jsx`, sostituire il blocco righe 912-941 (dal `<table` all'omonimo `</table>`) con:

```jsx
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Cartella</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Originale</th>
                      <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{showMoveColumn ? 'Rename' : 'Nuovo nome'}</th>
                      {showMoveColumn && (
                        <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Spostamento</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {[...preview.filter(needsAnyAction), ...preview.filter(p => !needsAnyAction(p))].map((item, idx, arr) => {
                      const firstDoneIdx = arr.findIndex(p => !needsAnyAction(p))
                      const isSeparator = firstDoneIdx > 0 && idx === firstDoneIdx
                      const itemNeedsMove = needsMediaMove(item, moveOnly, organizeMedia)
                      return (
                      <tr key={idx} style={{ borderTop: isSeparator ? '2px dotted var(--primary)' : idx > 0 ? '1px solid var(--border)' : 'none', opacity: needsAnyAction(item) ? 1 : 0.45 }}>
                        <td style={{ padding: '4px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '11px' }}>{item.folderName}</td>
                        <td style={{ padding: '4px 6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{item.oldName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '4px 10px', fontWeight: 500, fontSize: '13px', color: item.skip ? 'var(--text-muted)' : 'var(--success, #16a34a)' }}>
                          {moveOnly
                            ? <span style={{ color: 'var(--text-muted)' }}>già ok ✓</span>
                            : item.skip ? 'già ok ✓' : item.newName}
                        </td>
                        {showMoveColumn && (
                          <td style={{ padding: '4px 10px', fontWeight: 500, fontSize: '13px', color: itemNeedsMove ? 'var(--primary)' : 'var(--text-muted)' }}>
                            {itemNeedsMove
                              ? <span>→ {item.folderName} {isVideoFile(item.oldName, item.mimeType) ? 'Vid' : 'Gif'}</span>
                              : 'già ok ✓'}
                          </td>
                        )}
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
```

Nota: in modalità `moveOnly` la colonna Rename mostra sempre "già ok ✓" perché in quella modalità il nome file non cambia mai (`newName: f.name`, vedi `DashboardPage.jsx:578`) — solo la colonna Spostamento è rilevante. Prima di questa modifica quella stessa cella mostrava `→ cartella` (comportamento ora spostato nella nuova colonna dedicata).

- [ ] **Step 4: Verifica manuale in browser**

```bash
npm run dev
```

Aprire `http://localhost:3000`, effettuare login Google, selezionare una cartella con file video/gif e immagini:
1. Con `organizeMedia` disattivato e `moveOnly` disattivato, pattern rename semplice → verificare che la tabella abbia 3 colonne (Cartella, Originale, Nuovo nome), nessuna regressione.
2. Con `organizeMedia` attivo (default) e un pattern rename → verificare 4 colonne, colonna Spostamento popolata solo per i file video/gif non già in `"{Cartella} Vid"`/`"{Cartella} Gif"`.
3. Con `moveOnly` attivo → verificare 4 colonne, colonna Rename sempre "già ok ✓", colonna Spostamento coerente con la cartella di destinazione.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.jsx
git commit -m "Feat: colonna Spostamento dedicata nella tabella preview rename"
```

---

### Task 3: Fix conteggio totale in coda (`handleAddToQueue`)

**Files:**
- Modify: `src/pages/DashboardPage.jsx:355-370` (`handleAddToQueue`)

**Interfaces:**
- Consumes: `needsMediaMove` (Task 1, già importato in Task 2 Step 1).
- Produces: nessuna nuova interfaccia esterna.

- [ ] **Step 1: Aggiornare i filtri in `handleAddToQueue`**

In `src/pages/DashboardPage.jsx`, sostituire (righe 355-370):

```js
  const handleAddToQueue = () => {
    if (preview.length === 0 || !previewFolder) return
    enqueueJob({
      rootFolderName: previewFolder.name,
      rootFolderId: previewFolder.id,
      mode,
      moveOnly,
      organizeMedia: moveOnly ? true : organizeMedia,
      preview: preview.filter(p => !p.skip).map(p => ({ ...p })),
      skipCount: preview.filter(p => p.skip).length,
      progress: { current: 0, total: preview.filter(p => !p.skip).length, currentFile: '', phase: '' },
    })
    setPreview([])
    setPreviewFolder(null)
    setCheckedFolders(new Set())
  }
```

con:

```js
  const handleAddToQueue = () => {
    if (preview.length === 0 || !previewFolder) return
    const effectiveOrganizeMedia = moveOnly ? true : organizeMedia
    const toProcess = preview.filter(p => !p.skip || needsMediaMove(p, moveOnly, effectiveOrganizeMedia))
    enqueueJob({
      rootFolderName: previewFolder.name,
      rootFolderId: previewFolder.id,
      mode,
      moveOnly,
      organizeMedia: effectiveOrganizeMedia,
      preview: toProcess.map(p => ({ ...p })),
      skipCount: preview.length - toProcess.length,
      progress: { current: 0, total: toProcess.length, currentFile: '', phase: '' },
    })
    setPreview([])
    setPreviewFolder(null)
    setCheckedFolders(new Set())
  }
```

Nota: `preview: toProcess` ora può includere item con `skip: true` ma `needsMediaMove` true (es. modalità `moveOnly`, dove `skip` è sempre `false` quindi non cambia nulla; oppure rename+organizeMedia dove un file ha nome già corretto ma va comunque spostato) — questo è corretto e voluto: quell'item deve comunque essere processato (fase di move) in `RenameQueueContext.jsx`, che già gestisce `item.skip` solo per la fase di rename (riga 127-130) e valuta separatamente `alreadyInPlace` per il move (riga 145-148), quindi non serve nessuna modifica lì.

- [ ] **Step 2: Verifica manuale in browser**

Con il dev server già avviato (Task 2 Step 4):
1. Preview in modalità `moveOnly` con 5 file media di cui 2 già nella cartella corretta → cliccare "Aggiungi alla coda" e verificare nel pannello coda (`RenameQueuePanel.jsx`) che il totale mostrato sia 3, non 5.
2. Preview in modalità rename+`organizeMedia` con file che necessitano sia rename che move, alcuni solo rename, alcuni solo move, alcuni nessuna azione → verificare che il totale in coda conti ogni file una sola volta e solo se necessita di almeno un'azione.
3. Verificare che l'header "Preview (N)" e il testo del bottone "Aggiungi alla coda (N file)" continuino a mostrare il numero totale di file controllati (invariato, non filtrato).

- [ ] **Step 3: Commit**

```bash
git add src/pages/DashboardPage.jsx
git commit -m "Fix: totale coda conta solo i file che necessitano rename o spostamento"
```
