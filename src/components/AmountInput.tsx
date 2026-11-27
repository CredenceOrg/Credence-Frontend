import { useEffect, useId, useMemo, useState, useRef } from 'react'
import './AmountInput.css'
import { normalizeUSDC, formatUSDC, sanitizeUSDCInput } from '@/lib/format'
export { normalizeUSDC, formatUSDC, sanitizeUSDCInput } from '@/lib/format'

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'inputMode'
>

export interface AmountInputProps extends NativeInputProps {
  /** Controlled decimal amount string. */
  value: string
  /** Called with sanitized input while editing and normalized input on blur. */
  onChange: (value: string) => void
  /** Available balance used by the Max button, preset disabled states, and over-balance validation. */
  balance: number
  /** Quick-select amounts rendered below the input. */
  presets?: number[]
  /** Currency label shown as the input adornment and in button labels. */
  currencyLabel?: string
  /**
   * Optional validation message that marks the amount control invalid.
   * When provided, this takes precedence over the internal over-balance error.
   */
  error?: string
  /**
   * When true, skips rendering the inline error message so a parent `FormField`
   * (or other owner) can surface the message via `aria-describedby` without
   * duplicating alerts. Visual invalid styling and `aria-invalid` still apply.
   */
  hideErrorMessage?: boolean
  /**
   * Called whenever the internal validity state changes.
   * `isValid` is `false` when the entered amount exceeds balance; `true` otherwise.
   * Callers can use this to gate form submission without duplicating the comparison.
   */
  onValidityChange?: (isValid: boolean) => void
  /** Loading state - shows skeleton/spinner and disables interaction */
  isLoading?: boolean
  /** Minimum allowed amount */
  min?: number
  /**
   * Optional async handler to compute the maximum available amount.
   * If provided, clicking Max will enter a loading state and resolve the amount.
   */
  onMaxRequest?: () => Promise<number>
}

export type MaxState = 'idle' | 'loading' | 'error' | 'stale' | 'permission'

/**
 * Non-sensitive classification of why the last `onMaxRequest` attempt failed.
 *
 * The raw `Error.message` is deliberately *not* retained or rendered: it can
 * carry server internals, request ids, or echoed amounts, and this control is
 * embedded in pages that do not control the upstream error source. The bucket
 * is enough to make a failure diagnosable (assertable in tests, readable in the
 * DOM as `data-max-error-reason`) without leaking anything.
 */
export type MaxErrorReason =
  | 'network'
  | 'permission'
  | 'stale'
  | 'invalid_payload'
  | 'unknown'

/** Error name/code used by upstream callers to signal "you may not read max". */
const PERMISSION_CODES = new Set(['PERMISSION_DENIED'])
/** Error name/code used by upstream callers to signal "this data is stale". */
const STALE_CODES = new Set(['STALE_DATA'])

/** Thrown internally when `onMaxRequest` resolves with a non-amount. */
class InvalidMaxPayloadError extends Error {
  constructor() {
    super('Invalid max amount returned')
    this.name = 'InvalidMaxPayloadError'
  }
}

/**
 * Classifies an `onMaxRequest` rejection into a `MaxErrorReason`.
 *
 * Detection is layered so a rejection is classified the same way whether the
 * caller signals via `Error.name`, a `code` field, or message text:
 *
 * 1. `name === 'InvalidMaxPayloadError'` — our own guard, so a malformed
 *    payload is never misreported as a network fault.
 * 2. `PermissionError` / `code === 'PERMISSION_DENIED'` / a message mentioning
 *    permission or unauthorized. Checked before staleness because
 *    "unauthorized" also contains no other keyword, but an authorization
 *    failure is the more actionable diagnosis and must win if both appear.
 * 3. `StaleDataError` / `code === 'STALE_DATA'` / a message mentioning stale.
 * 4. `network_error` code or a message mentioning network/offline/failed to
 *    fetch, which is the common retryable bucket.
 * 5. `unknown` otherwise, including non-`Error` rejections and `null`.
 */
