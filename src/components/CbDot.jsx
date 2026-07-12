// Checkbox custom "a pallino" usata nel pannello di configurazione rename e nelle
// selezioni cartella — condivisa tra DashboardPage/BetterRenamerModal e SearchPage
// così lo stile resta identico ovunque compaia una checkbox legata al rename.
export default function CbDot({ checked, onChange, refProp, id, title }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <input type="checkbox" id={id} ref={refProp} checked={checked} onChange={onChange}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
      <span onClick={onChange} title={title} style={{
        width: 14, height: 14, borderRadius: '50%',
        border: `1.5px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
        background: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        transition: 'border-color 0.12s',
      }}>
        {checked && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />}
      </span>
    </span>
  )
}
