import { useCallback, useRef } from 'react'
import useCopyToClipboard from '@/hooks/useCopyToClipboard'

export interface CopyableHashProps {
  hash: string
  /** Optional class name for styling. */
  className?: string
  /** Aria label for the copy button. */
  copyLabel?: string
}

export default function CopyableHash({ hash, className = '', copyLabel = 'Copy hash to clipboard' }: CopyableHashProps) {
  const { copy, copied } = useCopyToClipboard()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleCopy = useCallback(async () => {
    await copy(hash)
  }, [copy, hash])

  return (
    <span className={`copyable-hash ${className}`.trim()}>
      <code className="copyable-hash__value">{hash}</code>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleCopy}
        className={`copyable-hash__button ${copied ? 'copyable-hash__button--copied' : ''}`}
        aria-label={copyLabel}
        title={copied ? 'Copied!' : copyLabel}
      >
        {copied ? (
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
            />
          </svg>
        )}
        {copied && <span className="copyable-hash__feedback" aria-live="polite">Copied</span>}
      </button>
    </span>
  )
}