import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './Transactions.css'
import Badge from '../components/Badge'
import AddressDisplay from '../components/AddressDisplay'
import Select from '../components/controls/Select'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states'
import { useSettings } from '../context/SettingsContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTransactions } from '../hooks/useTransactions'
import { explorerUrl } from '../lib/explorerUrl'
import { truncateAddress } from '../lib/stellar'
import type { Transaction } from '../api/types'

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'failed'


const STATUS_BADGE_MAP: Record<Transaction['status'], string> = {
  pending: 'locked',
  confirmed: 'active',
  failed: 'slashed',
}


export default function Transactions() {
  const { t } = useTranslation()
  useDocumentTitle(t('transactions.title'))

  const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: t('transactions.status.all') },
    { value: 'pending', label: t('transactions.status.pending') },
    { value: 'confirmed', label: t('transactions.status.confirmed') },
    { value: 'failed', label: t('transactions.status.failed') },
  ]

  function relativeTime(isoTimestamp: string): string {
    const diff = Date.now() - new Date(isoTimestamp).getTime()
    const minutes = Math.floor(diff / 60_000)
    if (minutes < 1) return t('transactions.relativeTime.justNow')
    if (minutes < 60) return t('transactions.relativeTime.minutesAgo', { count: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('transactions.relativeTime.hoursAgo', { count: hours })
    const days = Math.floor(hours / 24)
    return t('transactions.relativeTime.daysAgo', { count: days })
  }

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
        <h1 className="transactions__title">{t('transactions.title')}</h1>
      </div>
      <p className="transactions__description">
        {t('transactions.description')}
      </p>

      {isLoading && (
        <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading transactions">
          <p className="sr-only">{t('transactions.loading')}</p>
          <LoadingSkeleton variant="table" rows={5} />
        </div>
      )}

      {!isLoading && error && (
        <div role="alert">
          <ErrorState
            type={error.status === 0 ? 'network' : error.status >= 500 ? 'backend' : 'generic'}
            title={t('transactions.unableToLoad')}
            message={error.message}
            action={{ label: t('common.tryAgain'), onClick: refetch }}
          />
        </div>
      )}

      {hasData && data.length === 0 && (
        <EmptyState
          illustration="activity"
          title={t('transactions.noTransactions')}
          description={t('transactions.noTransactionsDescription')}
        />
      )}

      {hasData && data.length > 0 && (
        <>
          <div className="transactions__filterRow">
            <label htmlFor="tx-status-filter" className="transactions__filterLabel">
              {t('transactions.filterLabel')}
            </label>
            <Select
              id="tx-status-filter"
              value={filter}
              onChange={(v) => setFilter(v as StatusFilter)}
              options={STATUS_OPTIONS}
              ariaLabel={t('transactions.filterAriaLabel')}
            />
          </div>

          {filtered.length === 0 ? (
            <p className="transactions__noResults">
              {t('transactions.noResults', { filter })}
            </p>
          ) : (
            <table className="transactions__table" aria-label="Transaction history">
              <thead>
                <tr>
                  <th scope="col">{t('transactions.table.type')}</th>
                  <th scope="col">{t('transactions.table.amount')}</th>
                  <th scope="col">{t('transactions.table.status')}</th>
                  <th scope="col">{t('transactions.table.when')}</th>
                  <th scope="col">{t('transactions.table.transaction')}</th>
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
                      <AddressDisplay address={tx.hash} className="transactions__hash" />{' '}
                      <a
                        href={explorerUrl(network, tx.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transactions__explorerLink"
                        aria-label={t('transactions.table.viewOnExplorer', { hash: truncateAddress(tx.hash) })}
                      >
                        {t('transactions.table.viewLink')}
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
