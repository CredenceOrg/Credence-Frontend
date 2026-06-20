import { useMemo, useState } from 'react'
import './AmountInput.css'

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'inputMode'
>

export interface AmountInputProps extends NativeInputProps {
  /** Controlled decimal amount string. */
  value: string
  /** Called with sanitized input while editing and normalized input on blur. */
  onChange: (value: string) => void
  /** Available balance used by the Max button and preset disabled states. */
  balance: number
  /** Quick-select amounts rendered below the input. */
  presets?: number[]
  /** Currency label shown as the input adornment and in button labels. */
  currencyLabel?: string
  /** Optional validation message that marks the amount control invalid. */
  error?: string
}

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function normalizeUSDC(rawValue: string) {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/,/g, '')
  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue)) return ''

  const clamped = Math.max(0, numericValue)
  return clamped.toFixed(2)
}

export function formatUSDC(rawValue: string) {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/,/g, '')
  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue)) return rawValue

  return numberFormatter.format(numericValue)
}

export function sanitizeUSDCInput(nextValue: string) {
  const cleaned = nextValue.replace(/[^\d.]/g, '')
  const [whole = '', fraction = ''] = cleaned.split('.')
  const trimmedWhole = whole.replace(/^0+(?=\d)/, '')
  const trimmedFraction = fraction.slice(0, 2)

  if (cleaned.includes('.')) return `${trimmedWhole || '0'}.${trimmedFraction}`
  return trimmedWhole
}

export default function AmountInput({
  value,
  onChange,
  balance,
  presets = [100, 500, 1000],
  currencyLabel = 'USDC',
  error,
  'aria-invalid': ariaInvalid,
  onBlur,
  onFocus,
  ...inputProps
}: AmountInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const isInvalid = Boolean(error) || ariaInvalid === 'true'

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

  const maxDisabled = balance <= 0

  return (
    <div className="amountInput" data-invalid={isInvalid ? 'true' : 'false'}>
      <div className="amountInput__row">
        <div className="amountInput__control">
          <input
            {...inputProps}
            className={['amountInput__input', inputProps.className].filter(Boolean).join(' ')}
            value={displayValue}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={isInvalid ? 'true' : undefined}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={(event) => onChange(sanitizeUSDCInput(event.target.value))}
          />
          <span className="amountInput__adornment" aria-hidden="true">
            {currencyLabel}
          </span>
        </div>

        <button
          type="button"
          className="amountInput__maxButton"
          onClick={handleMax}
          disabled={maxDisabled}
          aria-label={`Set max amount (${currencyLabel})`}
        >
          Max
        </button>
      </div>

      <div className="amountInput__presets" aria-label="Quick amount presets">
        {presets.map((preset) => {
          const disabled = preset > balance
          return (
            <button
              key={preset}
              type="button"
              className="amountInput__chip"
              onClick={() => handlePreset(preset)}
              disabled={disabled}
              aria-label={`Set amount to ${preset} ${currencyLabel}`}
            >
              {preset}
            </button>
          )
        })}
      </div>
    </div>
  )
}