export function classifyMaxError(err: unknown): MaxErrorReason {
  if (err instanceof InvalidMaxPayloadError) return 'invalid_payload'

  const code = (err as { code?: unknown } | null | undefined)?.code
  const name = (err as { name?: unknown } | null | undefined)?.name
  const message = err instanceof Error ? err.message : String(err)
  const haystack = message.toLowerCase()

  if (
    name === 'PermissionError' ||
    (typeof code === 'string' && PERMISSION_CODES.has(code)) ||
    haystack.includes('permission') ||
    haystack.includes('unauthorized')
  ) {
    return 'permission'
  }

  if (
    name === 'StaleDataError' ||
    (typeof code === 'string' && STALE_CODES.has(code)) ||
    haystack.includes('stale')
  ) {
    return 'stale'
  }

  if (
    (typeof code === 'string' && code === 'network_error') ||
    haystack.includes('network') ||
    haystack.includes('offline') ||
    haystack.includes('failed to fetch')
  ) {
    return 'network'
  }

  return 'unknown'
}

/** Maps a `MaxErrorReason` onto the `MaxState` surfaced to the user. */
function stateForReason(reason: MaxErrorReason): MaxState {
  if (reason === 'permission') return 'permission'
  if (reason === 'stale') return 'stale'
  return 'error'
}

/** Copy shown inside the max-error alert, keyed by the user-facing `MaxState`. */
const MAX_ERROR_COPY: Record<'error' | 'stale' | 'permission', string> = {
  permission: 'Permission denied getting max amount.',
  stale: 'Max amount data is stale.',
  error: 'Failed to get max amount.',
}

/**
 * Invariants this component guarantees. Each is enforced by
 * `AmountInput.failure-boundary.test.tsx`.
 *
 * I1. **User input is never destroyed by a failure.** A rejected, stale or
 *     permission-denied `onMaxRequest` never calls `onChange`, so the amount
 *     the user already typed survives untouched. Likewise `isLoading` no longer
 *     blanks the field — it only disables it.
 * I2. **At most one `onMaxRequest` is in flight per control.** Enforced with a
 *     ref rather than render state, so a same-tick double click (both handlers
 *     see the pre-click `maxState`) cannot dispatch a second request.
 * I3. **Last user intent wins.** Every direct edit — typing, blur, or a preset
 *     chip — bumps the request sequence, so a late `onMaxRequest` resolution is
 *     discarded instead of overwriting a newer choice.
 * I4. **A superseded request still releases the loading state.** Discarding a
 *     result must also clear `loading`, otherwise the spinner would latch and
 *     the Max button would stay permanently disabled.
 * I5. **Validation is total.** `balance` and `min` are treated as absent when
 *     non-finite, so `NaN`/`Infinity` from a failed balance fetch can never
 *     reach `onChange` (which would inject the literal string `"NaN"`).
 * I6. **Presets are finite, non-negative and unique.** Duplicate chips would
 *     otherwise emit a React duplicate-key warning and reconcile the wrong
 *     button across re-renders.
 * I7. **`onValidityChange` fires on transitions only.** Re-notifying the same
 *     boolean on every render pushes callers that derive state from it into a
 *     render loop.
 * I8. **Failures stay diagnosable without leaking.** The alert carries generic
 *     copy; the non-sensitive bucket is exposed as `data-max-error-reason` and
 *     the control state as `data-max-state`.
 */

