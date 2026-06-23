import { useMemo, useState } from 'react'
import './Transactions.css'
import Badge from '../components/Badge'
import Select from '../components/controls/Select'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states'
import { useSettings } from '../context/SettingsContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTransactions } from '../hooks/useTransactions'
import { explorerUrl } from '../lib/explorerUrl'
import { truncateAddress } from '../lib/stellar'
import type { Transaction } from '../api/types'

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'failed'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'failed', label: 'Failed' },
]

const STATUS_BADGE_MAP: Record<Transaction['status'], string> = {
  pending: 'locked',
  confirmed: 'active',
  failed: 'slashed',
}

function relativeTime(isoTimestamp: string): string {
  const diff = Date.now() - new Date(isoTimestamp).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function Transactions() {
  useDocumentTitle('Transactions')

  const { network } = useSettings()
  const { data, isLoading, error, refetch } = useTransactions()
  const [filter, setFilter] = useState<StatusFilter>('all')

  const filtered = useMemo(
    () => (filter === 'all' ? data : data.filter((tx) => tx.status === filter)),
    [data, filter],
  )

  const hasData = !isLoading && !error

  return (
    <div>
      <div className="transactions__header">
        <h1 className="transactions__title">Transaction History</h1>
      </div>
      <p className="transactions__description">
        A durable record of your bond, withdrawal, and attestation events.
      </p>

      {isLoading && (
        <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading transactions">
          <p className="sr-only">Loading transactions…</p>
          <LoadingSkeleton variant="table" rows={5} />
        </div>
      )}

      {!isLoading && error && (
        <div role="alert">
          <ErrorState
            type={error.status === 0 ? 'network' : error.status >= 500 ? 'backend' : 'generic'}
            title="Unable to load transactions"
            message={error.message}
            action={{ label: 'Try again', onClick: refetch }}
          />
        </div>
      )}

      {hasData && data.length === 0 && (
        <EmptyState
          illustration="activity"
          title="No transactions yet"
          description="Your bond, withdrawal, and attestation events will appear here once you start transacting."
        />
      )}

      {hasData && data.length > 0 && (
        <>
          <div className="transactions__filterRow">
            <label htmlFor="tx-status-filter" className="transactions__filterLabel">
              Status
            </label>
            <Select
              id="tx-status-filter"
              value={filter}
              onChange={(v) => setFilter(v as StatusFilter)}
              options={STATUS_OPTIONS}
              ariaLabel="Filter by status"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="transactions__noResults">
              No {filter} transactions. Try a different filter.
            </p>
          ) : (
            <table className="transactions__table" aria-label="Transaction history">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">When</th>
                  <th scope="col">Transaction</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr key={tx.id}>
                    <td data-label="Type" className="transactions__type">
                      {tx.type}
                    </td>
                    <td data-label="Amount">
                      {tx.amountUsdc != null ? `${tx.amountUsdc.toLocaleString('en-US')} USDC` : '—'}
                    </td>
                    <td data-label="Status">
                      <Badge variant={STATUS_BADGE_MAP[tx.status]} label={tx.status} />
                    </td>
                    <td data-label="When">
                      <time dateTime={tx.timestamp}>{relativeTime(tx.timestamp)}</time>
                    </td>
                    <td data-label="Transaction">
                      <span className="transactions__hash" title={tx.hash}>
                        {truncateAddress(tx.hash)}
                      </span>{' '}
                      <a
                        href={explorerUrl(network, tx.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transactions__explorerLink"
                        aria-label={`View transaction ${truncateAddress(tx.hash)} on Stellar explorer`}
                      >
                        View ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
