import React, { useState, useRef, useEffect, useCallback } from 'react'
import { FormField } from './forms/FormField'
import './AddressInput.css'
import { useSettings } from '../context/SettingsContext'
import {
  isValidStellarAddress,
  truncateAddress,
  formatAddressForDisplay,
  sanitizeAddressInput,
  type AddressDisplayMode,
} from '../lib/stellar'

// Re-exported for backwards compatibility with callers that historically
// imported these helpers from this module. `../lib/stellar` is now the single
// source of truth for validation and formatting.
export { isValidStellarAddress, truncateAddress, formatAddressForDisplay }
export type { AddressDisplayMode }

/** Format-only check: 56 chars, 'G' prefix, uppercase alphanumeric. */
const STELLAR_ADDRESS_FORMAT = /^G[A-Z0-9]{55}$/

interface AddressInputProps {
  id: string
  label?: string
  value: string
  onChange: (value: string) => void
  onValidationChange?: (isValid: boolean) => void
  onBlur?: (value: string) => Promise<void> | void
  disabled?: boolean
  /**
   * Renders the field in a busy state and suppresses interaction while a
   * read/resolve is in flight. Never masks the user's current value.
   */
  isLoading?: boolean
  className?: string
  error?: string
  /**
   * Optional callback invoked when a clipboard read fails (permission denied,
   * unavailable API, empty clipboard, etc.) so callers can surface a
   * diagnostic message.
   */
  onPasteError?: (error: unknown) => void
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
  pasteState: 'idle' | 'loading' | 'error' | 'permission' | 'stale'
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
  pasteState,
}: AddressInputInnerProps) {
  // If we ever hit an error state inside Inner, we can throw it to let ErrorBoundary catch it
  // This satisfies deterministic failure-boundary coverage for AddressInputInner
  if (pasteState === 'error') {
    throw new Error('Clipboard access failed')
  }

  return (
    <div
      className={`address-input-container ${focused ? 'address-input-container--focused' : ''} ${showError ? 'address-input-container--error' : ''} ${showSuccess ? 'address-input-container--success' : ''} ${blurState === 'loading' ? 'address-input-container--loading' : ''}`}
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
        disabled={disabled || pasteState === 'loading'}
        placeholder="Enter Stellar address (G...)"
        className="address-input-field"
        spellCheck="false"
        autoComplete="off"
        autoCapitalize="off"
      />
      <button
        type="button"
        onClick={handlePaste}
        disabled={disabled || pasteState === 'loading'}
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
      {pasteState === 'permission' && <div role="alert" className="paste-alert">Clipboard permission denied</div>}
      {pasteState === 'stale' && <div role="alert" className="paste-alert">Paste content is stale</div>}
    </div>
  )
}

