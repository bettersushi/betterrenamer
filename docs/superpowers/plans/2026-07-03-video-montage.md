# Video Montage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Monta video" modal to SearchPage that lets the user pick video clips from the current folder, optionally trim/crop each clip, choose output quality, and produce a merged video file — all client-side via FFmpeg.wasm.

**Architecture:** FFmpeg.wasm runs in the browser (SharedArrayBuffer + COOP/COEP headers required). A `VideoMontageModal` orchestrates the three stages: clip selection → per-clip trim + crop → output quality + render. The existing `CropModal` canvas approach is replicated for video spatial crop by extracting a frame with `<video>` + `<canvas>`. FFmpeg is loaded lazily on first open and kept alive in a ref.

**Tech Stack:** `@ffmpeg/ffmpeg@0.12`, `@ffmpeg/util@0.12`, React 18, Vite 5, existing Google Drive API helpers.

## Global Constraints

- React 18 + Vite 5, no TypeScript
- No external storage — all processing in-browser, output downloaded locally
- Follow existing CSS-var theming (`--primary`, `--surface`, `--border`, `--text-primary`, etc.)
- COOP/COEP headers required for SharedArrayBuffer — must be set in `vite.config.js` (dev) and `vercel.json` (prod)
- Entry point: `SearchPage.jsx` — add "Monta video" button in `search-sub-toolbar`, visible only when `activeFolderId` is set and folder has ≥ 2 video files
- No new npm scripts; `npm run build` must pass after each task

---

### Task 1: Install FFmpeg.wasm + configure COOP/COEP headers

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js` (create if missing)
- Modify: `vercel.json`

**Interfaces:**
- Produces: `@ffmpeg/ffmpeg` and `@ffmpeg/util` importable in components

- [ ] **Step 1: Install packages**

```bash
npm install @ffmpeg/ffmpeg@0.12 @ffmpeg/util@0.12
```

Expected: packages added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Create/update `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
})
```

- [ ] **Step 3: Add COOP/COEP headers to `vercel.json`**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: `✓ built in` with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.js vercel.json
git commit -m "feat: install ffmpeg.wasm + COOP/COEP headers for SharedArrayBuffer"
```

---

### Task 2: `useFFmpeg` hook — lazy load + singleton

**Files:**
- Create: `src/hooks/useFFmpeg.js`

**Interfaces:**
- Produces: `useFFmpeg()` → `{ ffmpeg, loaded, load, progress }` where:
  - `ffmpeg`: FFmpeg instance (from `@ffmpeg/ffmpeg`)
  - `loaded`: boolean
  - `load()`: async, idempotent — loads WASM once, resolves immediately on repeat calls
  - `progress`: number 0–1 (from FFmpeg progress event)

- [ ] **Step 1: Create the hook**

