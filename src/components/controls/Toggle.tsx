import { useCallback, useRef, useState } from 'react'
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
  /**
   * Optional controlled submission guard. When provided, the Toggle awaits the
   * returned promise and only emits one `change` per settled request. While the
   * promise is in flight the control is disabled and marked busy, preventing
   * concurrent double-submits from rapid clicks or keyboard auto-repeat.
   */
  onChangeAsync?: (next: boolean) => Promise<void>
  /**
   * Optional error notification for async failures. When provided, the Toggle
   * reports the failure and returns to its previous visual state without
   * losing the user's intent.
   */
  onChangeError?: (error: unknown) => void
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
  onChangeAsync,
  onChangeError,
}: ToggleProps) {
  const isDisabled = disabled || isLoading
  const isInvalid = !!error || ariaInvalid === true || ariaInvalid === 'true'

  // Track the in-flight async request so concurrent clicks cannot double-submit.
  const inFlightRef = useRef(false)
  const [isPending, setIsPending] = useState(false)

  const commit = useCallback(
    (next: boolean) => {
      if (onChangeAsync) {
        if (inFlightRef.current) {
          // Invariant: at most one async change is in flight at any time.
          return
        }
        inFlightRef.current = true
        setIsPending(true)
        Promise.resolve(onChangeAsync(next))
          .then(() => {
            // Success: the controlled `checked` prop is expected to reflect the new value.
          })
          .catch((cause: unknown) => {
            // Failure: report to the caller and leave the visual state unchanged
            // so the user can retry without losing data.
            onChangeError?.(cause)
          })
          .finally(() => {
            inFlightRef.current = false
            setIsPending(false)
          })
        return
      }
      onChange(next)
    },
    [onChange, onChangeAsync, onChangeError]
  )

  const isPendingVisual = isLoading || isPending
  const effectivelyDisabled = isDisabled || isPending

  return (
    <div className={`control-toggle-wrapper ${isPendingVisual ? 'control-toggle-wrapper--loading' : ''}`}>
      <button
        id={id}
        className={`control-toggle ${isInvalid ? 'control-toggle--error' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-invalid={isInvalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
        aria-busy={isPending ? 'true' : undefined}
        disabled={effectivelyDisabled}
        onClick={() => commit(!checked)}
      >
        {isPendingVisual ? (
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
