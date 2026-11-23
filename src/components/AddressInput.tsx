import React, { useState, useRef, useEffect, useMemo } from 'react'
import { FormField } from './forms/FormField'
import './AddressInput.css'
import { useSettings } from '../context/SettingsContext'
import { useAddressBook } from '../hooks/useAddressBook'
import {
  isValidStellarAddress,
  truncateAddress,
  formatAddressForDisplay,
  sanitizeAddressInput,
  type AddressDisplayMode,
} from '../lib/stellar'

export { truncateAddress, formatAddressForDisplay, type AddressDisplayMode }

interface AddressInputProps {
  id: string
  label?: string
  value: string
  onChange: (value: string) => void
  onValidationChange?: (isValid: boolean) => void
  disabled?: boolean
  /**
   * Renders the field in a busy state and suppresses interaction while a
   * read/resolve is in flight. Never masks the user's current value.
   */
  isLoading?: boolean
  className?: string
  /**
   * External validation message (e.g. required-on-submit).
   * Takes precedence over the built-in format error when provided.
   */
  error?: string
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
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
  onBlur: () => void
  onFocus: () => void
  disabled: boolean
  handlePaste: () => void
  focused: boolean
  showError: boolean
  showSuccess: boolean
  hasAddressBook: boolean
  pickerOpen: boolean
  listboxId: string
  toggleButtonRef: React.RefObject<HTMLButtonElement>
  onTogglePicker: () => void
}

