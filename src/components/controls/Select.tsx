

interface SelectProps {
  id?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  ariaLabel?: string
}

export default function Select({ id, value, onChange, options, ariaLabel }: SelectProps) {
  return (
    <select
      id={id}
      className="control-select"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '0.5rem',
        borderRadius: '8px',
        border: '1px solid var(--border-default)',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
