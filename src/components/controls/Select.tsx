import './controls.css'

interface SelectProps {
  id?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  ariaLabel?: string
  disabled?: boolean
  isLoading?: boolean
  error?: string
}

export default function Select({
  id,
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
  isLoading,
  error,
}: SelectProps) {
  const isDisabled = disabled || isLoading
  const isInvalid = !!error

  return (
    <div className={`control-select-wrapper ${isLoading ? 'control-select-wrapper--loading' : ''}`}>
      <select
        id={id}
        className={`control-select ${isInvalid ? 'control-select--error' : ''}`}
        value={value}
        aria-label={ariaLabel}
        aria-invalid={isInvalid}
        disabled={isDisabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {isLoading && <div className="control-select-spinner" aria-hidden="true" />}
    </div>
  )
}
