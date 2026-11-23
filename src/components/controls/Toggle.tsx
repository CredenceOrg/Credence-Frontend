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
 * Normalizes the aria-invalid prop into a boolean.
 *
 * Invariant: any explicit invalid signal (error message or aria-invalid)
 * must map to aria-invalid="true" on the switch so assistive technology
 * announces the field as invalid even when the visual error state is driven
 * by a controlled prop instead of a validation message.
 */
function isInvalidProp(ariaInvalid: ToggleProps['aria-invalid']): boolean {
  return ariaInvalid === true || ariaInvalid === 'true'
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
  const isInvalid = !!error || isInvalidProp(ariaInvalid)

  // Tracks whether a click is already in flight so concurrent activations
  // (double-click, keyboard + click, synthetic events) cannot emit more than one
  // change per committed interaction. The guard is reset on every render so
  // the controlled component also recovers correctly from a rejected or stale
  // parent update.
  const inFlightRef = useRef(false)
  inFlightRef.current = false

  const handleClick = useCallback(() => {
    if (isDisabled) {
      // Defensive guard: the native disabled attribute already blocks this,
      // but keeping the check here prevents synthetic event dispatch from
      // mutating controlled state while loading or disabled.
      return
    }
    if (inFlightRef.current) {
      // Duplicate activation within the same commit window: ignore to avoid
      // double toggles that would lose the user's intended value.
      return
    }
    inFlightRef.current = true
    onChange(!checked)
  }, [checked, isDisabled, onChange])

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
