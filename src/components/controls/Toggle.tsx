import { useId } from 'react'
import './controls.css'

export interface ToggleProps {
  id?: string
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel?: string
  disabled?: boolean
  /**
   * Human-readable explanation shown next to the switch while `disabled` is
   * true (permission denied, feature not provisioned, read-only session, …).
   * The reason is rendered as static text and linked with `aria-describedby`
   * so assistive technology can explain why the control is inert instead of
   * leaving the user with a silently dead control.
   *
   * Only rendered when `disabled` is set; a busy switch is explained by
   * `loadingLabel` instead.
   */
  disabledReason?: string
  isLoading?: boolean
  /** Announced (screen-reader only) while `isLoading` is true. */
  loadingLabel?: string
  /**
   * Marks the rendered value as known-out-of-date (a revalidation is pending,
   * or a newer server value exists locally). Stale is deliberately *not* the
   * same as loading: a stale switch stays interactive so the user can correct
   * it, and its currently rendered value is never silently replaced.
   */
  isStale?: boolean
  /** Visible note rendered while `isStale` is true. */
  staleMessage?: string
  error?: string
  /**
   * Renders a retry affordance, but only alongside `error`. Clicking it
   * re-runs the caller's mutation and never changes the switch value, so a
   * failed save can be retried without toggling the user's setting by mistake.
   */
  onRetry?: () => void
  /** Label for the retry affordance. */
  retryLabel?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-required'?: boolean | 'true' | 'false'
}

/**
 * Controlled boolean switch used for persisted boolean settings.
 *
 * Invariants (all covered by Toggle.test.tsx / Toggle.boundary.test.tsx /
 * Toggle.recovery.test.tsx):
 *
 * 1. The rendered value is always the `checked` prop. The component owns no
 *    internal state, so a rejected/failed mutation can never leave a
 *    half-applied optimistic value on screen, and the emitted value is always
 *    the negation of the last value the parent confirmed.
 * 2. Interaction is refused while `disabled` or `isLoading` is true. This is
 *    enforced in the click handler itself, not only by the `disabled`
 *    attribute, so a programmatically dispatched click cannot smuggle a
 *    state transition through a busy or unauthorised control.
 * 3. `type="button"` is always set: a Toggle inside a `<form>` must not submit
 *    that form (a stray submit would lose unsaved input elsewhere on the page).
 * 4. While `isLoading` is true the switch is `aria-busy` and announces
 *    `loadingLabel` through a polite live region; clicks are dropped, so a
 *    double click cannot fan out into two writes of the same value.
 * 5. `error` is surfaced, not just styled: the message is rendered and linked
 *    through `aria-describedby` together with `aria-invalid="true"`. When the
 *    caller already supplies `aria-describedby` (for example `FormField`, which
 *    renders its own message) Toggle does not render a second copy, so the
 *    message is never announced twice.
 * 6. `onRetry` is rendered only together with `error`, is disabled while a
 *    request is in flight or the control is disabled, and never flips the
 *    switch value.
 * 7. `isStale` never disables the control and never changes the rendered
 *    value; it only annotates it, so a stale value can still be corrected.
 */
export default function Toggle({
  id,
  checked,
  onChange,
  ariaLabel,
  disabled,
  disabledReason,
  isLoading = false,
  loadingLabel = 'Saving…',
  isStale = false,
  staleMessage = 'This value may be out of date. Refresh to confirm the saved value.',
  error,
  onRetry,
  retryLabel = 'Retry',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: ToggleProps) {
  // Ids are derived from the caller's `id` when present so the messages stay
  // addressable from tests and from parent form wiring; `useId` keeps them
  // unique (and stable across renders) for a Toggle rendered without an id.
  const generatedId = useId()
  const baseId = id ?? generatedId

  const isDisabled = Boolean(disabled) || isLoading
  const isInvalid = Boolean(error) || ariaInvalid === true || ariaInvalid === 'true'

  const showDisabledReason = Boolean(disabled) && Boolean(disabledReason)
  const showErrorMessage = Boolean(error) && !ariaDescribedBy
  const showRetry = Boolean(error) && Boolean(onRetry)
  const errorId = `${baseId}-error`
  const reasonId = `${baseId}-reason`
  const staleId = `${baseId}-stale`

  // Merge our own messages with anything the caller already declared. The
  // caller's tokens come first so an existing description keeps priority.
  const describedBy =
    [
      ariaDescribedBy,
      showErrorMessage ? errorId : undefined,
      showDisabledReason ? reasonId : undefined,
      isStale ? staleId : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined

  // Single documented precedence for the reflected state; error styling and
  // aria-invalid stay independent so a failure that is still being retried is
  // reported as busy first without losing its invalid marking.
  const state = isLoading
    ? 'loading'
    : isInvalid
      ? 'error'
      : disabled
        ? 'disabled'
        : isStale
          ? 'stale'
          : 'default'

  return (
    <div
      className={['control-toggle-wrapper', isLoading ? 'control-toggle-wrapper--loading' : '']
        .filter(Boolean)
        .join(' ')}
      data-state={state}
    >
      <button
        id={id}
        type="button"
        className={`control-toggle ${isInvalid ? 'control-toggle--error' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-invalid={isInvalid ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={ariaRequired}
        aria-busy={isLoading ? 'true' : undefined}
        disabled={isDisabled}
        onClick={() => {
          // Invariant 2: re-check the guard here so the refused transition
          // does not depend on the browser or React filtering clicks that were
          // dispatched while the control was disabled.
          if (isDisabled) return
          onChange(!checked)
        }}
      >
        {isLoading ? (
          <span className="control-toggle-spinner" aria-hidden="true" />
        ) : checked ? (
          'On'
        ) : (
          'Off'
        )}
      </button>

      {/*
        Always-mounted polite live region: registering the region before the
        text appears is what makes the announcement reliable, and the region
        stays empty otherwise so it never interrupts a screen reader.
      */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {isLoading ? loadingLabel : ''}
      </span>

      {isStale && (
        <span id={staleId} className="control-toggle__note control-toggle__note--stale">
          {staleMessage}
        </span>
      )}

      {showDisabledReason && (
        <span id={reasonId} className="control-toggle__note">
          {disabledReason}
        </span>
      )}

      {showErrorMessage && (
        <span id={errorId} className="control-toggle__error" role="alert">
          {error}
        </span>
      )}

      {showRetry && (
        <button
          type="button"
          className="control-toggle__retry"
          // Invariant 6: the affordance is disabled while a request is already
          // in flight or the setting is locked, so parallel retries of the same
          // write cannot be submitted. The in-handler guard stays as
          // defence in depth against programmatically dispatched clicks.
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) return
            onRetry?.()
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
