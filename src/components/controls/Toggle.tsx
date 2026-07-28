import './controls.css'

interface ToggleProps {
  id?: string
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel?: string
  disabled?: boolean
  isLoading?: boolean
  error?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-required'?: boolean | 'true' | 'false'
}

export default function Toggle({
  id,
  checked,
  onChange,
  ariaLabel,
  disabled,
  isLoading,
  error,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: ToggleProps) {
  const isDisabled = disabled || isLoading
  const isInvalid = !!error || ariaInvalid === true || ariaInvalid === 'true'

  return (
    <div className={`control-toggle-wrapper ${isLoading ? 'control-toggle-wrapper--loading' : ''}`}>
      <button
        id={id}
        className={`control-toggle ${isInvalid ? 'control-toggle--error' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-invalid={isInvalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        disabled={isDisabled}
        onClick={() => onChange(!checked)}
      >
        {isLoading ? (
          <span className="control-toggle-spinner" aria-hidden="true" />
        ) : checked ? (
          'On'
        ) : (
          'Off'
        )}
      </button>
    </div>
  )
}
