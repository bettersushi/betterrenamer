import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessions, clearSessions, downloadCSV } from '../logs'
import './LogsPage.css'

const IconList = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const IconDownload = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const IconChevronUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
)

export default function LogsPage({ onLogout }) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState(getSessions)
  const [expanded, setExpanded] = useState(null)

  const handleClear = () => {
    if (confirm('Eliminare tutti i log?')) {
      clearSessions()
      setSessions([])
    }
  }

  const handleLogout = () => { onLogout(); navigate('/login') }

  return (
    <div className="container">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconList />
          <div>
            <h1 style={{ fontSize: '20px' }}>Logs</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Storico sessioni di rename</p>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/')} className="btn-secondary">← Dashboard</button>
          <button onClick={handleLogout} className="btn-secondary">Logout</button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          Nessuna sessione registrata.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button onClick={handleClear} className="btn-secondary" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconTrash /> Elimina tutti i log
            </button>
          </div>

          {sessions.map((session, idx) => {
            const successCount = session.entries.filter(e => e.success).length
            const failCount = session.entries.length - successCount
            const isOpen = expanded === idx

            return (
              <div key={idx} className="session-card">
                <div
                  onClick={() => setExpanded(isOpen ? null : idx)}
                  className={`session-header${isOpen ? ' open' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <strong>{session.rootFolder}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(session.date).toLocaleString('it-IT')}
                    </span>
                    <span className="badge-success">{successCount} ok</span>
                    {failCount > 0 && <span className="badge-error">{failCount} errori</span>}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      [{session.mode === 'legacy' ? 'Legacy' : 'Custom'}]
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadCSV(session) }}
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <IconDownload /> CSV
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {isOpen ? <IconChevronUp /> : <IconChevronDown />}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div className="session-body">
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>St.</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Cartella</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Nome originale</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Nome nuovo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.entries.map((entry, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 12px' }}>{entry.success ? <IconCheck /> : <IconX />}</td>
                            <td style={{ padding: '6px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>{entry.folderName}</td>
                            <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{entry.oldName}</td>
                            <td style={{ padding: '6px 12px', color: entry.success ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                              {entry.success ? entry.newName : entry.error}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
