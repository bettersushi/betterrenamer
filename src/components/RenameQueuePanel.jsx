import { useState } from 'react'
import { useRenameQueue } from '../context/RenameQueueContext'
import { formatETA, jobSubfolders } from '../renameQueueEngine'
import './RenameQueuePanel.css'

const IconList = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
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
const IconPlay = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)
const IconDancer = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4" r="2"/>
    <line x1="12" y1="6" x2="12" y2="14"/>
    <line x1="12" y1="8" x2="6" y2="5"/>
    <line x1="12" y1="8" x2="18" y2="11"/>
    <line x1="12" y1="14" x2="7" y2="20"/>
    <line x1="12" y1="14" x2="17" y2="20"/>
  </svg>
)
const IconChevron = ({ up }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ transform: up ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const btnAvviaTutto = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 6, border: 'none', color: 'white', cursor: 'pointer' }

export default function RenameQueuePanel() {
  const {
    queue, queueHasItems, interruptedJobs, queuedJobs, runningJobs, pendingJobs, doneJobs,
    startJob, startAll, removeQueued, restartJob, restartAll, clearCompleted,
  } = useRenameQueue()
  const [collapsed, setCollapsed] = useState(false)

  if (!queueHasItems) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: 20, zIndex: 3999,
      width: '36%', maxWidth: 'calc(100vw - 40px)', maxHeight: '70vh',
      display: 'flex', flexDirection: 'column',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      boxShadow: '0 12px 40px rgba(0,0,0,0.35)', overflow: 'hidden',
    }}>
      {/* Header — always visible */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', flexShrink: 0, borderBottom: collapsed ? 'none' : '1px solid var(--border)' }}
      >
        <IconList />
        <strong style={{ fontSize: 13 }}>Coda</strong>
        {queuedJobs.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{queuedJobs.length} in coda</span>}
        {runningJobs.length > 0 && <span style={{ fontSize: 11, color: '#3b82f6' }}>{runningJobs.length} in esecuzione</span>}
        {pendingJobs.length > 0 && <span style={{ fontSize: 11, color: '#888' }}>{pendingJobs.length} in partenza</span>}
        {doneJobs.length > 0 && <span style={{ fontSize: 11, color: '#16a34a' }}>{doneJobs.length} completati</span>}
        {runningJobs.length > 0 && (
          <span style={{ color: '#3b82f6', display: 'flex', animation: 'dancer-bounce 0.6s ease-in-out infinite alternate' }}>
            <IconDancer />
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
          {interruptedJobs.length > 0 && (
            <button onClick={restartAll} style={{ ...btnAvviaTutto, background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}>
              <IconPlay /> Riavvia tutto
            </button>
          )}
          {queuedJobs.length > 0 && (
            <button onClick={startAll} style={{ ...btnAvviaTutto, background: 'var(--primary)' }}>
              <IconPlay /> Avvia tutto
            </button>
          )}
          {doneJobs.length > 0 && (
            <button onClick={clearCompleted} className="btn-secondary" style={{ fontSize: 11, padding: '4px 9px' }}>
              Svuota
            </button>
          )}
        </div>
        <span style={{ display: 'flex', color: 'var(--text-muted)' }}><IconChevron up={!collapsed} /></span>
      </div>

      {/* Job list — collapses downward */}
      {!collapsed && (
        <div style={{ overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {queue.map(job => {
            const pct = job.progress.total > 0 ? Math.round((job.progress.current / job.progress.total) * 100) : 0
            const successCount = job.entries.filter(e => e.success).length
            const failCount = job.entries.filter(e => !e.success).length
            const subs = jobSubfolders(job)

            return (
              <div key={job.id} className="queue-job">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: job.status === 'running' ? 6 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'flex', color: job.status === 'interrupted' ? '#f59e0b' : '#888' }}>
                      {job.status === 'interrupted' && <IconX />}
                      {job.status === 'queued' && <IconClock />}
                      {job.status === 'pending' && <IconClock />}
                      {job.status === 'running' && <IconRefresh />}
                      {job.status === 'done' && <IconCheck />}
                      {job.status === 'error' && <IconX />}
                    </span>
                    <strong style={{ fontSize: 13 }}>{job.rootFolderName}</strong>
                    <span style={{ fontSize: 11, color: '#888' }}>[{job.mode}]</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888' }}>
                    {job.status === 'queued' && (
                      <>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{job.progress.total} file</span>
                        <button onClick={() => startJob(job.id)} className="btn-primary" style={{ fontSize: 11, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }} title="Avvia">
                          <IconPlay /> Avvia
                        </button>
                        <button onClick={() => removeQueued(job.id)} className="btn-secondary" style={{ fontSize: 11, padding: '3px 6px', color: 'var(--danger)' }} title="Rimuovi">
                          <IconXSmall />
                        </button>
                      </>
                    )}
                    {job.status === 'interrupted' && (
                      <>
                        <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Interrotto</span>
                        {job.preview && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{job.preview.length} file</span>}
                        <button onClick={() => restartJob(job.id)} className="btn-primary" style={{ fontSize: 11, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <IconPlay /> Riavvia
                        </button>
                      </>
                    )}
                    {job.status === 'pending' && 'In partenza...'}
                    {job.status === 'running' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {job.progress.current} / {job.progress.total}
                        {job.progress.etaMs && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <IconClock />
                            {formatETA(job.progress.etaMs)}
                          </span>
                        )}
                      </span>
                    )}
                    {job.status === 'done' && (
                      <>
                        <span style={{ color: '#16a34a' }}>{successCount} ok</span>
                        {job.skipCount > 0 && <span style={{ color: 'var(--text-muted)', marginLeft: 6, opacity: 0.6 }}>{job.skipCount} già ok</span>}
                        {failCount > 0 && <span style={{ color: '#dc2626', marginLeft: 6 }}>{failCount} errori</span>}
                      </>
                    )}
                  </div>
                </div>
                {subs.length > 0 && (
                  <div style={{ fontSize: 8, color: 'var(--text-muted)', opacity: 0.65, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {subs.slice(0, 8).join(', ')}{subs.length > 8 ? ` +${subs.length - 8} altre` : ''}
                  </div>
                )}
                {job.status === 'running' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                      <span>
                        <strong style={{ color: '#3b82f6' }}>{job.progress.phase}</strong>{' '}
                        <span style={{ opacity: 0.7 }}>{job.progress.currentFile}</span>
                        {job.progress.currentNewName && <span style={{ opacity: 0.5 }}> → </span>}
                        {job.progress.currentNewName && <span style={{ color: '#3b82f6', opacity: 0.9 }}>{job.progress.currentNewName}</span>}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="queue-progress-bg">
                      <div style={{ background: '#3b82f6', height: '100%', width: `${pct}%`, transition: 'width 0.2s ease' }} />
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
