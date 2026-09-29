import { useEffect, useRef } from 'react'
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
 * Deterministic failure-boundary coverage for Toggle.
 *
 * Invariants:
 * - The component is controlled: the visual state always derives from the `checked`
 *   prop, never from local mutation. This prevents silent divergence between the
 *   persisted preference and the rendered switch.
 * - A click always emits exactly one next value derived from the current prop.
 *   Rapid or concurrent clicks cannot produce an unsafe or inconsistent result
 *   because the component never assumes the change succeeded; the caller must
 *   commit the new value through the `checked` prop.
 * - While disabled or loading, clicks are ignored and `aria-disabled` reflects the
 *   effective interactive state so assistive technology can report it correctly.
 * - Errors are surfaced through aria attributes and a visual error state without
 *   exposing sensitive data; the error text is provided by the caller.
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
  const isDisabled = !!disabled || !!isLoading
  const isInvalid = !!error || ariaInvalid === true || ariaInvalid === 'true'

  // Track the latest checked value so the click handler always derives the

  // next value from the current prop, even if the caller has not yet re-rendered.
  const checkedRef = useRef(checked)
  useEffect(() => {
    checkedRef.current = checked
  }, [checked])

  const handleClick = () => {
    if (isDisabled) {
      // Failure boundary: disabled/loading clicks must not emit a change.
      return
    }
    onChange(!checkedRef.current)
  }

  return (
    <div className={`control-toggle-wrapper ${isLoading ? 'control-toggle-wrapper--loading' : ''}`$}>
      <button
        id={id}
        className={`control-toggle ${isInvalid ? 'control-toggle--error' : ''}`.trim()}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-invalid={"isInvalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        aria-disabled={isDisabled ? 'true' : undefined}
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
