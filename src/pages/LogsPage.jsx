import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessions, clearSessions, downloadCSV } from '../logs'

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
        <div>
          <h1>📋 Logs</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Storico sessioni di rename</p>
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
            <button onClick={handleClear} className="btn-secondary" style={{ color: 'var(--danger, #ef4444)' }}>
              🗑 Elimina tutti i log
            </button>
          </div>

          {sessions.map((session, idx) => {
            const successCount = session.entries.filter(e => e.success).length
            const failCount = session.entries.length - successCount
            const isOpen = expanded === idx

            return (
              <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '12px', overflow: 'hidden' }}>
                <div
                  onClick={() => setExpanded(isOpen ? null : idx)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', background: isOpen ? '#f9fafb' : 'white' }}
                >
                  <div>
                    <strong>{session.rootFolder}</strong>
                    <span style={{ marginLeft: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(session.date).toLocaleString('it-IT')}
                    </span>
                    <span style={{ marginLeft: '10px', fontSize: '12px', background: '#dcfce7', color: '#16a34a', borderRadius: '4px', padding: '2px 6px' }}>
                      {successCount} ok
                    </span>
                    {failCount > 0 && (
                      <span style={{ marginLeft: '6px', fontSize: '12px', background: '#fee2e2', color: '#dc2626', borderRadius: '4px', padding: '2px 6px' }}>
                        {failCount} errori
                      </span>
                    )}
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      [{session.mode === 'legacy' ? 'Legacy' : 'Custom'}]
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadCSV(session) }}
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      ⬇ CSV
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #e5e7eb', overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>St.</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Cartella</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Nome originale</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Nome nuovo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.entries.map((entry, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '6px 12px' }}>{entry.success ? '✅' : '❌'}</td>
                            <td style={{ padding: '6px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>{entry.folderName}</td>
                            <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{entry.oldName}</td>
                            <td style={{ padding: '6px 12px', color: entry.success ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)', fontWeight: 500 }}>
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
