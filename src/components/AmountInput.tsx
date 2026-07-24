import { useEffect, useId, useMemo, useState } from 'react'
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
   * Called whenever the internal validity state changes.
   * `isValid` is `false` when the entered amount exceeds balance; `true` otherwise.
   * Callers can use this to gate form submission without duplicating the comparison.
   */
  onValidityChange?: (isValid: boolean) => void
  /** Loading state - shows skeleton/spinner and disables interaction */
  isLoading?: boolean
  /** Minimum allowed amount */
  min?: number
}

export default function AmountInput({
  value,
  onChange,
  balance,
  presets = [100, 500, 1000],
  currencyLabel = 'USDC',
  error,
  isLoading = false,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  onBlur,
  onFocus,
  onValidityChange,
  disabled,
  min,
  ...inputProps
}: AmountInputProps) {
  const uid = useId()
  const errorId = `${uid}-error`

  const [isFocused, setIsFocused] = useState(false)

  // Derive over-balance and below-minimum states from the normalized numeric value.
  const numericValue = useMemo(() => {
    const normalized = normalizeUSDC(value)
    if (!normalized) return 0
    return Number(normalized)
  }, [value])

  const isOverBalance = numericValue > 0 && numericValue > balance
  const isBelowMin =
    min !== undefined && numericValue > 0 && numericValue < min

  // Explicit `error` prop always wins; over-balance takes precedence over below-minimum.
  const activeError =
    error ??
    (isOverBalance
      ? 'Amount exceeds available balance.'
      : isBelowMin
        ? `Amount must be at least ${min} ${currencyLabel}.`
        : undefined)

  const isInvalid = Boolean(activeError) || ariaInvalid === 'true'

  // Notify caller when internal validity changes.
  useEffect(() => {
    onValidityChange?.(!isOverBalance)
  }, [isOverBalance, onValidityChange])

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

  const handleMax = () => {
    onChange(balance.toFixed(2))
  }

  const handlePreset = (preset: number) => {
    onChange(preset.toFixed(2))
  }

  const isDisabled = disabled || isLoading
  const isMaxDisabled = balance <= 0 || isDisabled

  // Merge any caller-supplied aria-describedby with our internal error id.
  const describedBy =
    [ariaDescribedBy, activeError ? errorId : undefined].filter(Boolean).join(' ') || undefined

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
            {isLoading ? (
              <span className="amountInput__spinner" />
            ) : (
              currencyLabel
            )}
          </span>
        </div>

        <button
          type="button"
          className="amountInput__maxButton"
          onClick={handleMax}
          disabled={isMaxDisabled}
          aria-label={`Set max amount (${currencyLabel})`}
        >
          Max
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

      {activeError && (
        <span id={errorId} className="amountInput__error" role="alert">
          ⚠ {activeError}
        </span>
      )}
    </div>
  )
}
