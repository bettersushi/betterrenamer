# Four Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four independent features: Status modal, parent/grandparent rename placeholders, media-type filter toggle in grid, and drag-to-sidebar-nav file moving.

**Architecture:** Four independent tasks, each self-contained with no cross-task dependencies. Each touches existing files minimally and follows existing patterns (CSS vars, React hooks, Drive API helpers).

**Tech Stack:** React 18, Vite 5, existing Drive API helpers in `src/drive.js`, CSS custom properties.

## Global Constraints

- React 18, no TypeScript
- All colors via CSS vars (--primary, --surface, --border, --text-primary, --text-secondary, --text-muted)
- Follow existing component patterns (inline styles for one-off layout, CSS classes for reusable UI)
- `npm run build` must pass after each task
- No git push per task — push only at the end or when explicitly noted
- App has ~8023 lines of source code across all files

---

### Task 1: Status modal in header (DashboardPage + SearchPage)

**Files:**
- Create: `src/components/StatusModal.jsx`
- Modify: `src/pages/DashboardPage.jsx` (import + header button + state)
- Modify: `src/pages/SearchPage.jsx` (import + header button + state)

**What it shows:**

**Section 1 — App Info**
- Name: Better Renamer / Better Search
- Version: read from `import.meta.env.VITE_APP_VERSION` (fallback `'1.0.0'`)
- Lines of code: hardcoded `8023` (static, update manually on releases)
- Stack: React 18 + Vite 5, Google Drive API v3, FFmpeg.wasm 0.12
- Description: "App per rinominare, organizzare e montare contenuti multimediali da Google Drive"

**Section 2 — Drive API Status** (live check on modal open)
- Call `GET https://www.googleapis.com/drive/v3/about?fields=user,storageQuota` with the user's accessToken
- Show: email utente, storage usato / totale (convert bytes → GB with 1 decimal)
- Token status: if the call succeeds → "✓ Token valido"; if 401 → "✕ Token scaduto"
- Storage bar: visual progress bar (used/limit), colored danger red if > 90%

**Section 3 — FFmpeg**
- Static info: "FFmpeg.wasm 0.12 — single-thread, client-side"
- Core files: "Serviti da /public/ffmpeg/ (31 MB WASM)"
- No live check needed

**Section 4 — Sicurezza**
- "OAuth 2.0 — token salvato in localStorage, mai inviato a server terzi"
- "Elaborazione video: 100% client-side, nessun upload a servizi esterni"
- "Accesso Drive: solo lettura/scrittura file autorizzati dall'utente"
- "Credenziali: mai esposte nel bundle frontend"

**Section 5 — Ecosystem**
- Table of services: Google Drive API v3 | google.com/drive | ✓ Connesso
- FFmpeg.wasm | ffmpeg.wasm | ✓ Bundle locale
- Vercel | vercel.com | ✓ Hosting + API routes
- Google OAuth 2.0 | accounts.google.com | ✓ Auth provider

**Modal structure — identical to BatchOpsModal:**
```
position: fixed, inset: 0, z-index: 2000, backdrop blur
modal: bg var(--surface), border var(--border), border-radius 16px, max-width 560px, max-height 88vh, overflow-y auto
header: padding 14px 18px, border-bottom, title + close button
body: padding 18px, sections with 16px gap between them
section header: font-size 11px, font-weight 700, color var(--text-muted), letter-spacing 0.06em, UPPERCASE, margin-bottom 10px
```

**Entry point — both DashboardPage and SearchPage headers:**
Button in `header-actions` div (same pattern as other header buttons):
```jsx
<button onClick={() => setShowStatus(true)} className="btn-secondary"
  style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, padding:0 }}
  title="Stato app">
  <IconStatus />  {/* circle with i inside, 16px SVG */}
</button>
```
Position: first button in `header-actions` (leftmost, before palette picker).

**Interfaces:**
- Props: `{ auth, onClose }` — auth needed for Drive API call
- No external state needed beyond `showStatus` boolean in parent

