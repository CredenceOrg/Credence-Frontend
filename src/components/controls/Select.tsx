import { useId } from 'react'
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

/**
 * A controlled native `<select>`.
 *
 * State model — `value` and `options` are supplied by the caller; Select holds
 * no mutable state of its own. A failed or in-flight write therefore leaves the
 * control showing the last *committed* value instead of optimistically moving
 * to an option the server never accepted.
 *
 * Invariants (asserted in Select.test.tsx / Select.stories.test.tsx):
 *
 *  1. `isLoading` implies non-interactive. `disabled` and `isLoading` are
 *     OR-ed, so a pending write cannot be committed over by a second selection.
 *  2. `error` outranks `aria-invalid`. A truthy `error` always wins, even against
 *     an explicit `aria-invalid={false}`, so a validation failure cannot be
 *     silently downgraded by a stale prop.
 *  3. `error` is never silent. The message renders in a `role="alert"` node
 *     linked via `aria-describedby`; an invalid field whose reason is not
 *     announced is not diagnosable.
 *  4. Caller `aria-describedby` is preserved. A caller-supplied id list (the one
 *     `FormField` injects) is appended to, never replaced.
 *  5. `value` is the single source of truth. A change emits the raw option
 *     value and mutates nothing locally, so a rejected write snaps the control
 *     back to the persisted value rather than showing a phantom selection.
 *
 * Known boundary — `value` absent from `options` (a stale or foreign persisted
 * value) is left to the native element, which falls back to the first option.
 * That is deliberately *not* rewritten here: silently substituting a different
 * option would misrepresent what is stored, and auto-selecting a default could
 * commit a value the user never chose. The caller owns that decision. The
 * fallback is pinned by tests so the behavior cannot change unnoticed.
 */
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
  // Invariant 1: a pending write is never interactive, regardless of `disabled`.
  const isDisabled = disabled || isLoading
  // Invariant 2: a truthy `error` always wins. An empty string is "no error",
  // so callers can pass a computed message without branching on undefined.
  const isInvalid = !!error || ariaInvalid === true || ariaInvalid === 'true'

  // Invariant 4: tree-scoped, never derived from the caller's `id` — `FormField`
  // builds its own `${id}-error` and deriving ours the same way would emit two
  // elements sharing a DOM id.
  const errorId = useId()

  // Invariants 3 + 4: link the message without dropping a caller-supplied list.
  const describedBy =
    [ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined

  return (
    <div className={`control-select-wrapper ${isLoading ? 'control-select-wrapper--loading' : ''}`}>
      <select
        id={id}
        className={`control-select ${isInvalid ? 'control-select--error' : ''}`}
        value={value}
        aria-label={ariaLabel}
        aria-invalid={isInvalid ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={ariaRequired}
        aria-busy={isLoading || undefined}
        disabled={isDisabled}
        onChange={(e) => {
          // The native `disabled` attribute blocks pointer and keyboard input,
          // but a synthetic change event (form reset replay, programmatic
          // dispatch, some screen readers) can still reach this handler. Guard
          // so a disabled or loading control can never emit a selection.
          if (isDisabled) return
          onChange(e.target.value)
        }}
      >
        {options.map((o, index) => (
          // Keyed by value plus index, not by `o.value` alone: duplicate option
          // values are invalid input, but a value-derived key would emit a React
          // duplicate-key warning and risk reconciling the wrong option across a
          // re-render. Uniqueness is the caller's contract; this keeps bad input
          // from corrupting the DOM order that determines what the user sees.
          <option key={`${o.value}::${index}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {isLoading && <div className="control-select-spinner" aria-hidden="true" />}
      {/*
        Invariant 3, loading half. The spinner is decorative and overlays the
        native control, so without this region a screen reader gets no signal
        that a write is pending. Rendered outside the <select> so it cannot
        become part of the accessible name.
      */}
      {isLoading && (
        <span className="sr-only" role="status" aria-live="polite">
          Saving selection
        </span>
      )}
      {error && (
        <span id={errorId} className="control-select__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
