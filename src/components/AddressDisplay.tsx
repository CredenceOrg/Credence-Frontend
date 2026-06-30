import { useState } from 'react'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { useToast } from './ToastProvider'
import { truncateAddress } from '../lib/stellar'
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

  const handleCopy = async () => {
    const success = await copy(address)
    if (success) {
      addToast('success', 'Address copied to clipboard')
    }
  }

  const displayAddress = (isHovered || isFocused) ? address : truncateAddress(address)

  return (
    <div className={`address-display ${className}`}>
      <code
        className="address-display__address"
        title={address}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        tabIndex={0}
      >
        {displayAddress}
      </code>
      {showCopyButton && (
        <button
          type="button"
          className="address-display__copy-btn"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy address'}
        >
          {copied ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
