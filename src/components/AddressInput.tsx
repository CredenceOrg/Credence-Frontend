import React, { useState, useRef } from 'react'
import { FormField } from './forms/FormField'
import './AddressInput.css'

export interface AddressInputProps {
  /** Input id forwarded to FormField for label and description wiring. */
  id: string
  /** Visible field label. Defaults to `Stellar Address`. */
  label?: string
  /** Controlled Stellar public key value. */
  value: string
  /** Called with the raw address text whenever the user edits or pastes. */
  onChange: (value: string) => void
  /** Receives the current 56-character Stellar public key validation state. */
  onValidationChange?: (isValid: boolean) => void
  /** Disables both the text input and paste button. */
  disabled?: boolean
  /** Additional class names appended to the wrapper. */
  className?: string
}

/**
 * Validates Stellar public key format.
 * Valid addresses: 56 characters, starts with 'G'
 */
function isValidStellarAddress(address: string): boolean {
  if (!address) return false
  // Stellar addresses are 56 characters and start with 'G'
  return /^G[A-Z0-9]{55}$/.test(address)
}

/**
 * Truncates address for display: shows first 12 and last 8 characters
 */
export function truncateAddress(address: string): string {
  if (address.length <= 20) return address
  return `${address.substring(0, 12)}...${address.substring(address.length - 8)}`
}

/**
 * Internal component to handle prop injection from FormField
 */
interface AddressInputInnerProps {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: 'true' | 'false'
  inputRef: React.RefObject<HTMLInputElement>
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
  onFocus: () => void
  disabled: boolean
  handlePaste: () => void
  focused: boolean
  showError: boolean
  showSuccess: boolean
}

function AddressInputInner({
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  inputRef,
  value,
  onChange,
  onBlur,
  onFocus,
  disabled,
  handlePaste,
  focused,
  showError,
  showSuccess,
}: AddressInputInnerProps) {
  return (
    <div
      className={`address-input-container ${focused ? 'address-input-container--focused' : ''} ${showError ? 'address-input-container--error' : ''} ${showSuccess ? 'address-input-container--success' : ''}`}
    >
      <input
        ref={inputRef}
        type="text"
        id={id}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        disabled={disabled}
        placeholder="Enter Stellar address (G...)"
        className="address-input-field"
        spellCheck="false"
        autoComplete="off"
        autoCapitalize="off"
      />

      <button
        type="button"
        onClick={handlePaste}
        disabled={disabled}
        className="address-input-paste-button"
        aria-label="Paste address from clipboard"
        title="Paste address from clipboard"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M10.5 1H5.5C4.67157 1 4 1.67157 4 2.5V3H2.5C1.67157 3 1 3.67157 1 4.5V13.5C1 14.3284 1.67157 15 2.5 15H10.5C11.3284 15 12 14.3284 12 13.5V12H13.5C14.3284 12 15 11.3284 15 10.5V2.5C15 1.67157 14.3284 1 13.5 1H10.5Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}

export default function AddressInput({
  id,
  label = 'Stellar Address',
  value,
  onChange,
  onValidationChange,
  disabled = false,
  className = '',
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [attempted, setAttempted] = useState(false)

  const isValid = isValidStellarAddress(value)
  const isEmpty = !value
  const showError = attempted && !isValid && !isEmpty
  const showSuccess = attempted && isValid

  // Notify parent of validation state change
  React.useEffect(() => {
    onValidationChange?.(isValid)
  }, [isValid, onValidationChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    // Mark as attempted if user starts typing
    if (!attempted) {
      setAttempted(true)
    }
  }

  const handleBlur = () => {
    setFocused(false)
    setAttempted(true)
  }

  const handleFocus = () => {
    setFocused(true)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const trimmedText = text.trim()
      onChange(trimmedText)
      setAttempted(true)

      // Focus the input after paste
      if (inputRef.current) {
        inputRef.current.focus()
      }
    } catch {
      // Clipboard API not available or permission denied
      // Fallback: focus input for manual paste
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  const error = showError ? 'Invalid address. Stellar public keys are 56 characters starting with G.' : undefined
  const hint = 'Stellar public key format (56 characters, starts with G)'

  return (
    <div className={`address-input-wrapper ${className}`}>
      <FormField id={id} label={label} hint={hint} error={error}>
        <AddressInputInner
          inputRef={inputRef}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          disabled={disabled}
          handlePaste={handlePaste}
          focused={focused}
          showError={showError}
          showSuccess={showSuccess}
        />
      </FormField>

      {/* Address echo display when valid */}
      {showSuccess && value && (
        <div className="address-input-echo">
          <span className="address-input-echo-label">Recognized:</span>
          <code className="address-input-echo-value">{truncateAddress(value)}</code>
        </div>
      )}

      {/* Character count hint */}
      {value && (
        <div className="address-input-count">
          {value.length} / 56 characters
        </div>
      )}
    </div>
  )
}
