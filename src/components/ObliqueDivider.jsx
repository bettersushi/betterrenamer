export default function ObliqueDivider({ height = 22, style }) {
  return (
    <div
      style={{
        width: 1, height, background: 'var(--border)',
        transform: 'rotate(6deg)', flexShrink: 0,
        ...style,
      }}
    />
  )
}
