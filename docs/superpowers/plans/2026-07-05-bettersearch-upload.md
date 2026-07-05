# BetterSearch Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add resumable file upload (images/video/gif) to BetterSearch, via a toolbar button and OS drag-and-drop, with a progress panel.

**Architecture:** A standalone `driveUpload.js` module implements Google Drive's resumable upload protocol (init session → PUT with progress via XHR → on-failure resume via offset query). `SearchPage.jsx` owns an `uploadQueue` array in local state, drives uploads through that module, and renders a new `UploadQueuePanel` component for progress/errors. No global context — this is BetterSearch-only.

**Tech Stack:** React (existing), `XMLHttpRequest` for upload progress (fetch has no upload-progress event), Google Drive REST API v3 resumable upload.

## Global Constraints

- No test framework exists in this repo (no Jest/Vitest configured) — verification steps use `npm run build` plus manual browser checks instead of automated tests. Every task still ends with a concrete, followable verification.
- Only `image/*` and `video/*` files are accepted (GIF is `image/gif`, already covered). Other file types dropped/selected are silently ignored, no error shown.
- Uploads target the currently active folder (`activeFolderId` in `SearchPage.jsx`).
- Field set for any Drive file object returned/created must match the existing convention already used elsewhere in `src/drive.js`: `id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,parents,videoMediaMetadata`.
- Reuse the existing global CSS class `.queue-progress-bg` (defined in `src/components/RenameQueuePanel.css`, already loaded app-wide since `RenameQueuePanel` is always mounted) for progress bars — do not redefine it.

---

### Task 1: `driveUpload.js` — resumable upload module

**Files:**
- Create: `src/driveUpload.js`

**Interfaces:**
- Produces: `uploadFileResumable(accessToken: string, file: File, parentId: string, options?: { onProgress?: (sentBytes: number, totalBytes: number) => void }) => Promise<DriveFile>` — `DriveFile` has fields `id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,parents,videoMediaMetadata` (or a subset, per Drive API response). Throws `Error` with a human-readable Italian message on unrecoverable failure.

- [ ] **Step 1: Write the module**

```js
// src/driveUpload.js
const UPLOAD_FIELDS = 'id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,parents,videoMediaMetadata'
const RETRY_LIMIT = 3

async function startResumableSession(accessToken, file, parentId) {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=${UPLOAD_FIELDS}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Content-Length': String(file.size),
      },
      body: JSON.stringify({ name: file.name, parents: [parentId] }),
    }
  )
  if (!res.ok) throw new Error('Impossibile avviare la sessione di upload')
  const location = res.headers.get('Location')
  if (!location) throw new Error('Sessione di upload senza indirizzo di ripresa')
  return location
}

function putFromOffset(sessionUrl, file, start, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', sessionUrl, true)
    const total = file.size
    xhr.setRequestHeader('Content-Range', `bytes ${start}-${total - 1}/${total}`)
    xhr.upload.onprogress = (e) => {
      if (onProgress) onProgress(start + e.loaded, total)
    }
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try { resolve({ done: true, file: JSON.parse(xhr.responseText) }) }
        catch { resolve({ done: true, file: null }) }
      } else if (xhr.status === 308) {
        resolve({ done: false })
      } else {
        reject(new Error(`Upload fallito (codice ${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Errore di rete durante l\'upload'))
    xhr.onabort = () => reject(new Error('Upload annullato'))
    xhr.send(start > 0 ? file.slice(start) : file)
  })
}