- [ ] **Step 1: Create `src/components/StatusModal.jsx`**

```jsx
import { useState, useEffect } from 'react'

const IconStatus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

function Row({ label, value, mono }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)', gap:12 }}>
      <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily: mono ? 'monospace' : 'inherit', textAlign:'right' }}>{value}</span>
    </div>
  )
}

function SectionTitle({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10, marginTop:4 }}>{children}</div>
}

function StatusDot({ ok }) {
  return <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background: ok ? '#22c55e' : '#ef4444', marginRight:5 }} />
}

export default function StatusModal({ auth, onClose }) {
  const [driveInfo, setDriveInfo] = useState(null)
  const [driveError, setDriveError] = useState(null)
  const [driveLoading, setDriveLoading] = useState(true)

  useEffect(() => {
    if (!auth?.accessToken) { setDriveLoading(false); setDriveError('Nessun token'); return }
    fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
      headers: { Authorization: `Bearer ${auth.accessToken}` }
    })
      .then(r => { if (!r.ok) throw new Error(r.status === 401 ? 'Token scaduto (401)' : `Errore ${r.status}`); return r.json() })
      .then(data => { setDriveInfo(data); setDriveLoading(false) })
      .catch(e => { setDriveError(e.message); setDriveLoading(false) })
  }, [auth?.accessToken])

  function fmtBytes(b) {
    if (!b) return '—'
    const gb = parseInt(b) / (1024 ** 3)
    return gb < 1 ? `${(gb * 1024).toFixed(0)} MB` : `${gb.toFixed(1)} GB`
  }

  const used = driveInfo?.storageQuota?.usage ? parseInt(driveInfo.storageQuota.usage) : 0
  const limit = driveInfo?.storageQuota?.limit ? parseInt(driveInfo.storageQuota.limit) : 0
  const usedPct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const storageWarning = usedPct > 90

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', width:'min(92vw,560px)', maxHeight:'88vh', overflowY:'auto', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <IconStatus />
          <span style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)', flex:1 }}>Stato app</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:20, lineHeight:1, padding:0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding:'18px', display:'flex', flexDirection:'column', gap:20 }}>

          {/* App Info */}
          <div>
            <SectionTitle>Applicazione</SectionTitle>
            <Row label="Nome" value="Better Renamer + Better Search" />
            <Row label="Versione" value={import.meta.env.VITE_APP_VERSION || '1.0.0'} mono />
            <Row label="Linee di codice" value="~8.000 righe" />
            <Row label="Stack" value="React 18 · Vite 5 · Google Drive API v3" />
            <Row label="Video processing" value="FFmpeg.wasm 0.12 (single-thread)" />
          </div>

          {/* Drive Status */}
          <div>
            <SectionTitle>Google Drive API</SectionTitle>
            {driveLoading ? (
              <div style={{ fontSize:12, color:'var(--text-muted)', padding:'8px 0' }}>Verifica connessione…</div>
            ) : driveError ? (
              <div style={{ fontSize:12, color:'#ef4444', padding:'8px 0' }}><StatusDot ok={false} />{driveError}</div>
            ) : (
              <>
                <Row label="Stato token" value={<><StatusDot ok={true} />Token valido</>} />
                <Row label="Account" value={driveInfo?.user?.emailAddress || '—'} mono />
                <Row label="Storage usato" value={`${fmtBytes(used)} / ${fmtBytes(limit)}`} />
                {limit > 0 && (
                  <div style={{ marginTop:6 }}>
                    <div style={{ height:5, background:'var(--border)', borderRadius:999, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${usedPct}%`, background: storageWarning ? '#ef4444' : 'var(--primary)', borderRadius:999, transition:'width 0.4s' }} />
                    </div>
                    {storageWarning && <div style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>⚠ Storage quasi esaurito ({usedPct.toFixed(0)}%)</div>}
                  </div>
                )}
              </>
            )}
          </div>

          {/* FFmpeg */}
          <div>
            <SectionTitle>FFmpeg.wasm</SectionTitle>
            <Row label="Versione" value="0.12.15 (core 0.12.6)" mono />
            <Row label="Modalità" value="Single-thread (no SharedArrayBuffer worker)" />
            <Row label="Core files" value="/public/ffmpeg/ — 31 MB WASM" mono />
            <Row label="Caricamento" value="Lazy — solo al primo montaggio video" />
          </div>

          {/* Sicurezza */}
          <div>
            <SectionTitle>Sicurezza</SectionTitle>
            <Row label="Autenticazione" value="OAuth 2.0 — Google" />
            <Row label="Token storage" value="localStorage (solo browser locale)" />
            <Row label="Elaborazione video" value="100% client-side, nessun upload" />
            <Row label="Accesso Drive" value="Scoped — solo file autorizzati" />
            <Row label="API Secret" value="Solo su Vercel server-side (mai nel bundle)" />
          </div>

          {/* Ecosystem */}
          <div>
            <SectionTitle>Servizi</SectionTitle>
            {[
              { name:'Google Drive API v3', url:'drive.google.com', status:true, note:'File storage + metadata' },
              { name:'Google OAuth 2.0', url:'accounts.google.com', status:true, note:'Autenticazione' },
              { name:'FFmpeg.wasm', url:'ffmpegwasm.netlify.app', status:true, note:'Video processing locale' },
              { name:'Vercel', url:'vercel.com', status:true, note:'Hosting + API routes proxy' },
            ].map(s => (
              <div key={s.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)', gap:8 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.note}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
                  <StatusDot ok={s.status} />{s.url}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add button + state to DashboardPage**

In `src/pages/DashboardPage.jsx`:

Add import at top:
```js
import StatusModal from '../components/StatusModal'
```

Add state near other modal states (find `const [showBatchOps`):
```js
const [showStatus, setShowStatus] = useState(false)
```

In `header-actions` div, add as first button (before PalettePicker):
```jsx
<button onClick={() => setShowStatus(true)} className="btn-secondary"
  style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, padding:0 }}
  title="Stato app">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
</button>
```

At the bottom of the JSX (near other modals):
```jsx
{showStatus && <StatusModal auth={auth} onClose={() => setShowStatus(false)} />}
```

- [ ] **Step 3: Add button + state to SearchPage**

Same pattern as Step 2 in `src/pages/SearchPage.jsx`. The `header-actions` div is around line 1140. Add button as first in the div, and modal at bottom of JSX.

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusModal.jsx src/pages/DashboardPage.jsx src/pages/SearchPage.jsx
git commit -m "feat: status modal con info app, Drive API live check, sicurezza, ecosistema"
```

---

### Task 2: Parent + grandparent folder placeholders in rename

**Files:**
- Modify: `src/pages/DashboardPage.jsx`

**Context:**
- `folderPath` state is `[{ id, name }, ...]` — index 0 is root, last is current folder
- `folderPath[folderPath.length - 2]` = parent folder
- `folderPath[folderPath.length - 3]` = grandparent folder
- `resolvePlaceholders` receives `{ folderName, file, num, ext, extName }` — add `parentName` and `nonnoName`
- `PLACEHOLDERS` array drives the UI chips shown in the pattern input

**What to add:**

In `PLACEHOLDERS` array, add after `{cartella}`:
```js
{ token: '{parent}',  label: 'Parent',  desc: 'Nome della cartella superiore' },
{ token: '{nonno}',   label: 'Nonno',   desc: 'Nome della cartella due livelli sopra' },
```

In `resolvePlaceholders`, add two new params and replacements:
```js
function resolvePlaceholders(template, { folderName, parentName, nonnoName, file, num, ext, extName }) {
  // ... existing code ...
  return template
    .replace(/{cartella}/g, folderName)
    .replace(/{parent}/g, parentName || folderName)   // fallback to current if no parent
    .replace(/{nonno}/g, nonnoName || parentName || folderName)  // fallback chain
    // ... rest of existing replacements ...
}
```

At the call site (search for `resolvePlaceholders(template,`), pass the new values:
```js
const currentFolder = folderPath[folderPath.length - 1]
const parentFolder  = folderPath[folderPath.length - 2]
const nonnoFolder   = folderPath[folderPath.length - 3]
const resolved = resolvePlaceholders(template, {
  folderName: group.folderName,
  parentName: parentFolder?.name || '',
  nonnoName:  nonnoFolder?.name  || '',
  file, num, ext, extName
})
```

- [ ] **Step 1: Update `PLACEHOLDERS` array**

Find the `PLACEHOLDERS` constant in `DashboardPage.jsx` and add the two new entries after `{cartella}`:

```js
const PLACEHOLDERS = [
  { token: '{cartella}', label: 'Cartella', desc: 'Nome della cartella corrente' },
  { token: '{parent}',   label: 'Parent',   desc: 'Nome della cartella superiore' },
  { token: '{nonno}',    label: 'Nonno',    desc: 'Nome della cartella due livelli sopra' },
  // ... rest unchanged ...
]
```

- [ ] **Step 2: Update `resolvePlaceholders` signature and body**

Add `parentName = ''` and `nonnoName = ''` params, add two `.replace()` calls after the existing `{cartella}` replace:

```js
function resolvePlaceholders(template, { folderName, parentName = '', nonnoName = '', file, num, ext, extName }) {
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
```

- [ ] **Step 3: Pass `parentName` and `nonnoName` at the call site**

Find every call to `resolvePlaceholders(template,` in `DashboardPage.jsx`. For each, add the new params by reading from `folderPath`:

```js
const parentFolder = folderPath[folderPath.length - 2]
const nonnoFolder  = folderPath[folderPath.length - 3]
// then pass to resolvePlaceholders:
resolvePlaceholders(template, {
  folderName: group.folderName,
  parentName: parentFolder?.name || '',
  nonnoName:  nonnoFolder?.name  || '',
  file, num, ext, extName
})
```

Note: `group.folderName` is already used for `folderName`. The parent/nonno come from `folderPath` which is in scope at the call site.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.jsx
git commit -m "feat: placeholder {parent} e {nonno} nel pattern rename"
```

---

### Task 3: Media-type filter toggle in SearchPage grid toolbar

**Files:**
- Modify: `src/pages/SearchPage.jsx`
- Modify: `src/pages/SearchPage.css`

**What it does:** 4 toggle buttons in `search-sub-toolbar`: **Tutti** · **Foto** · **Video** · **GIF**. Filters `allPhotos` before display. Session-only (no localStorage).

**Implementation:**

Add state:
```js
const [mediaFilter, setMediaFilter] = useState('all') // 'all' | 'photo' | 'video' | 'gif'
```

Add derived `displayPhotos` (replace the current source used for rendering the grid — find where `allPhotos` is mapped to thumbnails):
```js
const displayPhotos = useMemo(() => {
  if (mediaFilter === 'all') return allPhotos
  if (mediaFilter === 'video') return allPhotos.filter(f => isVideoFile(f))
  if (mediaFilter === 'gif') return allPhotos.filter(f => getExt(f.name) === '.gif')
  // photo = media but not video and not gif
  return allPhotos.filter(f => !isVideoFile(f) && getExt(f.name) !== '.gif')
}, [allPhotos, mediaFilter])
```

Then use `displayPhotos` instead of `allPhotos` in the grid render (the `allPhotos.map(...)` or `allResults` that produces thumbnail cards).

**Counts** (for button labels):
```js
const mediaCounts = useMemo(() => ({
  all:   allPhotos.length,
  video: allPhotos.filter(f => isVideoFile(f)).length,
  gif:   allPhotos.filter(f => getExt(f.name) === '.gif').length,
  photo: allPhotos.filter(f => !isVideoFile(f) && getExt(f.name) !== '.gif').length,
}), [allPhotos])
```

**Buttons** — add in `search-sub-toolbar` after the subfolder section, before the "Monta video" button:
```jsx
<div className="media-filter-btns">
  {[
    { key:'all',   label:'Tutti' },
    { key:'photo', label:'Foto' },
    { key:'video', label:'Video' },
    { key:'gif',   label:'GIF' },
  ].map(({ key, label }) => (
    <button
      key={key}
      className={`media-filter-btn${mediaFilter === key ? ' active' : ''}`}
      onClick={() => setMediaFilter(key)}
    >
      {label}
      {mediaCounts[key] > 0 && <span className="media-filter-count">{mediaCounts[key]}</span>}
    </button>
  ))}
</div>
```

**CSS** to add in `SearchPage.css`:
```css
.media-filter-btns {
  display: flex; gap: 4px; align-items: center;
}

.media-filter-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); cursor: pointer; font-family: inherit;
  transition: all 0.12s;
}

.media-filter-btn:hover { background: var(--btn-hover, var(--surface-2)); }

.media-filter-btn.active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 11%, transparent);
  color: var(--primary); font-weight: 600;
}

.media-filter-count {
  background: var(--border); border-radius: 999px;
  padding: 1px 5px; font-size: 10px; font-weight: 700;
  color: var(--text-muted);
}

.media-filter-btn.active .media-filter-count {
  background: color-mix(in srgb, var(--primary) 20%, transparent);
  color: var(--primary);
}
```

**Important:** `displayPhotos` replaces `allPhotos` only in the grid render section. The `allPhotos` state keeps all files — filtering is display-only. Also reset `mediaFilter` to `'all'` when the folder changes (add to `selectFolder` or `loadFolder` call).

- [ ] **Step 1: Add `mediaFilter` state and `displayPhotos` + `mediaCounts` memos**

In `SearchPage.jsx`, find the existing state declarations area and add:
```js
const [mediaFilter, setMediaFilter] = useState('all')
```

Add the two `useMemo` blocks after existing memos.

Reset filter on folder change — find `selectFolder` or where `setAllPhotos` is called after loading a new folder, and add `setMediaFilter('all')`.

- [ ] **Step 2: Replace `allPhotos` with `displayPhotos` in the grid render**

In the JSX, find where individual photo thumbnail cards are mapped. The source array used there should be changed from `allPhotos` to `displayPhotos`. Be careful not to change `allPhotos` in other places (selection logic, counters in toolbar, etc.).

- [ ] **Step 3: Add filter buttons to `search-sub-toolbar`**

Add the `.media-filter-btns` div in the toolbar JSX.

- [ ] **Step 4: Add CSS**

Add the CSS block to `SearchPage.css`.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/SearchPage.jsx src/pages/SearchPage.css
git commit -m "feat: filtro tipo media nella toolbar (tutti/foto/video/gif) con contatori"
```

---

### Task 4: (Already done in previous session — drag & drop on sidebar tree nodes)

This task was implemented directly: `onDrop` added to `TreeNodeFull`, `.tree-node.drop-target` CSS added, `onDrop` prop wired in sidebar JSX. Already committed as `d9092f7`.

**No action needed.**

---

## Self-Review

- [x] Task 1: StatusModal uses same overlay/modal structure as BatchOpsModal (fixed bg, blur, border-radius 16px)
- [x] Task 1: Live Drive API call — shows real token status + storage quota
- [x] Task 1: Both DashboardPage and SearchPage get the button
- [x] Task 2: Fallback chain for {parent}/{nonno} when folder depth < needed
- [x] Task 2: `folderPath` already available at call site — no new state/API call needed
- [x] Task 3: `displayPhotos` is derived from `allPhotos`, not a replacement — selection/count logic unaffected
- [x] Task 3: Filter resets on folder change
- [x] Task 4: Already done
