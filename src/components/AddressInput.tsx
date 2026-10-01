import React, { useState, useRef, useEffect, useCallback } from 'react'
import { FormField } from './forms/FormField'
import './AddressInput.css'
import { useSettings } from '../context/SettingsContext'
import {
  isValidStellarAddress as validateStellarAddress,
  sanitizeAddressInput,
  type AddressSanitizationError,
} from '../lib/stellar'

export type FocusState = 'idle' | 'loading' | 'error' | 'stale' | 'permission'

export interface AddressInputProps {
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
  /**
   * Optional focus callback. May be synchronous or return a Promise.
   */
  onFocus?: (event?: React.FocusEvent<HTMLInputElement>) => void | Promise<void>
  /**
   * Optional async request triggered on focus (e.g. address lookup, name resolution,
   * or account authorization). If provided, focus transitions through deterministic
   * loading, error, retry, stale, and permission states without losing user data.
   */
  onFocusRequest?: (address: string) => Promise<string | void>
}

/**
 * Validates Stellar public key format and checksum.
 * Valid addresses: 56 characters, starts with 'G', valid CRC-16 checksum.
 */
export function isValidStellarAddress(address: string): boolean {
  return validateStellarAddress(address)
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
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void
  disabled: boolean
  handlePaste: () => void
  focused: boolean
  showError: boolean
  showSuccess: boolean
  focusState?: FocusState
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
  focusState = 'idle',
}: AddressInputInnerProps) {
  const isLoading = focusState === 'loading'
  return (
    <div
      className={`address-input-container ${focused ? 'address-input-container--focused' : ''} ${showError ? 'address-input-container--error' : ''} ${showSuccess ? 'address-input-container--success' : ''} ${isLoading ? 'address-input-container--loading' : ''}`}
    >
      <input
        ref={inputRef}
        type="text"
        id={id}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-busy={isLoading ? 'true' : undefined}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        disabled={disabled || isLoading}
        placeholder="Enter Stellar address (G...)"
        className="address-input-field"
        spellCheck="false"
        autoComplete="off"
        autoCapitalize="off"
      />
      <button
        type="button"
        onClick={handlePaste}
        disabled={disabled || isLoading}
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
  onFocus,
  onFocusRequest,
}: AddressInputProps) {
  const { addressDisplay } = useSettings()
  const isDisabled = disabled || isLoading

  const inputRef = useRef<HTMLInputElement>(null)

  const [focused, setFocused] = useState(false)
  const [attempted, setAttempted] = useState(false)
  // Tracks whether the last clipboard read failed so we can surface a
  // diagnostic message without losing the user's existing input.
  const [pasteFailed, setPasteFailed] = useState(false)
  const [sanitizationError, setSanitizationError] = useState<AddressSanitizationError | null>(null)

  // Focus deterministic failure-boundary states
  const [focusState, setFocusState] = useState<FocusState>('idle')
  const [focusErrorMsg, setFocusErrorMsg] = useState<string | null>(null)
  const focusRequestSeq = useRef(0)

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
    const rawValue = e.target.value
    const result = sanitizeAddressInput(rawValue)
    const nextVal = result.ok ? result.value : result.fallbackValue
    onChange(nextVal)

    if (!result.ok) {
      setSanitizationError(result.error)
    } else {
      setSanitizationError(null)
    }

    // Mark as attempted if user starts typing
    if (!attempted) {
      setAttempted(true)
    }
    // Any manual edit clears a prior paste failure or focus error without losing data.
    if (pasteFailed) {
      setPasteFailed(false)
    }
    if (focusState !== 'idle') {
      setFocusState('idle')
      setFocusErrorMsg(null)
    }
  }

  const handleBlurEvent = () => {
    setFocused(false)
    setAttempted(true)
    executeBlur(value)
  }

  /**
   * Deterministic failure-boundary handler for focus operations.
   *
   * Invariants enforced:
   * - Does not clobber user data on failure or rejection.
   * - Prevents race conditions using monotonic sequence check so stale
   *   responses from previous requests are discarded.
   * - Correctly classifies errors into loading, error, retry, stale, and permission states.
   * - Concurrency guards prevent duplicate execution while loading.
   */
  const executeFocus = useCallback(
    async (event?: React.FocusEvent<HTMLInputElement>) => {
      if (focusState === 'loading' && focusRequestSeq.current > 0) {
        return
      }

      if (!onFocusRequest && !onFocus) {
        return
      }

      const seq = ++focusRequestSeq.current

      try {
        if (onFocusRequest) {
          setFocusState('loading')
          setFocusErrorMsg(null)
          const result = await onFocusRequest(value)

          // Drop stale results from superseded requests
          if (seq !== focusRequestSeq.current) return

          if (typeof result === 'string') {
            onChange(result)
          }
          setFocusState('idle')
        } else if (onFocus) {
          const ret = onFocus(event)
          if (ret && typeof (ret as Promise<void>).then === 'function') {
            setFocusState('loading')
            setFocusErrorMsg(null)
            await ret
            if (seq !== focusRequestSeq.current) return
            setFocusState('idle')
          }
        }
      } catch (err: unknown) {
        if (seq !== focusRequestSeq.current) return

        const msg = err instanceof Error ? err.message : String(err)
        const lowerMsg = msg.toLowerCase()
        const errorObj = err as { name?: string; code?: string }

        if (
          errorObj?.name === 'PermissionError' ||
          lowerMsg.includes('permission') ||
          lowerMsg.includes('unauthorized') ||
          errorObj?.code === 'PERMISSION_DENIED'
        ) {
          setFocusState('permission')
        } else if (
          errorObj?.name === 'StaleDataError' ||
          lowerMsg.includes('stale') ||
          errorObj?.code === 'STALE_DATA'
        ) {
          setFocusState('stale')
        } else {
          setFocusState('error')
        }
        setFocusErrorMsg(msg)
      }
    },
    [focusState, onFocusRequest, onFocus, value, onChange]
  )

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    void executeFocus(event)
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
      const trimmedText = text.trim()
      onChange(trimmedText)
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

  const isChecksumError = showError && /^G[A-Z0-9]{55}$/.test(value)
  const formatError = showError
    ? isChecksumError
      ? 'Invalid address checksum. Please verify the address.'
      : 'Invalid address. Stellar public keys are 56 characters starting with G.'
    : undefined

  const showFocusError =
    focusState === 'error' || focusState === 'stale' || focusState === 'permission'
  const focusErrorMessage =
    focusState === 'permission'
      ? 'Permission denied focusing address.'
      : focusState === 'stale'
        ? 'Address data is stale.'
        : focusState === 'error'
          ? focusErrorMsg || 'Failed to resolve address on focus.'
          : undefined

  // External error takes precedence; otherwise fall back to sanitization,
  // then format error, then to a non-destructive paste failure message.
  const error =
    externalError ??
    (sanitizationError ? sanitizationError.message : undefined) ??
    formatError ??
    (pasteFailed ? 'Unable to read clipboard. Please paste manually.' : undefined)
  const hint = 'Stellar public key format (56 characters, starts with G)'
  const successMessage = !externalError && showSuccess ? 'Valid Stellar address' : undefined

  return (
    <div className={`address-input-wrapper ${className}`}>
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
          focusState={focusState}
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

      {/* Focus error boundary banner with retry button */}
      {showFocusError && (
        <div id={`${id}-focus-error`} className="address-input-focus-error" role="alert">
          <span className="address-input-focus-error-message">{focusErrorMessage}</span>
          <button
            type="button"
            onClick={() => void executeFocus()}
            className="address-input-retry-button"
            aria-label="Retry focus request"
          >
            Retry
          </button>
        </div>
      )}

      {/* Address echo display when valid and no external error */}
      {showSuccess && !externalError && value && (
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
