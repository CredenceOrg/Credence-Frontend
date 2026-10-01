import { useState } from 'react'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { useToast } from './ToastProvider'
import { truncateAddress } from '../lib/stellar'
import TooltipOnOverflow from './TooltipOnOverflow'
import './AddressDisplay.css'

export interface AddressDisplayProps {
  address?: string | null
  className?: string
  showCopyButton?: boolean
  isLoading?: boolean
  error?: Error | string | null
  onRetry?: () => void
  isStale?: boolean
  hasPermission?: boolean
}

export default function AddressDisplay({
  address,
  className = '',
  showCopyButton = true,
  isLoading = false,
  error = null,
  onRetry,
  isStale = false,
  hasPermission = true,
}: AddressDisplayProps) {
  const { copy, copied } = useCopyToClipboard()
  const { addToast } = useToast()
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  // Guard flag: prevents a second in-flight copy from racing the first.
  const [copying, setCopying] = useState(false)

  if (error) {
    const errorMessage = typeof error === 'string' ? error : error.message
    return (
      <div className={`address-display address-display--error ${className}`}>
        <span className="address-display__error-msg">Error: {errorMessage}</span>
        {onRetry && (
          <button type="button" className="address-display__retry-btn" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`address-display address-display--loading ${className}`} aria-busy="true">
        <span className="address-display__address">Loading...</span>
      </div>
    )
  }

  if (!hasPermission) {
    return (
      <div className={`address-display address-display--no-permission ${className}`}>
        <span className="address-display__address" title="Address hidden">
          ••••••••••••••••••••••••••••••••••••••••
        </span>
      </div>
    )
  }

  const safeAddress = address || ''

  const handleCopy = async () => {
    // Silently ignore clicks on an empty or whitespace-only address — nothing meaningful to copy.
    if (!address.trim()) return
    // Debounce: reject concurrent invocations while a copy is already in flight.
    if (copying) return

    setCopying(true)
    try {
      const success = await copy(address)
      if (success) {
        addToast('success', 'Address copied to clipboard')
      } else {
        // copy() returned false: clipboard unavailable or permission denied.
        // Warn the user so they can copy manually — do not silently swallow the failure.
        addToast('warning', 'Could not copy address — please copy it manually')
      }
    } catch (err: unknown) {
      // Distinguish permission errors (DOMException NotAllowedError) from
      // unexpected failures so the user gets an actionable message in both cases.
      const isPermissionError =
        err instanceof DOMException && err.name === 'NotAllowedError'
      if (isPermissionError) {
        addToast('danger', 'Clipboard access was denied — check your browser permissions')
      } else {
        addToast('danger', 'Failed to copy address')
      }
    } finally {
      setCopying(false)
    }
  }

  const showFull = isHovered || isFocused
  const displayText = showFull ? safeAddress : truncateAddress(safeAddress)

  return (
    <div className={`address-display ${isStale ? 'address-display--stale' : ''} ${className}`}>
      <TooltipOnOverflow content={safeAddress} forceShow>
        <code
          className="address-display__address"
          tabIndex={0}
          title={safeAddress}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        >
          {displayText}
        </code>
      </TooltipOnOverflow>
      {showCopyButton && safeAddress && (
        <button
          type="button"
          className="address-display__copy-btn"
          onClick={handleCopy}
          disabled={copying}
          aria-label={copied ? 'Copied' : 'Copy address'}
          aria-busy={copying}
        >
          {copied ? (
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
