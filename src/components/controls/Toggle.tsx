import './controls.css'

interface ToggleProps {
  id?: string
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel?: string
}

export default function Toggle({ id, checked, onChange, ariaLabel }: ToggleProps) {
  return (
    <button
      id={id}
      className="control-toggle"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
    >
      {checked ? 'On' : 'Off'}
    </button>
  )
}
