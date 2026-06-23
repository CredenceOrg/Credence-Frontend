import './controls.css'

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
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
