export default function QuickLookModal({ files, onClose }) {
  if (!files || files.length === 0) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: 'rgba(0,0,0,0.6)', flexShrink: 0,
        }}
      >
        <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>
          {files.length === 1 ? files[0].name : `${files.length} file selezionati`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>ESC o ␣ per chiudere</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'white',
              fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '0 4px',
            }}
          >✕</button>
        </div>
      </div>

      {/* Content */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          flex: 1, overflow: 'auto', padding: '16px',
          display: 'grid',
          gridTemplateColumns: files.length === 1 ? '1fr' : 'repeat(2, 1fr)',
          gap: '16px',
        }}
      >
        {files.map(file => (
          <div key={file.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <iframe
              src={`https://drive.google.com/file/d/${file.id}/preview`}
              style={{
                width: '100%',
                height: files.length === 1 ? 'calc(100vh - 100px)' : '340px',
                border: 'none', borderRadius: '8px', background: '#111',
              }}
              allow="autoplay"
              title={file.name}
            />
            {files.length > 1 && (
              <p style={{
                color: 'rgba(255,255,255,0.7)', fontSize: '12px',
                textAlign: 'center', margin: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{file.name}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
