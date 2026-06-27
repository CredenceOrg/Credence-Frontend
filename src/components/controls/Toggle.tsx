import './controls.css'

interface ToggleProps {
  id?: string
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel?: string
  disabled?: boolean
  isLoading?: boolean
  error?: string
}

export default function Toggle({
  id,
  checked,
  onChange,
  ariaLabel,
  disabled,
  isLoading,
  error,
}: ToggleProps) {
  const isDisabled = disabled || isLoading
  const isInvalid = !!error

  return (
    <div className={`control-toggle-wrapper ${isLoading ? 'control-toggle-wrapper--loading' : ''}`}>
      <button
        id={id}
        className={`control-toggle ${isInvalid ? 'control-toggle--error' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-invalid={isInvalid}
        disabled={isDisabled}
        onClick={() => onChange(!checked)}
      >
        {isLoading ? <span className="control-toggle-spinner" aria-hidden="true" /> : checked ? 'On' : 'Off'}
      </button>
    </div>
  )
}
