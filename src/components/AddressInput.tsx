import React, { useState, useRef, useEffect, useCallback } from 'react'
import { FormField } from './forms/FormField'
import './AddressInput.css'
import { useSettings } from '../context/SettingsContext'

interface AddressInputProps {
  id: string
  label?: string
  value: string
  onChange: (value: string) => void
  onValidationChange?: (isValid: boolean) => void
  disabled?: boolean
  className?: string
  /**
   * External validation message (e.g. required-on-submit).
   * Takes precedence over the built-in format error when provided.
   */
  error?: string
  /**
   * Optional callback invoked when a clipboard read fails (permission denied,
   * unavailable API, etc.) so callers can surface a diagnostic message.
   */
  onPasteError?: (error: unknown) => void
}

/**
 * Validates Stellar public key format.
 * Valid addresses: 56 characters, starts with 'G'
 */
export function isValidStellarAddress(address: string): boolean {
  if (!address) return false
  // Stellar addresses are 56 characters and start with 'G'
  return /^G[A-Z0-9]{55}$/.test(address)
}

/**
 * Truncates address for display: shows first 12 and last 8 characters.
 */
export function truncateAddress(address: string): string {
  if (address.length <= 20) return address
  return `${address.substring(0, 12)}...${address.substring(address.length - 8)}`
}

export type AddressDisplayMode = 'full' | 'short' | 'friendly'

/**
 * Formats an address for UI display based on the user's addressDisplay setting.
 *
 * Notes:
 * - `friendly` name resolution is not available yet. It falls back to `short`.
 * - This helper is intentionally pure and safe to call during render.
 */
export function formatAddressForDisplay(address: string, mode: AddressDisplayMode): string {
  switch (mode) {
    case 'full':
      return address
    case 'friendly':
      // TODO: Resolve friendly names when available on-chain.
      return truncateAddress(address)
    case 'short':
    default:
      return truncateAddress(address)
  }
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
      className={`address-input-container ${focused ? 'address-input-container--focused' : ''} ${showError ? 'address-input-container--error' : ''} ${showSuccess ? 'address-input-container--success' : ''}`
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
            d="M10.5 9H5.5C4.67157 9 4 9.67157 4 10.5V11.5C4 12.3284 4.67157 13 5.5 13H10.5C11.3284 13 12 12.3284 12 11.5V10.5C12 9.67157 11.3284 9 10.5 9Z"
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
  error: externalError,
  onPasteError,
}: AddressInputProps) {
  const { addressDisplay } = useSettings()

  const inputRef = useRef<HTMLInputElement>(null)

  const [focused, setFocused] = useState(false)
  const [attempted, setAttempted] = useState(false)
  // Tracks whether the last clipboard read failed so we can surface a
  // diagnostic message without losing the user's existing input.
  const [pasteFailed, setPasteFailed] = useState(false)

  const isValid = isValidStellarAddress(value)
  const isEmpty = !value
  const showError = attempted && !isValid && !isEmpty
  const showSuccess = attempted && isValid

  // Notify parent of validation state change. We key on the boolean
  // result and the callback identity so consumers can pass an inline
  // function without triggering an infinite render loop.
  useEffect(() => {
    onValidationChange?.(isValid)
  }, [isValid, onValidationChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    // Mark as attempted if user starts typing
    if (!attempted) {
      setAttempted(true)
    }
    // Any manual edit clears a prior paste failure.
    if (pasteFailed) {
      setPasteFailed(false)
    }
  }

  const handleBlur = () => {
    setFocused(false)
    setAttempted(true)
  }

  const handleFocus = () => {
    setFocused(true)
  }

  /**
   * Paste handler.
   *
   * Invariants:
   * - Never overwrite the existing value with an empty clipboard result.
   * - Never clear or corrupt the existing value on failure.
   * - On failure, focus the input so the user can manually paste.
   */
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      const trimmedText = text.trim()

      // Guard: if clipboard is empty or whitespace-only, do not
      // clbler the user's existing input. Surface a non-destructive
      // failure instead.
      if (!trimmedText) {
        setPasteFailed(true)
        onPasteError?.(new Error('Clipboard is empty'))
        if (inputRef.current) {
          inputRef.current.focus()
        }
        return
      }

      onChange(trimmedText)
      setAttempted(true)
      setPasteFailed(false)

      // Focus the input after paste
      if (inputRef.current) {
        inputRef.current.focus()
      }
    } catch (err) {
      // Clipboard API not available or permission denied.
      // Fallback: focus input for manual paste and surface a diagnostic
      // without exposing clipboard contents.
      setPasteFailed(true)
      onPasteError?.(err)
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }, [onChange, onPasteError])

  const formatError = showError
    ? 'Invalid address. Stellar public keys are 56 characters starting with G.'
    : undefined
  // External error takes precedence; otherwise fall back to the format
  // error, then to a non-destructive paste failure message.
  const error = externalError ?? formatError ?? (pasteFailed ? 'Unable to read clipboard. Please paste manually.' : undefined)
  const hint = 'Stellar public key format (56 characters, starts with G)'
  // Visual + FormField success only when format is valid and no external error.
  const successMessage = !externalError && showSuccess ? 'Valid Stellar address' : undefined

  return (
    <div className={`address-input-wrapper ${className}`}>
      <FormField
        id={id}
        label={label}
        hint={hint}
        error={error}
        success={successMessage}
      >
        <AddressInputInner
          inputRef={inputRef}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          disabled={disabled}
          handlePaste={handlePaste}
          focused={focused}
          showError={Boolean(error)}
          showSuccess={Boolean(successMessage)}
        />
      </FormField>

      {/* Address echo display when valid */}
      {showSuccess && value && (
        <div className="address-input-echo">
          <span className="address-input-echo-label">Recognized:</span>
          <code className="address-input-echo-value">
            {formatAddressForDisplay(value, addressDisplay as AddressDisplayMode)}
          </code>
        </div>
      )}

      {/* Character count hint */}
      {value && <div className="address-input-count">{value.length} / 56 characters</div>}
    </div>
  )
}
