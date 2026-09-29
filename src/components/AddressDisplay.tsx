import { useState } from 'react'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { useToast } from './ToastProvider'
import { truncateAddress } from '../lib/stellar'
import TooltipOnOverflow from './TooltipOnOverflow'
import './AddressDisplay.css'

export interface AddressDisplayProps {
  address: string
  className?: string
  showCopyButton?: boolean
}

export default function AddressDisplay({
  address,
  className = '',
  showCopyButton = true,
}: AddressDisplayProps) {
  const { copy, copied } = useCopyToClipboard()
  const { addToast } = useToast()
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  // Guard flag: prevents a second in-flight copy from racing the first.
  const [copying, setCopying] = useState(false)

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
  const displayText = showFull ? address : truncateAddress(address)

  return (
    <div className={`address-display ${className}`}>
      <TooltipOnOverflow content={address} forceShow>
        <code
          className="address-display__address"
          tabIndex={0}
          title={address}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        >
          {displayText}
        </code>
      </TooltipOnOverflow>
      {showCopyButton && (
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
