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
  const [maxErrorMsg, setMaxErrorMsg] = useState<string | null>(null)
  
  const maxRequestSeq = useRef(0)

  // Derive over-balance and below-minimum states from the normalized numeric value.
  const numericValue = useMemo(() => {
    const normalized = normalizeUSDC(value)
    if (!normalized) return 0
    return Number(normalized)
  }, [value])

  const isOverBalance = numericValue > 0 && numericValue > balance
  const isBelowMin = min !== undefined && numericValue > 0 && numericValue < min

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
  useEffect(() => {
    onValidityChange?.(!isOverBalance && !isBelowMin)
  }, [isOverBalance, isBelowMin, onValidityChange])

  const displayValue = useMemo(() => {
    if (isFocused) return value
    return formatUSDC(value)
  }, [isFocused, value])

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = (event) => {
    setIsFocused(false)
    const normalized = normalizeUSDC(value)
    if (normalized !== value) onChange(normalized)
    onBlur?.(event)
  }

  const handleFocus: React.FocusEventHandler<HTMLInputElement> = (event) => {
    setIsFocused(true)
    onFocus?.(event)
  }

  const executeMax = async () => {
    if (maxState === 'loading') return

    if (!onMaxRequest) {
      onChange(balance.toFixed(2))
      return
    }

    const seq = ++maxRequestSeq.current
    try {
      setMaxState('loading')
      setMaxErrorMsg(null)
      const result = await onMaxRequest()
      
      if (seq !== maxRequestSeq.current) return
      
      if (typeof result !== 'number' || !Number.isFinite(result) || result < 0) {
        throw new Error('Invalid max amount returned')
      }
      
      onChange(result.toFixed(2))
      setMaxState('idle')
    } catch (err: any) {
      if (seq !== maxRequestSeq.current) return
      
      const msg = err instanceof Error ? err.message : String(err)
      const lowerMsg = msg.toLowerCase()
      
      if (err?.name === 'PermissionError' || lowerMsg.includes('permission') || lowerMsg.includes('unauthorized') || err?.code === 'PERMISSION_DENIED') {
        setMaxState('permission')
      } else if (err?.name === 'StaleDataError' || lowerMsg.includes('stale') || err?.code === 'STALE_DATA') {
        setMaxState('stale')
      } else {
        setMaxState('error')
      }
      setMaxErrorMsg(msg)
    }
  }

  const handleMax = () => {
    executeMax()
  }

  const handlePreset = (preset: number) => {
    onChange(preset.toFixed(2))
  }

  const isDisabled = disabled || isLoading
  const isMaxDisabled = (!onMaxRequest && balance <= 0) || isDisabled || maxState === 'loading'

  const showMaxError = maxState === 'error' || maxState === 'stale' || maxState === 'permission'

  // Merge any caller-supplied aria-describedby with our internal error id when we own the message.
  const describedBy =
    [ariaDescribedBy, showInlineError ? errorId : undefined, showMaxError ? maxErrorId : undefined].filter(Boolean).join(' ') || undefined

  return (
    <div
      className={`amountInput ${isLoading ? 'amountInput--loading' : ''}`}
      data-invalid={isInvalid ? 'true' : 'false'}
    >
      <div className="amountInput__row">
        <div className="amountInput__control">
          <input
            {...inputProps}
            className={['amountInput__input', inputProps.className].filter(Boolean).join(' ')}
            value={isLoading ? '' : displayValue}
            inputMode="decimal"
            autoComplete="off"
            disabled={isDisabled}
            aria-invalid={isInvalid ? 'true' : undefined}
            aria-describedby={describedBy}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={(event) => onChange(sanitizeUSDCInput(event.target.value))}
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
          aria-label={`Set max amount (${currencyLabel})`}
        >
          {maxState === 'loading' ? 'Loading...' : 'Max'}
        </button>
      </div>

      <div className="amountInput__presets" aria-label="Quick amount presets">
        {presets.map((preset) => {
          const isPresetOverBalance = preset > balance
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
          s {activeError}
        </span>
      )}

      {showMaxError && (
        <div id={maxErrorId} className="amountInput__maxErrorBox" role="alert">
          <span className="amountInput__errorText">
            {maxState === 'permission' ? 'Permission denied getting max amount.' :
             maxState === 'stale' ? 'Max amount data is stale.' :
             'Failed to get max amount.'}
          </span>
          <button type="button" onClick={executeMax} className="amountInput__retryButton">
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