function queryUploadedOffset(sessionUrl, total) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', sessionUrl, true)
    xhr.setRequestHeader('Content-Range', `bytes */${total}`)
    xhr.onload = () => {
      if (xhr.status === 308) {
        const range = xhr.getResponseHeader('Range')
        const match = range && /bytes=0-(\d+)/.exec(range)
        resolve(match ? parseInt(match[1], 10) + 1 : 0)
      } else if (xhr.status === 200 || xhr.status === 201) {
        resolve(total)
      } else {
        reject(new Error(`Impossibile verificare lo stato dell'upload (codice ${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Errore di rete durante il controllo di stato'))
    xhr.send()
  })
}

export async function uploadFileResumable(accessToken, file, parentId, { onProgress } = {}) {
  const sessionUrl = await startResumableSession(accessToken, file, parentId)
  let offset = 0
  let attempt = 0
  while (true) {
    try {
      const result = await putFromOffset(sessionUrl, file, offset, onProgress)
      if (result.done) {
        if (onProgress) onProgress(file.size, file.size)
        return result.file
      }
      offset = await queryUploadedOffset(sessionUrl, file.size)
    } catch (err) {
      attempt += 1
      if (attempt > RETRY_LIMIT) throw err
      offset = await queryUploadedOffset(sessionUrl, file.size)
    }
  }
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no new errors (module isn't imported anywhere yet, so this only checks syntax validity via Vite's transform step — it will still be transformed even if unused since it's a `src/` file, but won't be included in any chunk yet).

- [ ] **Step 3: Commit**

```bash
git add src/driveUpload.js
git commit -m "Add resumable Drive upload module (driveUpload.js)"
```

---

### Task 2: `UploadQueuePanel.jsx` — progress panel component

**Files:**
- Create: `src/components/UploadQueuePanel.jsx`
- Create: `src/components/UploadQueuePanel.css`

**Interfaces:**
- Consumes: nothing from other tasks (pure presentational component).
- Produces: `export default function UploadQueuePanel({ queue, onRetry, onDismiss })` where `queue` is an array of `{ id: string, name: string, progress: number /* 0..1 */, status: 'uploading'|'done'|'error', error?: string }`, `onRetry(id: string)`, `onDismiss(id: string)`. Renders `null` if `queue` is empty. This shape is what Task 3 must produce in `SearchPage.jsx`'s `uploadQueue` state.

- [ ] **Step 1: Write the CSS**

```css
/* src/components/UploadQueuePanel.css */
.upload-job {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
```

- [ ] **Step 2: Write the component**

```jsx
// src/components/UploadQueuePanel.jsx
import './UploadQueuePanel.css'

const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconXSmall = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

export default function UploadQueuePanel({ queue, onRetry, onDismiss }) {
  if (!queue || queue.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 3999,
      width: 340, maxWidth: 'calc(100vw - 40px)', maxHeight: '60vh',
      display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto',
    }}>
      {queue.map(item => {
        const pct = Math.round((item.progress || 0) * 100)
        return (
          <div key={item.id} className="upload-job">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, overflow: 'hidden' }}>
                {item.status === 'uploading' && <span style={{ display: 'flex', color: '#3b82f6' }}><IconRefresh /></span>}
                {item.status === 'done' && <span style={{ display: 'flex' }}><IconCheck /></span>}
                {item.status === 'error' && <span style={{ display: 'flex' }}><IconX /></span>}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }} title={item.name}>{item.name}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {item.status === 'uploading' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}%</span>}
                {item.status === 'error' && (
                  <button onClick={() => onRetry(item.id)} className="btn-primary" style={{ fontSize: 11, padding: '3px 8px' }}>Riprova</button>
                )}
                <button onClick={() => onDismiss(item.id)} className="btn-secondary" style={{ fontSize: 11, padding: '3px 6px' }} title="Rimuovi">
                  <IconXSmall />
                </button>
              </span>
            </div>
            {item.status === 'uploading' && (
              <div className="queue-progress-bg">
                <div style={{ background: '#3b82f6', height: '100%', width: `${pct}%`, transition: 'width 0.2s ease' }} />
              </div>
            )}
            {item.status === 'error' && (
              <div style={{ fontSize: 11, color: '#dc2626' }}>{item.error}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build succeeds (component isn't imported yet, purely a syntax/type check via Vite transform).

- [ ] **Step 4: Commit**

```bash
git add src/components/UploadQueuePanel.jsx src/components/UploadQueuePanel.css
git commit -m "Add UploadQueuePanel component"
```

---

### Task 3: Wire upload queue state + toolbar button into `SearchPage.jsx`

**Files:**
- Modify: `src/pages/SearchPage.jsx`

**Interfaces:**
- Consumes: `uploadFileResumable` from `src/driveUpload.js` (Task 1); `UploadQueuePanel` from `src/components/UploadQueuePanel.jsx` (Task 2); existing `auth.accessToken`, `activeFolderId`, `setAllPhotos` (already defined in `SearchPage.jsx`).
- Produces: `enqueueUploads(fileList: FileList | File[])` — used by both the toolbar file input (this task) and the drag-and-drop handler (Task 4). Must remain stable enough to be called from a `<input onChange>` and, in Task 4, from a grid `onDrop` handler.

- [ ] **Step 1: Add imports**

In `src/pages/SearchPage.jsx`, near the top with the other imports (after the `FolderContextMenu` import added previously):

```js
import { uploadFileResumable } from '../driveUpload'
import UploadQueuePanel from '../components/UploadQueuePanel'
```

- [ ] **Step 2: Add state and refs**

Find this block (added in the previous BetterSearch context-menu work):
```js
  const [gridContextMenu, setGridContextMenu] = useState(null) // { x, y }
```
Add right after it:
```js
  const [uploadQueue, setUploadQueue] = useState([]) // { id, name, progress, status: 'uploading'|'done'|'error', error }
  const uploadQueueRef = useRef(uploadQueue)
  const uploadInputRef = useRef(null)
```

Find the block of other top-level `useEffect` calls in the component (any existing one, e.g. near `exitSelectionMode`'s definition) and add this effect to keep the ref mirrored (needed so `retryUpload` can read the current file objects without a stale closure, and without side effects inside a state updater):
```js
  useEffect(() => { uploadQueueRef.current = uploadQueue }, [uploadQueue])
```

- [ ] **Step 3: Add `startUpload`, `enqueueUploads`, `retryUpload`**

Place these right after `handleRenameFolder` (defined in the previous BetterSearch work, near `handleCreateFolder`):

```js
  const startUpload = useCallback((item) => {
    setUploadQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'uploading', progress: 0, error: null } : x))
    uploadFileResumable(auth.accessToken, item.file, activeFolderId, {
      onProgress: (sent, total) => {
        setUploadQueue(q => q.map(x => x.id === item.id ? { ...x, progress: total > 0 ? sent / total : 0 } : x))
      },
    }).then(newFile => {
      setUploadQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'done', progress: 1 } : x))
      if (newFile) setAllPhotos(photos => [newFile, ...photos])
      setTimeout(() => {
        setUploadQueue(q => q.filter(x => x.id !== item.id))
      }, 3000)
    }).catch(err => {
      setUploadQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'error', error: err.message } : x))
    })
  }, [auth.accessToken, activeFolderId])

  const enqueueUploads = useCallback((fileList) => {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
    if (files.length === 0) return
    const items = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file, name: file.name, progress: 0, status: 'uploading', error: null,
    }))
    setUploadQueue(q => [...q, ...items])
    items.forEach(item => startUpload(item))
  }, [startUpload])

  const retryUpload = useCallback((id) => {
    const item = uploadQueueRef.current.find(x => x.id === id)
    if (item) startUpload(item)
  }, [startUpload])

  const dismissUpload = useCallback((id) => {
    setUploadQueue(q => q.filter(x => x.id !== id))
  }, [])
```

Note: `item.file` must survive in the queue entry (it's stored in `enqueueUploads`'s `items` array and never stripped out by `startUpload`'s `setUploadQueue` updaters, which only spread `...x` and override specific fields — the `file` field is preserved throughout).

- [ ] **Step 4: Add hidden file input + toolbar button**

Find this block (added in the previous BetterSearch work):
```jsx
              <button
                onClick={() => handleCreateFolder(activeFolderId, activeFolderName)}
                className="thumb-size-btn"
                title="Nuova cartella qui"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
                  <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
                </svg>
              </button>
```
Add right after the closing `</button>`:
```jsx
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={e => { enqueueUploads(e.target.files); e.target.value = '' }}
              />
              <button
                onClick={() => uploadInputRef.current?.click()}
                className="thumb-size-btn"
                title="Carica file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </button>
```

- [ ] **Step 5: Render the panel**

Find where `FolderContextMenu`/other modals are rendered near the end of the component's JSX return (e.g. right before the closing of the main returned fragment/div, alongside other top-level overlays like the rename modal added previously). Add:
```jsx
      <UploadQueuePanel queue={uploadQueue} onRetry={retryUpload} onDismiss={dismissUpload} />
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, log in, open BetterSearch, click the new "Carica file" button (upload-arrow icon next to "Nuova cartella qui"), pick 1-2 small images.
Expected: a panel appears bottom-right showing the file name(s) with a progress bar advancing to 100%, then the row disappears after ~3 seconds; the uploaded image appears in the grid without a manual refresh.

- [ ] **Step 8: Commit**

```bash
git add src/pages/SearchPage.jsx
git commit -m "Wire upload queue and toolbar button into SearchPage"
```

---

### Task 4: Drag-and-drop OS files onto the grid

**Files:**
- Modify: `src/pages/SearchPage.jsx`

**Interfaces:**
- Consumes: `enqueueUploads` (Task 3).
- Produces: nothing new consumed by later tasks — this is the last functional task.

- [ ] **Step 1: Add drag-over state**

Near the `uploadQueue` state added in Task 3, add:
```js
  const [isDraggingFilesOver, setIsDraggingFilesOver] = useState(false)
```

- [ ] **Step 2: Add drag handlers to the grid container**

Find the grid scroll container (already modified in the previous BetterSearch work with `onClick`/`onContextMenu`):
```jsx
              ref={gridRef}
              className={`${thumbSize === 'masonry' ? 'search-masonry-scroll' : 'search-grid-scroll'}${isDraggingPhotos ? ' dragging-active' : ''}`}
              onMouseDown={handleGridMouseDown}
              onMouseMove={handleGridMouseMove}
              onScroll={handleGridScroll}
              onClick={e => {
                if (wasDragging.current) return
                if (e.target.closest('[data-photo-id]')) return
                if (selectionMode) exitSelectionMode()
              }}
              onContextMenu={e => {
                if (e.target.closest('[data-photo-id]')) return
                e.preventDefault()
                setGridContextMenu({ x: e.clientX, y: e.clientY })
              }}
              style={selectionMode ? { userSelect: 'none', position: 'relative' } : { position: 'relative' }}
            >
```
Replace it with (adds `onDragOver`/`onDragLeave`/`onDrop` guarded by `dataTransfer.types.includes('Files')` so internal photo/folder drag — which uses `setData('photoId'|'folderId')` and never populates the `'Files'` type — is unaffected; also merges the dashed-border visual feedback into `style`):
```jsx
              ref={gridRef}
              className={`${thumbSize === 'masonry' ? 'search-masonry-scroll' : 'search-grid-scroll'}${isDraggingPhotos ? ' dragging-active' : ''}`}
              onMouseDown={handleGridMouseDown}
              onMouseMove={handleGridMouseMove}
              onScroll={handleGridScroll}
              onClick={e => {
                if (wasDragging.current) return
                if (e.target.closest('[data-photo-id]')) return
                if (selectionMode) exitSelectionMode()
              }}
              onContextMenu={e => {
                if (e.target.closest('[data-photo-id]')) return
                e.preventDefault()
                setGridContextMenu({ x: e.clientX, y: e.clientY })
              }}
              onDragOver={e => {
                if (!e.dataTransfer.types.includes('Files')) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
                setIsDraggingFilesOver(true)
              }}
              onDragLeave={e => {
                if (!e.dataTransfer.types.includes('Files')) return
                if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingFilesOver(false)
              }}
              onDrop={e => {
                if (!e.dataTransfer.types.includes('Files')) return
                e.preventDefault()
                setIsDraggingFilesOver(false)
                enqueueUploads(e.dataTransfer.files)
              }}
              style={{
                ...(selectionMode ? { userSelect: 'none' } : {}),
                position: 'relative',
                ...(isDraggingFilesOver ? { outline: '2px dashed var(--primary)', outlineOffset: -8 } : {}),
              }}
            >
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, log in, open BetterSearch. Drag an image file from the OS file manager over the grid.
Expected: a dashed outline appears around the grid while dragging over it; dropping the file starts an upload (panel appears bottom-right, same as Task 3's button flow); dragging a PDF or other unsupported file and dropping it does nothing (no panel entry, no error). Then verify existing internal drag behavior is unaffected: drag an existing photo card onto a sidebar folder — it should still move the photo as before (unaffected by the new handlers, since they bail out when `dataTransfer.types` doesn't include `'Files'`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/SearchPage.jsx
git commit -m "Add OS drag-and-drop upload to BetterSearch grid"
```

---

### Task 5: End-to-end verification against the spec

**Files:** none (verification only).

- [ ] **Step 1: Full manual pass**

Run: `npm run dev`, log in, open BetterSearch, and walk through:
1. Click "Carica file", select 2-3 images/videos → panel shows all of them progressing, each disappears ~3s after completion, all appear in the grid.
2. Drag a single image from Finder onto the grid → same behavior as the button.
3. Drag a non-image/video file (e.g. a `.txt`) onto the grid → silently ignored, no panel entry.
4. Start uploading a larger video file, then use browser devtools' Network tab to throttle/go offline mid-upload, then restore connectivity.
   Expected: the panel shows the item stuck at some progress percentage while offline; once the network is restored, if the request errored out the item will show `error` status with a "Riprova" button — click it and confirm the upload completes (this exercises `queryUploadedOffset` + resumed `putFromOffset`, though from the UI it just looks like a successful retry).
5. Drag an existing photo card from the grid onto a sidebar folder to move it → confirm this still works unmodified (regression check for Task 4's guard against internal drags).

- [ ] **Step 2: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "Fix issues found during upload E2E verification"
```
(Skip this step if no fixes were needed.)
