import { formatUsdc } from '../lib/format'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { useToast } from './ToastProvider'
import './AmountDisplay.css'

export interface AmountDisplayProps {
  /** Raw numeric amount, e.g. `1234.5` */
  amount: number
  className?: string
  showCopyButton?: boolean
}

/**
 * Displays a formatted USDC amount in monospace with a copy-to-clipboard
 * affordance, matching AddressDisplay's pattern (same hook, same toast,
 * same token usage) so addresses and amounts share one formatting language.
 * The copy button copies the raw numeric value, not the "1,234.50 USDC" label.
 */
export default function AmountDisplay({
  amount,
  className = '',
  showCopyButton = true,
}: AmountDisplayProps) {
  const { copy, copied } = useCopyToClipboard()
  const { addToast } = useToast()

  const handleCopy = async () => {
    const success = await copy(String(amount))
    if (success) {
      addToast('success', 'Amount copied to clipboard')
    }
  }

  return (
    <div className={`amount-display ${className}`}>
      <code className="amount-display__amount">{formatUsdc(amount)}</code>
      {showCopyButton && (
        <button
          type="button"
          className="amount-display__copy-btn"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy amount'}
        >
          {copied ? (
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
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
              aria-hidden="true"
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
