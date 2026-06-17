

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
      style={{
        padding: '0.25rem 0.5rem',
        borderRadius: '999px',
        border: '1px solid var(--border-default)',
        background: checked ? 'var(--bg-accent)' : 'var(--bg-card)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        minWidth: '64px',
      }}
    >
      {checked ? 'On' : 'Off'}
    </button>
  )
}
