/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useRef, useEffect } from 'react'
import { useSettings } from '../context/SettingsContext'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { truncateAddress } from '../lib/stellar'
import TooltipOnOverflow from './TooltipOnOverflow'
import './CopyableHash.css'

export type CopyState = 'idle' | 'loading' | 'copied' | 'error' | 'stale' | 'permission'

export interface CopyableHashProps {
  /** The raw hash string (transaction hash or address) */
  hash: string
  /** The kind of hash being displayed */
  kind?: 'tx' | 'address'
  /** Whether to truncate the hash. Defaults to true. */
  truncate?: boolean
  /** Whether to show a link to the Stellar explorer. Defaults to true. */
  showExplorerLink?: boolean
  /**
   * Optional custom copy handler or async request.
   * If provided, clicking copy enters loading state and executes this callback.
   * If not provided, delegates to useCopyToClipboard.
   */
  onCopyRequest?: (hash: string) => Promise<boolean | void>
  /**
   * Alias for onCopyRequest.
   */
  onCopy?: (hash: string) => Promise<boolean | void>
  /**
   * Whether the hash is known to be stale. If true, attempting to copy
   * will transition to the 'stale' state.
   */
  isStale?: boolean
}

/**
 * CopyableHash
 *
 * Renders a monospace, truncated hash (head…tail) with an accessible copy button
 * and an optional network-aware Stellar explorer link.
 *
 * Invariants:
 * 1. Pure & deterministic rendering:
 *    - Invalid, non-string, or empty/whitespace-only `hash` inputs cleanly fail closed (render null).
 *    - Explorer link construction escapes path segments to prevent query/hash injection or XSS.
 * 2. Unambiguous state transitions:
 *    - State is strictly one of 'idle' | 'loading' | 'copied' | 'error' | 'stale' | 'permission'.
 *    - Loading state prevents concurrent copy operations and gates the copy button.
 * 3. Race condition and concurrency protection:
 *    - Sequence tracking ensures out-of-order async copy resolutions are discarded.
 *    - Stale executions (where hash changes or unmounts during in-flight promise) cannot leak.
 * 4. Error classification & diagnosability:
 *    - Permission errors (NotAllowedError, PermissionError, unauthorized) map to 'permission'.
 *    - Stale data indicators (StaleDataError, isStale flag, changed hash) map to 'stale'.
 *    - Generic failures map to 'error'.
 *    - User errors are surfaced without exposing sensitive data.
 * 5. Recoverability:
 *    - Any failure state ('error', 'stale', 'permission') exposes an accessible retry mechanism.
 */
