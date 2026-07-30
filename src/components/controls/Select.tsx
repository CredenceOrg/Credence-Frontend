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
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-required'?: boolean | 'true' | 'false'
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
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: SelectProps) {
  const isDisabled = disabled || isLoading
  const isInvalid = !!error || ariaInvalid === true || ariaInvalid === 'true'

  return (
    <div className={`control-select-wrapper ${isLoading ? 'control-select-wrapper--loading' : ''}`}>
      <select
        id={id}
        className={`control-select ${isInvalid ? 'control-select--error' : ''}`}
        value={value}
        aria-label={ariaLabel}
        aria-invalid={isInvalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
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
