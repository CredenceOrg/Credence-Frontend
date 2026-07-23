import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './Transactions.css'
import Badge from '../components/Badge'
import AddressDisplay from '../components/AddressDisplay'
import Select from '../components/controls/Select'
import Button from '../components/Button'
import ConfirmDialog from '../components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states'
import { TEST_IDS } from '../config/testIds'
import { useSettings } from '../context/SettingsContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTransactions } from '../hooks/useTransactions'
import { useToast } from '../components/ToastProvider'
import {
  buildExportFilename,
  downloadCsv,
  transactionsToCsv,
} from '../lib/transactionsExport'
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
  const { addToast } = useToast()
  const [filter, setFilter] = useState<StatusFilter>('all')

  // Local "deleted" overlay: we cannot mutate the API-fetched list, so we
  // keep track of removed IDs here. Bulk Delete writes here and clears the
  // selection; a successful refetch (or new filter) resets this overlay
  // because the source-of-truth ID set is back to the API response.
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(new Set())

  // Multi-selection state for bulk actions. IDs are the transaction `id`
  // because it is stable across reloads and uniquely identifies a row.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())

  const visibleTransactions = useMemo(
    () => data.filter((tx) => !deletedIds.has(tx.id)),
    [data, deletedIds],
  )

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? visibleTransactions
        : visibleTransactions.filter((tx) => tx.status === filter),
    [visibleTransactions, filter],
  )

  // Reset transient overlays when the underlying dataset changes (refetch
  // or unmount between fetches). Stale IDs would otherwise leak selection
  // into the new list.
  useEffect(() => {
    setDeletedIds(new Set())
    setSelectedIds(new Set())
  }, [data])

  const hasData = !isLoading && !error && visibleTransactions.length >= 0

  // ── Selection helpers ───────────────────────────────────────────────
  const isRowSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  )

  // Clamp selection to whatever is currently visible. Filter changes can
  // otherwise leave "ghost" selections counted in the bulk-actions bar
  // but absent from the table, confusing the user.
  useEffect(() => {
    if (selectedIds.size === 0) return
    const filteredIds = new Set(filtered.map((tx) => tx.id))
    let changed = false
    selectedIds.forEach((id) => {
      if (!filteredIds.has(id)) {
        changed = true
      }
    })
    if (changed) {
      const next = new Set<string>()
      filteredIds.forEach((id) => {
        if (selectedIds.has(id)) next.add(id)
      })
      setSelectedIds(next)
    }
  }, [filtered, selectedIds])

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const allFilteredIds = useMemo(() => filtered.map((tx) => tx.id), [filtered])
  const allFilteredSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id))
  const someFilteredSelected =
    !allFilteredSelected && allFilteredIds.some((id) => selectedIds.has(id))

  // Header checkbox sync — React does not expose `indeterminate` as a prop,
  // so we toggle the DOM property imperatively whenever the relevant
  // flags change.
  const selectAllRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (!selectAllRef.current) return
    selectAllRef.current.indeterminate = someFilteredSelected && !allFilteredSelected
  }, [someFilteredSelected, allFilteredSelected])

  const toggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      // Toggling off clears every filtered-id from the selection set, while
      // preserving any selections that exist outside the filtered subset.
      setSelectedIds((prev) => {
        const next = new Set(prev)
        allFilteredIds.forEach((id) => next.delete(id))
        return next
      })
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      allFilteredIds.forEach((id) => next.add(id))
      return next
    })
  }, [allFilteredIds, allFilteredSelected])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const orderedSelected = useMemo(
    () => filtered.filter((tx) => selectedIds.has(tx.id)),
    [filtered, selectedIds],
  )

  // ── Bulk action handlers ────────────────────────────────────────────
  const handleBulkExport = useCallback(() => {
    const count = orderedSelected.length
    if (count === 0) return
    const csv = transactionsToCsv(orderedSelected)
    downloadCsv(csv, buildExportFilename())
    addToast(
      'success',
      count === 1
        ? t('transactions.bulk.exportToast.successOne')
        : t('transactions.bulk.exportToast.successOther', { count }),
    )
  }, [orderedSelected, addToast, t])

  // ── Delete confirmation flow ───────────────────────────────────────
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const openDeleteDialog = useCallback(() => {
    if (orderedSelected.length === 0) return
    setDeleteDialogOpen(true)
  }, [orderedSelected.length])

  const closeDeleteDialog = useCallback(() => {
    if (isDeleting) return
    setDeleteDialogOpen(false)
  }, [isDeleting])

  const confirmBulkDelete = useCallback(() => {
    const count = orderedSelected.length
    if (count === 0) return
    setIsDeleting(true)
    // Synthetic local-only delete. There is no DELETE endpoint in the
    // current protocol API, so we hide the rows locally. Confirmation
    // wraps an immediate, synchronous state update — keep the work
    // minimal to preserve the dialog's loading-state semantics.
    const idsToRemove = orderedSelected.map((tx) => tx.id)
    setDeletedIds((prev) => {
      const next = new Set(prev)
      idsToRemove.forEach((id) => next.add(id))
      return next
    })
    setSelectedIds(new Set())
    addToast(
      'success',
      count === 1
        ? t('transactions.bulk.deleteConfirm.successOne')
        : t('transactions.bulk.deleteConfirm.successOther', { count }),
    )
    setIsDeleting(false)
    setDeleteDialogOpen(false)
  }, [orderedSelected, addToast, t])

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

      {hasData && visibleTransactions.length === 0 && (
        <EmptyState
          illustration="activity"
          title={t('transactions.noTransactions')}
          description={t('transactions.noTransactionsDescription')}
        />
      )}

      {hasData && visibleTransactions.length > 0 && (
        <>
          <div
            className="transactions__bulkActions"
            role="region"
            aria-label={t('transactions.bulk.actionsLabel')}
            hidden={selectedIds.size === 0}
            data-testid={TEST_IDS.TX_BULK_ACTIONS_BAR}
          >
            <p className="transactions__bulkActions-count" aria-live="polite">
              {selectedIds.size === 1
                ? t('transactions.bulk.selectedOne', { count: 1 })
                : t('transactions.bulk.selectedOther', { count: selectedIds.size })}
            </p>
            <div className="transactions__bulkActions-buttons">
              <Button
                type="button"
                variant="secondary"
                onClick={handleBulkExport}
                disabled={orderedSelected.length === 0}
                data-testid={TEST_IDS.TX_BULK_EXPORT_BUTTON}
              >
                {t('transactions.bulk.export')}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={openDeleteDialog}
                disabled={orderedSelected.length === 0}
                data-testid={TEST_IDS.TX_BULK_DELETE_BUTTON}
              >
                {t('transactions.bulk.delete')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={clearSelection}
                data-testid={TEST_IDS.TX_BULK_CLEAR_BUTTON}
              >
                {t('transactions.bulk.clear')}
              </Button>
            </div>
          </div>

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
                  <th scope="col" className="transactions__selectHeader">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      data-testid={TEST_IDS.TX_SELECT_ALL_CHECKBOX}
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      aria-label={t('transactions.bulk.selectAll')}
                    />
                  </th>
                  <th scope="col">{t('transactions.table.type')}</th>
                  <th scope="col">{t('transactions.table.amount')}</th>
                  <th scope="col">{t('transactions.table.status')}</th>
                  <th scope="col">{t('transactions.table.when')}</th>
                  <th scope="col">{t('transactions.table.transaction')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const selected = isRowSelected(tx.id)
                  return (
                    <tr
                      key={tx.id}
                      data-selected={selected ? 'true' : undefined}
                      className={selected ? 'transactions__row--selected' : undefined}
                    >
                      <td data-label="Select" className="transactions__selectCell">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRow(tx.id)}
                          aria-label={t('transactions.bulk.selectLabel', { id: tx.id })}
                        />
                      </td>
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
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={t('transactions.bulk.deleteConfirm.title')}
        subtitle={
          orderedSelected.length === 1
            ? t('transactions.bulk.deleteConfirm.subtitle', { count: 1 })
            : t('transactions.bulk.deleteConfirm.subtitle_other', { count: orderedSelected.length })
        }
        confirmPhrase={t('transactions.bulk.deleteConfirm.phrase')}
        confirmHint={t('transactions.bulk.deleteConfirm.hint')}
        confirmLabel={t('transactions.bulk.deleteConfirm.confirm')}
        confirmInputLabel={
          // Avoid a generic "withdrawal" label being appended when the dialog
          // auto-generates the prompt — instead surface the typed phrase and
          // the specific action so AT users hear the right context.
          <span>
            {t('confirmDialog.typeToConfirm', {
              phrase: t('transactions.bulk.deleteConfirm.phrase'),
              action: t('transactions.bulk.deleteConfirm.confirm').toLowerCase(),
            })}
          </span>
        }
        variant="danger"
        isSubmitting={isDeleting}
        onConfirm={confirmBulkDelete}
        onCancel={closeDeleteDialog}
      />
    </div>
  )
}