function AddressInputInner({
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  inputRef,
  value,
  onChange,
  onPaste,
  onBlur,
  onFocus,
  disabled,
  handlePaste,
  focused,
  showError,
  showSuccess,
  hasAddressBook,
  pickerOpen,
  listboxId,
  toggleButtonRef,
  onTogglePicker,
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
        onPaste={onPaste}
        onBlur={onBlur}
        onFocus={onFocus}
        disabled={disabled}
        placeholder="Enter Stellar address (G...)"
        className="address-input-field"
        spellCheck="false"
        autoComplete="off"
        autoCapitalize="off"
      />

      {hasAddressBook && (
        <button
          ref={toggleButtonRef}
          type="button"
          onClick={onTogglePicker}
          disabled={disabled}
          className="address-input-book-button"
          aria-label="Choose from address book"
          title="Choose from address book"
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          aria-controls={listboxId}
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
              d="M3 2.5C3 1.94772 3.44772 1.5 4 1.5H12.5C13.0523 1.5 13.5 1.94772 13.5 2.5V13.5C13.5 14.0523 13.0523 14.5 12.5 14.5H4C3.44772 14.5 3 14.0523 3 13.5V2.5Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5.5 5H11M5.5 8H11M5.5 11H9"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}

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
  isLoading = false,
  className = '',
  error: externalError,
  onPasteError,
}: AddressInputProps) {
  const { addressDisplay } = useSettings()
  const { entries: addressBookEntries } = useAddressBook()

  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  const comboboxInputRef = useRef<HTMLInputElement>(null)

  const [focused, setFocused] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [sanitizationError, setSanitizationError] = useState<string | undefined>(undefined)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const hasAddressBook = addressBookEntries.length > 0
  const listboxId = `${id}-address-book-listbox`

  const filteredEntries = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return addressBookEntries
    return addressBookEntries.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) || entry.address.toLowerCase().includes(q)
    )
  }, [addressBookEntries, filterQuery])

  // Keep activeIndex within bounds when filter changes
  useEffect(() => {
    if (activeIndex >= filteredEntries.length) {
      setActiveIndex(0)
    }
  }, [filteredEntries.length, activeIndex])

  // Focus combobox input when picker opens
  useEffect(() => {
    if (pickerOpen) {
      comboboxInputRef.current?.focus()
    }
  }, [pickerOpen])

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    const handleOutsideClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [pickerOpen])

  const isValid = isValidStellarAddress(value)
  const isEmpty = !value
  const looksLikeFormatValid = /^G[A-Z0-9]{55}$/.test(value)
  const showError = attempted && !isValid && !isEmpty
  const showSuccess = attempted && isValid && !sanitizationError

  // Notify parent of validation state change
  useEffect(() => {
    onValidationChange?.(isValid)
  }, [isValid, onValidationChange])

  const applySanitizedValue = (raw: string) => {
    const sanitized = sanitizeAddressInput(raw)
    if (sanitized.ok) {
      setSanitizationError(undefined)
      onChange(sanitized.value)
    } else {
      setSanitizationError(sanitized.error.message)
      onChange(sanitized.fallbackValue)
    }
    setAttempted(true)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSanitizationError(undefined)
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

  const handleNativePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData?.getData('text')
    if (typeof pasted === 'string' && pasted.length > 0) {
      e.preventDefault()
      applySanitizedValue(pasted)
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
   * - Always route accepted clipboard text through the shared sanitizer so a
   *   `stellar:` prefix is stripped and suspicious characters are flagged.
   */
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      applySanitizedValue(text)

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
  }, [acceptSanitizedValue, onPasteError])

  const handleSelectEntry = (address: string) => {
    setSanitizationError(undefined)
    onChange(address)
    setAttempted(true)
    setPickerOpen(false)
    setFilterQuery('')
    inputRef.current?.focus()
  }

  const handleTogglePicker = () => {
    setPickerOpen((prev) => {
      const next = !prev
      if (next) {
        setFilterQuery('')
        setActiveIndex(0)
      }
      return next
    })
  }

  const handleComboboxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setPickerOpen(false)
      toggleButtonRef.current?.focus()
      return
    }

    if (filteredEntries.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % filteredEntries.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + filteredEntries.length) % filteredEntries.length)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIndex(filteredEntries.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filteredEntries[activeIndex]
      if (selected) {
        handleSelectEntry(selected.address)
      }
    }
  }

  const formatError = showError
    ? looksLikeFormatValid
      ? 'Invalid address checksum. Please double-check the Stellar public key.'
      : 'Invalid address. Stellar public keys are 56 characters starting with G.'
    : undefined
  const error = externalError ?? sanitizationError ?? formatError
  const hint = 'Stellar public key format (56 characters, starts with G)'
  // Visual + FormField success only when format is valid and no external/sanitization error.
  const successMessage = !error && showSuccess ? 'Valid Stellar address' : undefined

  const activeOptionId =
    pickerOpen && filteredEntries[activeIndex]
      ? `${id}-address-book-option-${filteredEntries[activeIndex].id}`
      : undefined

  return (
    <div ref={wrapperRef} className={`address-input-wrapper ${className}`}>
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
          onPaste={handleNativePaste}
          onBlur={handleBlur}
          onFocus={handleFocus}
          disabled={isDisabled}
          handlePaste={handlePaste}
          focused={focused}
          showError={Boolean(error)}
          showSuccess={Boolean(successMessage)}
          hasAddressBook={hasAddressBook}
          pickerOpen={pickerOpen}
          listboxId={listboxId}
          toggleButtonRef={toggleButtonRef}
          onTogglePicker={handleTogglePicker}
        />
      </FormField>

      {hasAddressBook && pickerOpen && (
        <div className="address-input-book-popover">
          <input
            ref={comboboxInputRef}
            type="text"
            role="combobox"
            aria-label="Filter address book"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            value={filterQuery}
            onChange={(e) => {
              setFilterQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleComboboxKeyDown}
            placeholder="Filter saved addresses..."
            className="address-input-book-filter"
          />
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Address book entries"
            className="address-input-book-list"
          >
            {filteredEntries.length === 0 ? (
              <li className="address-input-book-empty" role="presentation">
                No matching addresses
              </li>
            ) : (
              filteredEntries.map((entry, idx) => {
                const isActive = idx === activeIndex
                return (
                  <li
                    key={entry.id}
                    id={`${id}-address-book-option-${entry.id}`}
                    role="option"
                    aria-selected={isActive}
                    className={`address-input-book-option ${isActive ? 'address-input-book-option--active' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelectEntry(entry.address)}
                  >
                    <span className="address-input-book-option-label">{entry.label}</span>
                    <code className="address-input-book-option-address">
                      {formatAddressForDisplay(entry.address, addressDisplay as AddressDisplayMode)}
                    </code>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}

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