export default function AmountInput({
  value,
  onChange,
  balance,
  presets = [100, 500, 1000],
  currencyLabel = 'USDC',
  error,
  hideErrorMessage = false,
  isLoading = false,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  onBlur,
  onFocus,
  onValidityChange,
  disabled,
  min,
  onMaxRequest,
  ...inputProps
}: AmountInputProps) {
  const uid = useId()
  const errorId = `${uid}-error`
  const maxErrorId = `${uid}-max-error`

  const [isFocused, setIsFocused] = useState(false)
  const [maxState, setMaxState] = useState<MaxState>('idle')
  const [maxErrorReason, setMaxErrorReason] = useState<MaxErrorReason | null>(null)

  // Monotonic token identifying the newest request or newest direct edit.
  // Anything resolving with a stale token is discarded (I3).
  const maxRequestSeq = useRef(0)
  // Ref mirror of the in-flight flag so a same-tick double click is caught even
  // though `setMaxState` has not re-rendered yet (I2).
  const maxInFlight = useRef(false)
  // Last validity boolean handed to `onValidityChange`, so the effect below only
  // fires on real transitions (I7).
  const lastValidity = useRef<boolean | null>(null)

  // A non-finite balance (failed fetch, `undefined` coerced by a JS caller) must
  // not become `"NaN"` in the field, and must not silently disable validation.
  // Clamping to 0 also keeps Max disabled, which is the safe direction (I5).
  const safeBalance = Number.isFinite(balance) ? Math.max(0, balance) : 0
  // A non-finite `min` reads as "no minimum" rather than leaning on NaN
  // comparison semantics, which would make the outcome depend on the amount.
  const safeMin = typeof min === 'number' && Number.isFinite(min) ? min : undefined

  // Derive over-balance and below-minimum states from the normalized numeric value.
  const numericValue = useMemo(() => {
    const normalized = normalizeUSDC(value)
    if (!normalized) return 0
    return Number(normalized)
  }, [value])

  const isOverBalance = numericValue > 0 && numericValue > safeBalance
  const isBelowMin = safeMin !== undefined && numericValue > 0 && numericValue < safeMin

  // Explicit `error` prop always wins; over-balance takes precedence over below-minimum.
  const activeError =
    error ??
    (isOverBalance
      ? 'Amount exceeds available balance.'
      : isBelowMin
        ? `Amount must be at least ${min} ${currencyLabel}.`
        : undefined)

  const showInlineError = Boolean(activeError) && !hideErrorMessage
  const isInvalid = Boolean(activeError) || ariaInvalid === 'true'

  // Notify caller when internal validity changes.
  // A non-empty value is invalid when it exceeds balance OR falls below min.
  // Only a real transition notifies, so an inline callback cannot loop (I7).
  useEffect(() => {
    const next = !isOverBalance && !isBelowMin
    if (lastValidity.current === next) return
    lastValidity.current = next
    onValidityChange?.(next)
  }, [isOverBalance, isBelowMin, onValidityChange])

  const displayValue = useMemo(() => {
    if (isFocused) return value
    return formatUSDC(value)
  }, [isFocused, value])

  /**
   * Invalidates any in-flight max request because the user has expressed a
   * newer intent directly, and releases the loading state so Max stays usable
   * (I3, I4). Called from the text field, from blur, and from preset chips.
   */
  const supersedePendingMax = () => {
    maxRequestSeq.current += 1
    if (!maxInFlight.current) return
    // In-flight implies the button already reads `loading` (that is what set
    // the ref), so `idle` is the only correct resting state here. This also
    // guarantees Max is never left permanently disabled (I4).
    maxInFlight.current = false
    setMaxState('idle')
  }

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = (event) => {
    setIsFocused(false)
    supersedePendingMax()
    const normalized = normalizeUSDC(value)
    if (normalized !== value) onChange(normalized)
    onBlur?.(event)
  }

  const handleFocus: React.FocusEventHandler<HTMLInputElement> = (event) => {
    setIsFocused(true)
    onFocus?.(event)
  }

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    // A keystroke is newer intent than an in-flight max (I3).
    supersedePendingMax()
    onChange(sanitizeUSDCInput(event.target.value))
  }

  const executeMax = async () => {
    // Ref-based guard: survives a same-tick re-click that `maxState` would miss (I2).
    if (maxInFlight.current) return

    if (!onMaxRequest) {
      // Synchronous path — no request to supersede, and `safeBalance` guarantees
      // a finite, non-negative string (I5).
      onChange(safeBalance.toFixed(2))
      return
    }

    const seq = ++maxRequestSeq.current
    maxInFlight.current = true
    try {
      setMaxState('loading')
      setMaxErrorReason(null)
      const result = await onMaxRequest()

      if (seq !== maxRequestSeq.current) return

      // Reject anything that is not a usable, finite, non-negative amount before
      // it can reach `onChange` — otherwise `toFixed` would yield "NaN" and
      // `normalizeUSDC` would later erase the field on blur (I1, I5).
      if (typeof result !== 'number' || !Number.isFinite(result) || result < 0) {
        throw new InvalidMaxPayloadError()
      }

      maxInFlight.current = false
      onChange(result.toFixed(2))
      setMaxState('idle')
    } catch (err: unknown) {
      if (seq !== maxRequestSeq.current) return

      const reason = classifyMaxError(err)
      maxInFlight.current = false
      setMaxState(stateForReason(reason))
      setMaxErrorReason(reason)
    }
  }

  const handleMax = () => {
    void executeMax()
  }

  const handlePreset = (preset: number) => {
    supersedePendingMax()
    onChange(preset.toFixed(2))
  }

  const isDisabled = disabled || isLoading
  const isMaxDisabled =
    (!onMaxRequest && safeBalance <= 0) || isDisabled || maxState === 'loading'

  const showMaxError = maxState === 'error' || maxState === 'stale' || maxState === 'permission'
  const maxErrorText = showMaxError ? MAX_ERROR_COPY[maxState as 'error' | 'stale' | 'permission'] : ''

  // Finite, non-negative, unique. Guards against `NaN`/`Infinity` chips writing
  // `"NaN"` into the field and against duplicate React keys (I6).
  const safePresets = presets.reduce<number[]>((acc, preset) => {
    if (typeof preset !== 'number' || !Number.isFinite(preset) || preset < 0) return acc
    if (acc.includes(preset)) return acc
    acc.push(preset)
    return acc
  }, [])

  // Merge any caller-supplied aria-describedby with our internal error id when we own the message.
  const describedBy =
    [ariaDescribedBy, showInlineError ? errorId : undefined, showMaxError ? maxErrorId : undefined].filter(Boolean).join(' ') || undefined

  return (
    <div
      className={`amountInput ${isLoading ? 'amountInput--loading' : ''}`}
      data-invalid={isInvalid ? 'true' : 'false'}
      data-max-state={maxState}
      data-max-error-reason={maxErrorReason ?? undefined}
    >
      <div className="amountInput__row">
        <div className="amountInput__control">
          <input
            {...inputProps}
            className={['amountInput__input', inputProps.className].filter(Boolean).join(' ')}
            // The value is preserved while loading: blanking it destroyed
            // whatever the user had typed. The field is disabled instead (I1).
            value={displayValue}
            inputMode="decimal"
            autoComplete="off"
            disabled={isDisabled}
            aria-busy={isLoading ? 'true' : undefined}
            aria-invalid={isInvalid ? 'true' : undefined}
            aria-describedby={describedBy}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleInputChange}
            placeholder={isLoading ? 'Loading...' : inputProps.placeholder}
          />
          <span className="amountInput__adornment" aria-hidden="true">
            {isLoading ? <span className="amountInput__spinner" /> : currencyLabel}
          </span>
        </div>

        <button
          type="button"
          className="amountInput__maxButton"
          onClick={handleMax}
          disabled={isMaxDisabled}
          aria-busy={maxState === 'loading' ? 'true' : undefined}
          aria-label={`Set max amount (${currencyLabel})`}
        >
          {maxState === 'loading' ? 'Loading...' : 'Max'}
        </button>
      </div>

      <div className="amountInput__presets" aria-label="Quick amount presets">
        {safePresets.map((preset) => {
          const isPresetOverBalance = preset > safeBalance
          const isPresetDisabled = isDisabled || isPresetOverBalance
          return (
            <button
              key={preset}
              type="button"
              className="amountInput__chip"
              onClick={() => handlePreset(preset)}
              disabled={isPresetDisabled}
              aria-label={`Set amount to ${preset} ${currencyLabel}`}
            >
              {preset}
            </button>
          )
        })}
      </div>

      {showInlineError && (
        <span id={errorId} className="amountInput__error" role="alert">
          {activeError}
        </span>
      )}

      {showMaxError && (
        <div id={maxErrorId} className="amountInput__maxErrorBox" role="alert">
          <span className="amountInput__errorText">
            {maxErrorText}
          </span>
          <button
            type="button"
            onClick={handleMax}
            className="amountInput__retryButton"
            aria-label={`Retry getting max amount (${currencyLabel})`}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