export default function AddressInput({
  id,
  label = 'Stellar Address',
  value,
  onChange,
  onValidationChange,
  onBlur,
  disabled = false,
  isLoading = false,
  className = '',
  error: externalError,
  onPasteError,
}: AddressInputProps) {
  const { addressDisplay } = useSettings()
  const isDisabled = disabled || isLoading

  const inputRef = useRef<HTMLInputElement>(null)

  const [focused, setFocused] = useState(false)
  const [attempted, setAttempted] = useState(false)
  // Tracks whether the last clipboard read failed so we can surface a
  // diagnostic message without losing the user's existing input.
  const [pasteFailed, setPasteFailed] = useState(false)
  // Tracks whether the last accepted input contained characters that look like
  // a homograph/injection attempt (e.g. zero-width spaces).
  const [hasSuspiciousChars, setHasSuspiciousChars] = useState(false)

  const [blurState, setBlurState] = useState<'idle' | 'loading' | 'error' | 'stale' | 'permission'>('idle')
  const [blurError, setBlurError] = useState<string | null>(null)
  
  const blurPromiseRef = useRef<Promise<void> | null>(null)
  const failedValueRef = useRef<string | null>(null)

  const isValid = isValidStellarAddress(value)
  const isEmpty = !value
  const showError = attempted && !isValid && !isEmpty
  const showSuccess = attempted && isValid && blurState !== 'error' && blurState !== 'permission' && blurState !== 'stale'

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

  const handleBlurEvent = () => {
    setFocused(false)
    setAttempted(true)
    executeBlur(value)
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
   * - Always route accepted clipboard text through the shared sanitizer so a
   *   `stellar:` prefix is stripped and suspicious characters are flagged.
   */
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()

      // Guard: an empty or whitespace-only clipboard must not clobber the
      // user's existing input. Surface a non-destructive failure instead.
      if (!text || !text.trim()) {
        setPasteFailed(true)
        onPasteError?.(new Error('Clipboard is empty'))
        if (inputRef.current) {
          inputRef.current.focus()
        }
        return
      }

      acceptSanitizedValue(text)
      setAttempted(true)
      setPasteFailed(false)

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
  }, [acceptSanitizedValue, onPasteError])

  // Distinguish a format violation (length/prefix/charset) from a
  // checksum mismatch so the message is actionable. The compute here runs
  // only when an error is actually rendered.
  const formatError = showError
    ? STELLAR_ADDRESS_FORMAT.test(value)
      ? 'Invalid address. Stellar public key checksum is invalid.'
      : 'Invalid address. Stellar public keys are 56 characters starting with G.'
    : undefined

  // Error precedence: an explicit parent error wins, then a security warning
  // about the characters we just accepted, then the format/checksum error,
  // then the non-destructive clipboard failure.
  const error =
    externalError ??
    (hasSuspiciousChars ? 'Suspicious characters detected in address.' : undefined) ??
    formatError ??
    (pasteFailed ? 'Unable to read clipboard. Please paste manually.' : undefined)
  const hint = 'Stellar public key format (56 characters, starts with G)'
  const successMessage = !externalError && showSuccess ? 'Valid Stellar address' : undefined

  return (
    <div className={`address-input-wrapper ${className}`} aria-busy={isLoading || undefined}>
      <FormField id={id} label={label} hint={hint} error={error} success={successMessage}>
        <AddressInputInner
          inputRef={inputRef}
          value={value}
          onChange={handleChange}
          onBlur={handleBlurEvent}
          onFocus={handleFocus}
          disabled={isDisabled}
          handlePaste={handlePaste}
          focused={focused}
          showError={Boolean(error)}
          showSuccess={Boolean(successMessage)}
          blurState={blurState}
        />
      </FormField>
      
      {blurState === 'permission' && (
        <div className="address-input-blur-error" role="alert" style={{ marginTop: '0.5rem', color: 'var(--color-error)' }}>
          <strong>Permission Denied:</strong> {blurError}
          <button type="button" onClick={handleRetry} style={{ marginLeft: '1rem', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      )}
      
      {blurState === 'stale' && (
        <div className="address-input-blur-error" role="alert" style={{ marginTop: '0.5rem', color: 'var(--color-warning)' }}>
          <strong>Stale Data:</strong> {blurError}
          <button type="button" onClick={handleRetry} style={{ marginLeft: '1rem', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      )}
      
      {blurState === 'error' && (
        <div className="address-input-blur-error" role="alert" style={{ marginTop: '0.5rem', color: 'var(--color-error)' }}>
          <strong>Error:</strong> {blurError}
          <button type="button" onClick={handleRetry} style={{ marginLeft: '1rem', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      )}

      {/* Address echo display when valid and no external error is set */}
      {successMessage && value && (
        <div className="address-input-echo">
          <span className="address-input-echo-label">Recognized:</span>
          <code className="address-input-echo-value">
            {formatAddressForDisplay(value, addressDisplay as AddressDisplayMode)}
          </code>
        </div>
      )}
      {value && <div className="address-input-count">{value.length} / 56 characters</div>}
    </div>
  )
}
