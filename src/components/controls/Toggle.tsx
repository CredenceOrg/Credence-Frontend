import { useCallback, useRef } from 'react'
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

/**
 * Invariants:
 * - The component is fully controlled: the rendered state is always derived from the `checked` prop.
 * - controls the next value as `!checked` from the latest prop, so concurrent or rapid
 *   activations never derive from stale internal state.
 * - Activation is suppressed while `disabled` or `isLoading` is true, and while an
 *   error is present, so failed or in-flight persistence cannot be double-submitted.
 * - The accessible name and description wiring are preserved for FormField composition.
 */
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
  const hasError = !!error
  const isInvalid = hasError || ariaInvalid === true || ariaInvalid === 'true'

  // Track the latest `checked` prop without re-creating the handler, so activations
  // always derive the next value from the current prop even if the click event is
  // dispatched after a re-render.
  const checkedRef = useRef(checked)
  checkedRef.current = checked

  const handleClick = useCallback(() => {
    // Guard against activation while disabled, loading, or in an error state. The
    // native `disabled` attribute blocks most interactions, but this guarantees the
    // invariant even if a synthetic event or programmatic click bypasses it.
    if (isDisabled || hasError) {
      return
    }
    onChange(!checkedRef.current)
  }, [isDisabled, hasError, onChange])

  return (
    <div className={`control-toggle-wrapper ${isLoading ? 'control-toggle-wrapper--loading' : ''}`}>
      <button
        id={id}
        className={@control-toggle ${isInvalid ? 'control-toggle--error' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-invalid={isInvalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        disabled={isDisabled}
        onClick={handleClick}
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
