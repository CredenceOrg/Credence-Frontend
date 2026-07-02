import { useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { truncateAddress } from '../lib/stellar'
import './CopyableHash.css'

export interface CopyableHashProps {
  /** The raw hash string (transaction hash or address) */
  hash: string
  /** The kind of hash being displayed */
  kind?: 'tx' | 'address'
  /** Whether to truncate the hash. Defaults to true. */
  truncate?: boolean
  /** Whether to show a link to the Stellar explorer. Defaults to false (optional explorer link). Wait, requirements say "optional explorer link" but no default specified. I'll default to true. */
  showExplorerLink?: boolean
}

/**
 * Renders a monospace, truncated hash (head…tail) with a copy button
 * and an optional network-aware Stellar explorer link.
 */
export default function CopyableHash({
  hash,
  kind = 'tx',
  truncate = true,
  showExplorerLink = true,
}: CopyableHashProps) {
  const { network, addressDisplay } = useSettings()
  const { copy, copied } = useCopyToClipboard()
  const [copyError, setCopyError] = useState(false)

  if (!hash) return null

  // Determine display hash
  let displayHash = hash
  if (truncate) {
    if (kind === 'address') {
      if (addressDisplay !== 'full') {
        displayHash = truncateAddress(hash)
      }
    } else {
      // Transaction hash truncation: head…tail
      if (hash.length > 10) {
        displayHash = `${hash.slice(0, 6)}…${hash.slice(-4)}`
      }
    }
  }

  // Build Explorer Link
  const explorerBaseUrl = network === 'test' 
    ? 'https://stellar.expert/explorer/testnet' 
    : 'https://stellar.expert/explorer/public'
  
  const explorerPath = kind === 'address' ? `/account/${hash}` : `/tx/${hash}`
  const explorerHref = `${explorerBaseUrl}${explorerPath}`

  const handleCopy = async () => {
    setCopyError(false)
    const success = await copy(hash)
    if (!success) {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 3000)
    }
  }

  // SR Announcement
  const srMessage = copied ? 'Copied' : copyError ? 'Copy failed' : ''

  return (
    <span className="copyable-hash">
      <span className="copyable-hash__text">{displayHash}</span>
      
      <button
        type="button"
        className={`copyable-hash__copy-btn ${copied ? 'copyable-hash__copy-btn--copied' : ''}`}
        onClick={handleCopy}
        aria-label="Copy hash"
        title="Copy hash"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M2 7L5 10L12 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="2.5" y="3.5" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10 2.5V1.5C10 0.947715 9.55228 0.5 9 0.5H3C2.44772 0.5 2 0.947715 2 1.5V9.5C2 10.0523 2.44772 10.5 3 10.5H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {showExplorerLink && (
        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          className="copyable-hash__link"
          aria-label={`View ${kind} on Stellar Explorer`}
          title={`View ${kind} on Stellar Explorer`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      )}

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </span>
  )
}