export default function CopyableHash({
  hash,
  kind = 'tx',
  truncate = true,
  showExplorerLink = true,
  onCopyRequest,
  onCopy,
  isStale = false,
}: CopyableHashProps) {
  const { network, addressDisplay } = useSettings()
  const { copy, copied } = useCopyToClipboard()
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const copyRequestSeq = useRef(0)
  const isMountedRef = useRef(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fail-closed validation for invalid, non-string, or blank inputs
  if (typeof hash !== 'string') return null
  const cleanHash = hash.trim()
  if (!cleanHash) return null

  const currentHashRef = useRef(cleanHash)
  useEffect(() => {
    currentHashRef.current = cleanHash
  }, [cleanHash])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Determine display hash
  let displayHash = cleanHash
  if (truncate) {
    if (kind === 'address') {
      if (addressDisplay !== 'full') {
        displayHash = truncateAddress(cleanHash)
      }
    } else {
      // Transaction hash truncation: use canonical middle truncation
      if (cleanHash.length > 20) {
        displayHash = truncateAddress(cleanHash)
      }
    }
  }

  // Build Explorer Link with URL-encoded clean hash to prevent path traversal or injection
  const explorerBaseUrl =
    network === 'test'
      ? 'https://stellar.expert/explorer/testnet'
      : 'https://stellar.expert/explorer/public'

  const explorerPath =
    kind === 'address'
      ? `/account/${encodeURIComponent(cleanHash)}`
      : `/tx/${encodeURIComponent(cleanHash)}`
  const explorerHref = `${explorerBaseUrl}${explorerPath}`

  const executeCopy = async () => {
    if (copyState === 'loading') return

    if (isStale) {
      setCopyState('stale')
      setErrorMessage('Hash data is stale.')
      return
    }

    const seq = ++copyRequestSeq.current
    try {
      setCopyState('loading')
      setErrorMessage(null)

      const handler = onCopyRequest || onCopy
      let success = true

      if (handler) {
        const result = await handler(cleanHash)
        if (result === false) {
          success = false
        }
      } else {
        const result = await copy(cleanHash)
        if (!result) {
          success = false
        }
      }

      if (seq !== copyRequestSeq.current || !isMountedRef.current) return

      // Verify that the hash didn't change while the async copy was in flight
      if (currentHashRef.current !== cleanHash) {
        setCopyState('stale')
        setErrorMessage('Hash data is stale.')
        return
      }

      if (success) {
        setCopyState('copied')
        setErrorMessage(null)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          if (seq === copyRequestSeq.current && isMountedRef.current) {
            setCopyState('idle')
          }
        }, 2000)
      } else {
        setCopyState('error')
        setErrorMessage('Failed to copy hash.')
      }
    } catch (err: unknown) {
      if (seq !== copyRequestSeq.current || !isMountedRef.current) return

      const msg = err instanceof Error ? err.message : String(err)
      const lowerMsg = msg.toLowerCase()

      const isPermission =
        (err as any)?.name === 'PermissionError' ||
        (err as any)?.name === 'NotAllowedError' ||
        lowerMsg.includes('permission') ||
        lowerMsg.includes('unauthorized') ||
        lowerMsg.includes('not allowed') ||
        (err as any)?.code === 'PERMISSION_DENIED'

      const isStaleData =
        (err as any)?.name === 'StaleDataError' ||
        lowerMsg.includes('stale') ||
        (err as any)?.code === 'STALE_DATA'

      if (isPermission) {
        setCopyState('permission')
        setErrorMessage('Permission denied copying hash.')
      } else if (isStaleData) {
        setCopyState('stale')
        setErrorMessage('Hash data is stale.')
      } else {
        setCopyState('error')
        setErrorMessage('Failed to copy hash.')
      }
    }
  }

  const isCopied = copied || copyState === 'copied'
  const isLoading = copyState === 'loading'
  const showError =
    copyState === 'error' || copyState === 'stale' || copyState === 'permission'

  // SR Announcement
  let srMessage = ''
  if (isCopied) {
    srMessage = 'Copied'
  } else if (isLoading) {
    srMessage = 'Copying hash...'
  } else if (copyState === 'permission') {
    srMessage = 'Permission denied copying hash.'
  } else if (copyState === 'stale') {
    srMessage = 'Hash data is stale.'
  } else if (copyState === 'error') {
    srMessage = 'Copy failed'
  }

  return (
    <span className="copyable-hash">
      <TooltipOnOverflow content={cleanHash}>
        <span className="copyable-hash__text">{displayHash}</span>
      </TooltipOnOverflow>

      <button
        type="button"
        className={`copyable-hash__copy-btn ${isCopied ? 'copyable-hash__copy-btn--copied' : ''} ${isLoading ? 'copyable-hash__copy-btn--loading' : ''}`}
        onClick={executeCopy}
        disabled={isLoading}
        aria-busy={isLoading}
        aria-label={
          isLoading
            ? 'Copying hash...'
            : isCopied
              ? 'Copied'
              : 'Copy hash'
        }
        title={
          isLoading
            ? 'Copying...'
            : isCopied
              ? 'Copied'
              : 'Copy hash'
        }
      >
        {isLoading ? (
          <svg
            className="copyable-hash__spinner"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle
              cx="7"
              cy="7"
              r="5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="20"
              strokeDashoffset="10"
              strokeLinecap="round"
            />
          </svg>
        ) : isCopied ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M2 7L5 10L12 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="2.5"
              y="3.5"
              width="9"
              height="10"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M10 2.5V1.5C10 0.947715 9.55228 0.5 9 0.5H3C2.44772 0.5 2 0.947715 2 1.5V9.5C2 10.0523 2.44772 10.5 3 10.5H4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      )}

      {showError && (
        <span className="copyable-hash__error-box" role="alert">
          <span className="copyable-hash__error-text">
            {copyState === 'permission'
              ? 'Permission denied copying hash.'
              : copyState === 'stale'
                ? 'Hash data is stale.'
                : 'Failed to copy hash.'}
          </span>
          <button
            type="button"
            onClick={executeCopy}
            className="copyable-hash__retry-btn"
            aria-label="Retry copy"
          >
            Retry
          </button>
        </span>
      )}

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </span>
  )
}
