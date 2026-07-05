# BetterSearch: upload file (immagini/video) con protocollo resumable

## Context

BetterSearch (`src/pages/SearchPage.jsx`) non ha nessuna funzionalità di upload: non esiste alcuna UI per caricare file locali su Drive, né in questa pagina né altrove nell'app (Dashboard incluso). Esiste solo una funzione di basso livello `uploadFile(accessToken, blob, name, mimeType, parentId)` in `src/drive.js:238-249`, usata oggi per caricare blob generati internamente (immagine "enhanced", video montage renderizzato) — mai per file scelti dall'utente dal proprio filesystem. Questa funzione fa un multipart upload semplice, senza progress reporting, senza retry, senza ripresa in caso di interruzione: inadatta così com'è per video potenzialmente grandi caricati dall'utente.

Obiettivo: permettere di caricare immagini, video e GIF nella cartella attualmente aperta in BetterSearch, sia tramite pulsante (file picker) sia trascinando file dal sistema operativo sulla griglia, con upload realmente resumable (ripresa in caso di interruzione di rete) e feedback di progresso visibile.

## Design

### A. `src/driveUpload.js` (nuovo modulo)

Implementa il protocollo di upload resumable di Google Drive:

1. **Inizio sessione**: `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,thumbnailLink,modifiedTime,createdTime,parents,videoMediaMetadata` con body JSON `{ name, parents: [parentId], mimeType }` e header `Authorization: Bearer`. La risposta contiene l'header `Location`: l'URL di sessione univoco per questo upload.
2. **Upload del contenuto**: `PUT` del body (il `File`/`Blob` intero) sull'URL di sessione, con header `Content-Length` e `Content-Type` del file. Eseguito con `XMLHttpRequest` (non `fetch`) per due motivi: (a) evento nativo `upload.onprogress` per il progresso reale in byte, (b) possibilità di abortire (`xhr.abort()`) se l'utente annulla.
3. **Gestione interruzione/errore di rete**: se il PUT fallisce (errore di rete, non un errore applicativo 4xx), prima di ritentare si interroga la sessione con un PUT "di stato" (body vuoto, header `Content-Range: bytes */<size-totale>`) — Drive risponde con `308 Resume Incomplete` e un header `Range` che indica quanti byte ha già ricevuto. Il retry riparte da quel punto (nuovo PUT con `Content-Range: bytes <offset>-<size-1>/<size>` e solo la porzione di file rimanente), fino a un massimo di 3 tentativi automatici.
4. **Risultato**: al completamento (status 200/201) la risposta contiene l'oggetto file Drive completo con tutti i campi richiesti al passo 1, pronto per essere inserito in griglia senza bisogno di un refetch.

Funzione esposta:
```js
export function uploadFileResumable(accessToken, file, parentId, { onProgress, signal } = {}) {
  // ritorna una Promise<DriveFile>, chiama onProgress(bytesSent, totalBytes) durante l'upload,
  // rispetta l'AbortSignal per cancellazioni esplicite
}
```

### B. UI in `SearchPage.jsx`

- **Pulsante toolbar "Carica file"**: apre un `<input type="file" multiple accept="image/*,video/*">` nascosto (stile pattern comune, un `useRef` + click programmatico). I file selezionati vengono accodati per l'upload nella cartella attiva (`activeFolderId`).
- **Drag & drop dal sistema operativo**: sul container della griglia (`gridRef`), nuovi handler `onDragOver`/`onDrop` attivi solo quando `e.dataTransfer.types.includes('Files')` (per distinguere il drop di file OS dal drag interno esistente di foto/cartelle tra directory, che usa `dataTransfer.setData('photoId'|'folderId')` e non popola `types` con `'Files'`). Un overlay visivo leggero (bordo tratteggiato sulla griglia) appare durante il drag-over per dare feedback che il drop è supportato.
- **Filtro tipo file**: sia il file picker (`accept="image/*,video/*"`) sia il drop (filtro lato JS su `file.type.startsWith('image/')`/`'video/'`) accettano solo immagini, video e GIF (GIF rientra in `image/*`); file di altro tipo trascinati vengono ignorati silenziosamente (nessun errore bloccante, semplicemente non entrano in coda).

### C. Coda upload e pannello di progresso

- Stato locale in `SearchPage.jsx`: `const [uploadQueue, setUploadQueue] = useState([])`, ogni elemento `{ id, file, name, progress: 0-1, status: 'uploading'|'done'|'error', error? }`. Niente context globale: la feature è specifica di BetterSearch.
- Ogni file in coda avvia `uploadFileResumable` con `onProgress` che aggiorna `progress` dell'elemento corrispondente in `uploadQueue`. Più file caricano in parallelo (nessuna coda seriale — Drive supporta upload concorrenti, e l'utente vede tutti i progressi insieme).
- **`src/components/UploadQueuePanel.jsx`** (nuovo): pannello flottante in basso a destra, stile coerente con gli altri pannelli/toast già presenti nell'app (es. `RenameQueuePanel`). Una riga per file: nome troncato, barra di progresso, stato. In caso di errore, un pulsante "Riprova" che rilancia `uploadFileResumable` per quel file. Il pannello si nasconde automaticamente qualche secondo dopo che tutti i file sono completati con successo (resta visibile se ci sono errori, finché non vengono risolti o l'utente lo chiude manualmente).
- Al completamento di ogni singolo upload, il file Drive risultante viene inserito in `allPhotos` (stato esistente che alimenta la griglia), così appare immediatamente senza bisogno di ricaricare la cartella.

## File coinvolti
- `src/driveUpload.js` (nuovo)
- `src/components/UploadQueuePanel.jsx` (nuovo)
- `src/pages/SearchPage.jsx` (pulsante toolbar, input file nascosto, handler drag&drop sulla griglia, stato `uploadQueue`, wiring pannello, inserimento in `allPhotos`)

## Fuori scope (per ora, YAGNI)
- Upload in Dashboard (non richiesto, solo BetterSearch).
- Chunking manuale a blocchi fissi durante l'upload normale (si usa un singolo PUT con ripresa solo in caso di interruzione, non upload "a pezzi" pianificato in anticipo — sufficiente per la resumability richiesta).
- Limiti di dimensione file espliciti lato client (si affida ai limiti nativi di Google Drive).

## Verifica end-to-end
1. `npm run build` per confermare l'assenza di errori.
2. In BetterSearch, cliccare "Carica file", selezionare 2-3 immagini/video → verificare comparsa del pannello di progresso, avanzamento barre, inserimento in griglia al completamento.
3. Trascinare un file immagine dal Finder direttamente sulla griglia → stesso comportamento del file picker.
4. Trascinare un file di tipo non supportato (es. PDF) → verificare che venga ignorato senza errori bloccanti.
5. Durante un upload di un file grande, disattivare temporaneamente la rete (o usare throttling/offline in devtools) e poi riattivarla → verificare che l'upload riprenda dal punto di interruzione invece di ripartire da zero o fallire definitivamente.
6. Verificare che il drag interno esistente (spostare foto tra cartelle trascinandole sulla sidebar) continui a funzionare senza interferenze con i nuovi handler di drag&drop.