```js
// src/hooks/useFFmpeg.js
import { useRef, useState, useCallback } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

export function useFFmpeg() {
  const ffmpegRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [progress, setProgress] = useState(0)
  const loadingRef = useRef(false)

  const load = useCallback(async () => {
    if (ffmpegRef.current && loaded) return
    if (loadingRef.current) return
    loadingRef.current = true

    const ff = new FFmpeg()
    ff.on('progress', ({ progress: p }) => setProgress(p))
    await ff.load({
      coreURL:   await toBlobURL(`${BASE}/ffmpeg-core.js`,   'text/javascript'),
      wasmURL:   await toBlobURL(`${BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${BASE}/ffmpeg-core.worker.js`, 'text/javascript'),
    })
    ffmpegRef.current = ff
    setLoaded(true)
    loadingRef.current = false
  }, [loaded])

  return { ffmpeg: ffmpegRef.current, loaded, load, progress }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFFmpeg.js
git commit -m "feat: useFFmpeg hook — lazy singleton loader for ffmpeg.wasm"
```

---

### Task 3: `VideoMontageModal` — scaffold + clip selection stage

**Files:**
- Create: `src/components/VideoMontageModal.jsx`
- Create: `src/components/VideoMontageModal.css`

**Interfaces:**
- Consumes:
  - `videos`: array of Drive file objects `{ id, name, thumbnailLink, size, mimeType }` — pre-filtered to video files from current folder
  - `auth`: `{ accessToken: string }`
  - `onClose()`: callback
- Produces: modal renders 3 stages internally; no output prop needed (file is downloaded directly)

The modal has 3 stages controlled by a local `stage` state: `'select'` → `'edit'` → `'render'`.

- [ ] **Step 1: Create `VideoMontageModal.css`**

```css
.vmm-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.82);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(6px);
}

.vmm-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.45);
  display: flex; flex-direction: column;
  width: min(94vw, 860px);
  max-height: 90vh;
  overflow: hidden;
}

.vmm-header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.vmm-title {
  flex: 1; font-weight: 700; font-size: 15px; color: var(--text-primary);
}

.vmm-steps {
  display: flex; gap: 0; flex-shrink: 0;
  padding: 0 18px;
  border-bottom: 1px solid var(--border);
}

.vmm-step {
  padding: 10px 14px; font-size: 12px; font-weight: 600;
  color: var(--text-muted); border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  cursor: default;
}

.vmm-step.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.vmm-step.done {
  color: var(--text-secondary);
}

.vmm-body {
  flex: 1; overflow-y: auto; padding: 18px;
}

.vmm-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

/* Clip selection grid */
.vmm-clip-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.vmm-clip-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.14s, transform 0.14s;
  aspect-ratio: 16/9;
  background: var(--surface-2, #111);
}

.vmm-clip-item:hover { transform: scale(1.03); }

.vmm-clip-item.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 30%, transparent);
}

.vmm-clip-item img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}

.vmm-clip-badge {
  position: absolute; top: 4px; right: 4px;
  background: rgba(0,0,0,0.6); border-radius: 5px;
  padding: 1px 5px; font-size: 9px; color: white; font-weight: 600;
}

.vmm-clip-check {
  position: absolute; top: 4px; left: 4px;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--primary); display: flex; align-items: center; justify-content: center;
  font-size: 10px; color: white;
  opacity: 0; transition: opacity 0.12s;
}

.vmm-clip-item.selected .vmm-clip-check { opacity: 1; }

.vmm-clip-name {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  padding: 8px 5px 4px; font-size: 9px; color: white;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Drag-to-reorder handle in edit stage */
.vmm-edit-list { display: flex; flex-direction: column; gap: 10px; }

.vmm-edit-item {
  display: flex; align-items: center; gap: 12px;
  background: var(--surface-2, var(--bg));
  border: 1px solid var(--border); border-radius: 10px;
  padding: 10px 12px;
  cursor: grab;
}

.vmm-edit-thumb {
  width: 80px; height: 48px; object-fit: cover; border-radius: 6px; flex-shrink: 0;
}

.vmm-edit-info { flex: 1; min-width: 0; }
.vmm-edit-name { font-size: 12px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vmm-edit-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.vmm-edit-actions { display: flex; gap: 6px; flex-shrink: 0; }

/* Progress bar */
.vmm-progress-bar {
  width: 100%; height: 6px; background: var(--border);
  border-radius: 999px; overflow: hidden; margin-top: 12px;
}

.vmm-progress-fill {
  height: 100%; background: var(--primary);
  transition: width 0.2s ease;
  border-radius: 999px;
}
```

- [ ] **Step 2: Create `VideoMontageModal.jsx` — stage `select` only (stages `edit` + `render` are stubs)**

```jsx
// src/components/VideoMontageModal.jsx
import { useState } from 'react'
import './VideoMontageModal.css'

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function IconFilm() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>
    </svg>
  )
}

const STAGES = ['Selezione', 'Modifica clip', 'Esporta']

export default function VideoMontageModal({ videos, auth, onClose }) {
  const [stage, setStage] = useState(0)          // 0=select, 1=edit, 2=render
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [clips, setClips] = useState([])         // ordered array of clip objects {file, trim, crop}

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function goToEdit() {
    const ordered = videos.filter(v => selectedIds.has(v.id))
    setClips(ordered.map(f => ({ file: f, trim: null, crop: null })))
    setStage(1)
  }

  return (
    <div className="vmm-overlay" onClick={e => { if (e.target.classList.contains('vmm-overlay')) onClose() }}>
      <div className="vmm-modal">
        {/* Header */}
        <div className="vmm-header">
          <IconFilm />
          <span className="vmm-title">Monta video</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {/* Step indicators */}
        <div className="vmm-steps">
          {STAGES.map((s, i) => (
            <div key={s} className={`vmm-step${i === stage ? ' active' : i < stage ? ' done' : ''}`}>{i + 1}. {s}</div>
          ))}
        </div>

        {/* Body */}
        <div className="vmm-body">
          {stage === 0 && (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                Seleziona i video da includere nel montaggio ({videos.length} disponibili)
              </p>
              <div className="vmm-clip-grid">
                {videos.map(v => (
                  <div
                    key={v.id}
                    className={`vmm-clip-item${selectedIds.has(v.id) ? ' selected' : ''}`}
                    onClick={() => toggleSelect(v.id)}
                    title={v.name}
                  >
                    {v.thumbnailLink
                      ? <img src={v.thumbnailLink.replace(/=s\d+$/, '=s220')} alt="" loading="lazy" />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 22 }}>▶</div>
                    }
                    <div className="vmm-clip-check">✓</div>
                    <div className="vmm-clip-badge">{formatSize(v.size ? parseInt(v.size) : 0)}</div>
                    <div className="vmm-clip-name">{v.name}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {stage === 1 && <EditStage clips={clips} setClips={setClips} auth={auth} />}
          {stage === 2 && <RenderStage clips={clips} onClose={onClose} />}
        </div>

        {/* Footer */}
        <div className="vmm-footer">
          {stage > 0 && (
            <button onClick={() => setStage(s => s - 1)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
              Indietro
            </button>
          )}
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            Annulla
          </button>
          {stage === 0 && (
            <button
              onClick={goToEdit}
              disabled={selectedIds.size < 1}
              style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', cursor: selectedIds.size < 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: 13, opacity: selectedIds.size < 1 ? 0.45 : 1 }}
            >
              Avanti ({selectedIds.size} clip)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Stubs — implemented in Tasks 4 and 5
function EditStage({ clips, setClips, auth }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Edit stage — Task 4</div>
}
function RenderStage({ clips, onClose }) {
  return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Render stage — Task 5</div>
}
```

- [ ] **Step 3: Wire button into SearchPage**

In `src/pages/SearchPage.jsx`, add import at top:
```js
import VideoMontageModal from '../components/VideoMontageModal'
```

Add state near other modal states (around line 399):
```js
const [showVideoMontage, setShowVideoMontage] = useState(false)
```

Compute video list derived from `allPhotos` (add after `allPhotos` state):
```js
const videoFiles = useMemo(() => allPhotos.filter(f => isVideoFile(f)), [allPhotos])
```

In the `search-sub-toolbar` JSX (after the subfolder section, around line 1264), add the button — visible only when ≥ 2 videos:
```jsx
{videoFiles.length >= 2 && (
  <button
    className="btn-secondary"
    onClick={() => setShowVideoMontage(true)}
    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 10px' }}
    title="Monta video"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><polygon points="10,8 16,12 10,16"/></svg>
    Monta video
  </button>
)}
```

At the bottom of the return JSX, before the closing tag, add:
```jsx
{showVideoMontage && (
  <VideoMontageModal
    videos={videoFiles}
    auth={auth}
    onClose={() => setShowVideoMontage(false)}
  />
)}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/VideoMontageModal.jsx src/components/VideoMontageModal.css src/pages/SearchPage.jsx
git commit -m "feat: VideoMontageModal scaffold — clip selection stage + entry point in SearchPage"
```

---

### Task 4: Edit stage — trim timeline + spatial crop per clip

**Files:**
- Modify: `src/components/VideoMontageModal.jsx` (replace `EditStage` stub)
- Create: `src/components/VideoTrimCrop.jsx`
- Create: `src/components/VideoTrimCrop.css`

**Interfaces:**
- Consumes:
  - `clip`: `{ file: DriveFile, trim: {start,end}|null, crop: {x,y,w,h,naturalW,naturalH}|null }`
  - `auth`: `{ accessToken: string }`
  - `onChange(updatedClip)`: callback
- Produces: updated `clip.trim` and `clip.crop` stored in parent `clips` state

**Drag-to-reorder:** EditStage renders clips as a sortable list. Drag is implemented with native HTML5 drag (dragstart/dragover/drop) — no external library.

- [ ] **Step 1: Create `VideoTrimCrop.css`**

```css
.vtc-wrap { display: flex; flex-direction: column; gap: 12px; }

/* Video preview */
.vtc-video-wrap {
  position: relative; border-radius: 10px; overflow: hidden;
  background: #000; line-height: 0;
}
.vtc-video { width: 100%; max-height: 320px; display: block; cursor: crosshair; }

/* Crop overlay (absolute over video element) */
.vtc-crop-overlay {
  position: absolute; inset: 0; pointer-events: none;
}
.vtc-crop-overlay.active { pointer-events: all; cursor: crosshair; }

.vtc-crop-rect {
  position: absolute;
  border: 2px solid white;
  box-shadow: 0 0 0 9999px rgba(0,0,0,0.48);
  box-sizing: border-box;
}

.vtc-crop-handle {
  position: absolute;
  width: 14px; height: 14px;
  background: white;
  border: 2px solid rgba(0,0,0,0.35);
  border-radius: 3px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.5);
}

/* Trim timeline */
.vtc-timeline-wrap {
  display: flex; flex-direction: column; gap: 6px;
}

.vtc-timeline {
  position: relative; height: 36px;
  background: var(--surface-2, var(--border));
  border-radius: 8px; overflow: hidden; cursor: pointer;
}

.vtc-timeline-fill {
  position: absolute; top: 0; bottom: 0;
  background: color-mix(in srgb, var(--primary) 35%, transparent);
  border: 2px solid var(--primary);
  border-radius: 8px;
  box-sizing: border-box;
}

.vtc-timeline-handle {
  position: absolute; top: 0; bottom: 0; width: 8px;
  background: var(--primary); border-radius: 4px;
  cursor: ew-resize; transform: translateX(-50%);
}

.vtc-timeline-labels {
  display: flex; justify-content: space-between;
  font-size: 10px; color: var(--text-muted);
}

.vtc-section-label {
  font-size: 11px; font-weight: 600; color: var(--text-secondary);
  margin-bottom: 4px;
}

.vtc-toggle-row {
  display: flex; gap: 8px;
}

.vtc-toggle-btn {
  padding: 5px 12px; border-radius: 7px; font-size: 11px; font-weight: 600;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); cursor: pointer; font-family: inherit;
  transition: all 0.12s;
}
.vtc-toggle-btn.active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
}
```

- [ ] **Step 2: Create `VideoTrimCrop.jsx`**

```jsx
// src/components/VideoTrimCrop.jsx
import { useRef, useState, useEffect, useCallback } from 'react'
import './VideoTrimCrop.css'

function fmt(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function VideoTrimCrop({ clip, auth, onChange }) {
  const { file, trim, crop } = clip
  const videoRef = useRef(null)
  const timelineRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(trim?.start ?? 0)
  const [end, setEnd] = useState(trim?.end ?? null)  // null = use full length
  const [cropMode, setCropMode] = useState(!!crop)
  const [cropRect, setCropRect] = useState(crop || null)  // {x,y,w,h} in CSS px over video element
  const dragRef = useRef(null)

  // Drive video URL (authenticated)
  const videoSrc = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onMeta = () => {
      setDuration(v.duration)
      setEnd(e => e ?? v.duration)
    }
    v.addEventListener('loadedmetadata', onMeta)
    return () => v.removeEventListener('loadedmetadata', onMeta)
  }, [])

  // Sync changes up to parent
  useEffect(() => {
    onChange({
      ...clip,
      trim: duration > 0 ? { start, end: end ?? duration } : null,
      crop: cropMode && cropRect ? { ...cropRect } : null,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, cropMode, cropRect])

  // Timeline drag
  const startTimelineDrag = useCallback((handle, e) => {
    e.preventDefault()
    dragRef.current = { handle, startX: e.clientX, startStart: start, startEnd: end ?? duration }
    const onMove = (ev) => {
      const tl = timelineRef.current
      if (!tl || !dragRef.current) return
      const { handle, startX, startStart, startEnd } = dragRef.current
      const dx = ev.clientX - startX
      const pct = dx / tl.getBoundingClientRect().width
      const dt = pct * duration
      if (handle === 'start') {
        setStart(Math.max(0, Math.min(startStart + dt, (end ?? duration) - 0.5)))
        videoRef.current.currentTime = Math.max(0, startStart + dt)
      } else {
        setEnd(Math.max(start + 0.5, Math.min(startEnd + dt, duration)))
        videoRef.current.currentTime = Math.max(start + 0.5, startEnd + dt)
      }
    }
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [start, end, duration])

  // Crop overlay drag (simple new-rect draw on video element)
  const cropDragRef = useRef(null)

  const onVideoCropMouseDown = useCallback((e) => {
    if (!cropMode) return
    e.preventDefault()
    const v = videoRef.current
    const b = v.getBoundingClientRect()
    const sx = e.clientX - b.left, sy = e.clientY - b.top
    cropDragRef.current = { sx, sy }
    const onMove = (ev) => {
      if (!cropDragRef.current) return
      const ex = ev.clientX - b.left, ey = ev.clientY - b.top
      setCropRect({
        x: Math.min(sx, ex), y: Math.min(sy, ey),
        w: Math.abs(ex - sx), h: Math.abs(ey - sy),
        vw: b.width, vh: b.height,
      })
    }
    const onUp = () => { cropDragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [cropMode])

  const startPct = duration > 0 ? (start / duration) * 100 : 0
  const endPct   = duration > 0 ? ((end ?? duration) / duration) * 100 : 100

  return (
    <div className="vtc-wrap">
      {/* Video preview */}
      <div className="vtc-video-wrap">
        <video
          ref={videoRef}
          src={videoSrc}
          className="vtc-video"
          controls
          crossOrigin="use-credentials"
          onMouseDown={onVideoCropMouseDown}
          style={{ pointerEvents: cropMode ? 'none' : 'auto' }}
        />
        {/* Crop mode: draw overlay on top */}
        {cropMode && (
          <div
            className={`vtc-crop-overlay${cropMode ? ' active' : ''}`}
            onMouseDown={onVideoCropMouseDown}
          >
            {cropRect && cropRect.w > 4 && cropRect.h > 4 && (
              <div className="vtc-crop-rect" style={{
                left: cropRect.x, top: cropRect.y,
                width: cropRect.w, height: cropRect.h,
              }}>
                {/* Corner handles (visual only — resize handled by re-draw) */}
                {[
                  { id:'tl', style:{top:-5,left:-5,cursor:'nwse-resize'} },
                  { id:'tr', style:{top:-5,right:-5,cursor:'nesw-resize'} },
                  { id:'bl', style:{bottom:-5,left:-5,cursor:'nesw-resize'} },
                  { id:'br', style:{bottom:-5,right:-5,cursor:'nwse-resize'} },
                ].map(h => <div key={h.id} className="vtc-crop-handle" style={h.style} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trim section */}
      <div className="vtc-timeline-wrap">
        <div className="vtc-section-label">Taglia clip</div>
        <div className="vtc-timeline" ref={timelineRef}>
          <div className="vtc-timeline-fill" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
          <div className="vtc-timeline-handle" style={{ left: `${startPct}%` }} onMouseDown={e => startTimelineDrag('start', e)} />
          <div className="vtc-timeline-handle" style={{ left: `${endPct}%` }} onMouseDown={e => startTimelineDrag('end', e)} />
        </div>
        <div className="vtc-timeline-labels">
          <span>▶ {fmt(start)}</span>
          <span>{fmt(end ?? duration)} ■</span>
        </div>
      </div>

      {/* Crop toggle */}
      <div>
        <div className="vtc-section-label">Crop spaziale</div>
        <div className="vtc-toggle-row">
          <button className={`vtc-toggle-btn${!cropMode ? ' active' : ''}`} onClick={() => { setCropMode(false); setCropRect(null) }}>Nessun crop</button>
          <button className={`vtc-toggle-btn${cropMode ? ' active' : ''}`} onClick={() => setCropMode(true)}>Disegna area</button>
        </div>
        {cropMode && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Trascina sull'anteprima per definire l'area da tagliare</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace `EditStage` stub in `VideoMontageModal.jsx`**

Replace the stub `EditStage` function at the bottom of `VideoMontageModal.jsx` with:

```jsx
function EditStage({ clips, setClips, auth, onNext }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const dragIdx = useRef(null)

  function updateClip(idx, updated) {
    setClips(prev => prev.map((c, i) => i === idx ? updated : c))
  }

  // Drag-to-reorder
  function onDragStart(i) { dragIdx.current = i }
  function onDragOver(e, i) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === i) return
    setClips(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx.current, 1)
      next.splice(i, 0, moved)
      dragIdx.current = i
      return next
    })
  }
  function onDragEnd() { dragIdx.current = null }

  return (
    <div style={{ display: 'flex', gap: 18 }}>
      {/* Left: ordered list */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>ORDINE CLIP</div>
        <div className="vmm-edit-list">
          {clips.map((c, i) => (
            <div
              key={c.file.id}
              className={`vmm-edit-item${i === activeIdx ? ' selected' : ''}`}
              style={{ borderColor: i === activeIdx ? 'var(--primary)' : 'var(--border)', opacity: 1 }}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={e => onDragOver(e, i)}
              onDragEnd={onDragEnd}
              onClick={() => setActiveIdx(i)}
            >
              {c.file.thumbnailLink
                ? <img className="vmm-edit-thumb" src={c.file.thumbnailLink.replace(/=s\d+$/, '=s160')} alt="" />
                : <div className="vmm-edit-thumb" style={{ background: 'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:18 }}>▶</div>
              }
              <div className="vmm-edit-info">
                <div className="vmm-edit-name">{i + 1}. {c.file.name}</div>
                <div className="vmm-edit-meta">
                  {c.trim ? `✂ ${c.trim.start.toFixed(1)}s–${c.trim.end.toFixed(1)}s` : 'Clip intera'}
                  {c.crop ? ' · Crop ✓' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: trim+crop editor for active clip */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
          MODIFICA: {clips[activeIdx]?.file.name}
        </div>
        {clips[activeIdx] && (
          <VideoTrimCrop
            clip={clips[activeIdx]}
            auth={auth}
            onChange={updated => updateClip(activeIdx, updated)}
          />
        )}
      </div>
    </div>
  )
}
```

Add the import at the top of `VideoMontageModal.jsx`:
```js
import { useRef } from 'react'
import VideoTrimCrop from './VideoTrimCrop'
```

In the footer JSX, add the "Avanti" button for stage 1:
```jsx
{stage === 1 && (
  <button
    onClick={() => setStage(2)}
    style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
  >
    Esporta →
  </button>
)}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/VideoTrimCrop.jsx src/components/VideoTrimCrop.css src/components/VideoMontageModal.jsx
git commit -m "feat: VideoMontage edit stage — trim timeline + spatial crop per clip, drag-to-reorder"
```

---

### Task 5: Render stage — FFmpeg processing + quality picker + download

**Files:**
- Modify: `src/components/VideoMontageModal.jsx` (replace `RenderStage` stub)

**Interfaces:**
- Consumes:
  - `clips`: `Array<{ file: DriveFile, trim: {start,end}|null, crop: {x,y,w,h,vw,vh}|null }>`
  - `auth`: `{ accessToken: string }`
  - `onClose()`: callback
- Produces: MP4 file downloaded via `URL.createObjectURL`

**Quality presets:**

| Label  | Scale filter        | CRF |
|--------|---------------------|-----|
| 480p   | `scale=-2:480`      | 28  |
| 720p   | `scale=-2:720`      | 26  |
| 1080p  | `scale=-2:1080`     | 24  |

Quality suggestion logic: sum of `file.size` (bytes) across selected clips.
- < 100 MB total → suggest 1080p
- 100–400 MB → suggest 720p  
- > 400 MB → suggest 480p

**FFmpeg command per clip:**
```
ffmpeg -ss {start} -to {end} -i input.mp4 \
  -vf "crop={cw}:{ch}:{cx}:{cy},scale=-2:{height}" \
  -c:v libx264 -crf {crf} -preset fast -c:a aac \
  clip_{i}.mp4
```
Then concat with a concat demuxer text file.

- [ ] **Step 1: Replace `RenderStage` stub in `VideoMontageModal.jsx`**

Add to imports at top of `VideoMontageModal.jsx`:
```js
import { useFFmpeg } from '../hooks/useFFmpeg'
import { fetchFile } from '@ffmpeg/util'
```

Replace the stub `RenderStage` function:

```jsx
function RenderStage({ clips, auth, onClose }) {
  const { ffmpeg, loaded, load, progress } = useFFmpeg()
  const [quality, setQuality] = useState(() => {
    const totalMB = clips.reduce((s, c) => s + (parseInt(c.file.size) || 0), 0) / (1024 * 1024)
    if (totalMB < 100) return '1080p'
    if (totalMB < 400) return '720p'
    return '480p'
  })
  const [status, setStatus] = useState('idle')  // idle | loading | processing | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [outputUrl, setOutputUrl] = useState(null)
  const [currentClip, setCurrentClip] = useState(0)

  const QUALITY = {
    '480p':  { scale: 'scale=-2:480',  crf: 28 },
    '720p':  { scale: 'scale=-2:720',  crf: 26 },
    '1080p': { scale: 'scale=-2:1080', crf: 24 },
  }

  async function handleRender() {
    setStatus('loading')
    setErrorMsg('')
    try {
      if (!loaded) await load()
      setStatus('processing')
      const { scale, crf } = QUALITY[quality]
      const concatLines = []

      for (let i = 0; i < clips.length; i++) {
        setCurrentClip(i + 1)
        const { file, trim, crop } = clips[i]
        // Download from Drive
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
          { headers: { Authorization: `Bearer ${auth.accessToken}` } }
        )
        if (!res.ok) throw new Error(`Download fallito: ${file.name}`)
        const blob = await res.blob()
        const inName = `in_${i}.mp4`
        await ffmpeg.writeFile(inName, await fetchFile(blob))

        // Build vf filter
        let vf = ''
        if (crop && crop.w > 4 && crop.h > 4) {
          // Convert CSS px crop to video pixel coords
          const scaleX = file.videoMediaMetadata?.width  ? file.videoMediaMetadata.width  / crop.vw : 1
          const scaleY = file.videoMediaMetadata?.height ? file.videoMediaMetadata.height / crop.vh : 1
          const cx = Math.round(crop.x * scaleX)
          const cy = Math.round(crop.y * scaleY)
          const cw = Math.round(crop.w * scaleX)
          const ch = Math.round(crop.h * scaleY)
          vf = `crop=${cw}:${ch}:${cx}:${cy},${scale}`
        } else {
          vf = scale
        }

        const args = ['-y']
        if (trim) { args.push('-ss', String(trim.start), '-to', String(trim.end)) }
        args.push('-i', inName)
        args.push('-vf', vf, '-c:v', 'libx264', '-crf', String(crf), '-preset', 'fast', '-c:a', 'aac')
        const outName = `clip_${i}.mp4`
        args.push(outName)
        await ffmpeg.exec(args)
        await ffmpeg.deleteFile(inName)
        concatLines.push(`file '${outName}'`)
      }

      // Write concat list
      const concatTxt = concatLines.join('\n')
      await ffmpeg.writeFile('concat.txt', concatTxt)
      await ffmpeg.exec(['-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'output.mp4'])

      const data = await ffmpeg.readFile('output.mp4')
      const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }))
      setOutputUrl(url)
      setStatus('done')

      // Cleanup
      for (let i = 0; i < clips.length; i++) { try { await ffmpeg.deleteFile(`clip_${i}.mp4`) } catch {} }
      try { await ffmpeg.deleteFile('concat.txt') } catch {}
    } catch (e) {
      console.error(e)
      setErrorMsg(e.message || 'Errore durante l\'elaborazione')
      setStatus('error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Quality picker */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>QUALITÀ OUTPUT</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['480p', '720p', '1080p'].map(q => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              disabled={status === 'processing'}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: `1px solid ${quality === q ? 'var(--primary)' : 'var(--border)'}`,
                background: quality === q ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                color: quality === q ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: status === 'processing' ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {q}
              {quality === q && <span style={{ display: 'block', fontSize: 9, fontWeight: 400, color: 'var(--text-muted)' }}>Consigliato</span>}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          {clips.length} clip · {(clips.reduce((s,c) => s + (parseInt(c.file.size)||0), 0) / (1024*1024)).toFixed(0)} MB totali
        </p>
      </div>

      {/* Clip summary */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>RIEPILOGO</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {clips.map((c, i) => (
            <div key={c.file.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--surface-2, var(--bg))', borderRadius: 7, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-muted)', width: 16, textAlign: 'right' }}>{i+1}.</span>
              <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.file.name}</span>
              {c.trim && <span>✂ {c.trim.start.toFixed(1)}s–{c.trim.end.toFixed(1)}s</span>}
              {c.crop && <span>crop ✓</span>}
              {status === 'processing' && currentClip === i + 1 && <span style={{ color: 'var(--primary)' }}>elaborazione…</span>}
              {status === 'processing' && currentClip > i + 1 && <span style={{ color: 'var(--success, green)' }}>✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Progress */}
      {(status === 'loading' || status === 'processing') && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {status === 'loading' ? 'Caricamento FFmpeg…' : `Elaborazione clip ${currentClip}/${clips.length}…`}
          </div>
          <div className="vmm-progress-bar">
            <div className="vmm-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div style={{ padding: '10px 14px', background: 'color-mix(in srgb, #ef4444 10%, transparent)', border: '1px solid #ef4444', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
          {errorMsg}
        </div>
      )}

      {/* Done */}
      {status === 'done' && outputUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>✓ Montaggio completato</div>
          <a
            href={outputUrl}
            download="montaggio.mp4"
            style={{ padding: '9px 24px', borderRadius: 9, background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            ⬇ Scarica MP4
          </a>
        </div>
      )}

      {/* Action button */}
      {status === 'idle' || status === 'error' ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleRender}
            style={{ padding: '9px 24px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}
          >
            🎬 Genera montaggio
          </button>
        </div>
      ) : null}
    </div>
  )
}
```

Also add `useState` to the existing import at the top (it's already imported but verify `useRef` is also imported — used in EditStage).

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoMontageModal.jsx src/hooks/useFFmpeg.js
git commit -m "feat: VideoMontage render stage — FFmpeg quality picker + download"
```

---

### Task 6: Polish + tag release

**Files:**
- Modify: `src/components/VideoMontageModal.css` (minor tweaks)
- Git tag

- [ ] **Step 1: Add selected-clip style to EditStage list item**

In `VideoMontageModal.css` add:

```css
.vmm-edit-item.selected {
  border-color: var(--primary) !important;
  background: color-mix(in srgb, var(--primary) 6%, var(--surface-2, var(--bg)));
}
```

- [ ] **Step 2: Final build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit + tag**

```bash
git add -A
git commit -m "feat: video montage complete — clip selection, trim/crop, FFmpeg render"
git tag -a v0.8.0 -m "Release v0.8.0 — video montage FFmpeg.wasm"
git push && git push origin v0.8.0
```

---

## Self-Review Checklist

- [x] COOP/COEP headers: covered Task 1 (vite.config.js + vercel.json)
- [x] FFmpeg singleton: `useFFmpeg` hook with `loadingRef` guard
- [x] Clip selection grid 6 colonne: `grid-template-columns: repeat(6, 1fr)` in `.vmm-clip-grid`
- [x] Trim per clip: `VideoTrimCrop` timeline with handle drag
- [x] Crop per clip: canvas-style overlay on `<video>` element
- [x] Quality suggestion: auto-computed from total file size in `RenderStage` initial state
- [x] Progress bar: `vmm-progress-bar` + FFmpeg `progress` event via `useFFmpeg`
- [x] Download: `URL.createObjectURL` + `<a download>`
- [x] Entry point button: visible only when `videoFiles.length >= 2` in SearchPage
- [x] Drag-to-reorder: native HTML5 drag in `EditStage`
- [x] Theming: all colors via CSS vars
