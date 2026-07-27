import { useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { truncateAddress } from '../lib/stellar'
import TooltipOnOverflow from './TooltipOnOverflow'
import { CopyIcon, CheckIcon, ExternalLinkIcon } from './icons'
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
      <TooltipOnOverflow content={hash}>
        <span className="copyable-hash__text">{displayHash}</span>
      </TooltipOnOverflow>
      
      <button
        type="button"
        className={`copyable-hash__copy-btn ${copied ? 'copyable-hash__copy-btn--copied' : ''}`}
        onClick={handleCopy}
        aria-label="Copy hash"
        title="Copy hash"
      >
        {copied ? (
          <CheckIcon width={14} height={14} />
        ) : (
          <CopyIcon width={14} height={14} viewBox="0 0 14 14" />
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
          <ExternalLinkIcon width={14} height={14} />
        </a>
      )}

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </span>
  )
}
