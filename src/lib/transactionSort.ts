import type { Transaction } from '../api/types'

/**
 * Client-side column sorting for the Transactions table.
 *
 * The API returns the newest-first page set and that order stays the default:
 * the table only reorders the rows already loaded for the current page, and
 * clearing the sort (third click on a header) returns to the server order.
 */

/** Columns the table can sort by. `transaction` (hash/link) is not sortable. */
export type TransactionSortKey = 'date' | 'type' | 'status' | 'amount'

export type SortDirection = 'asc' | 'desc'

export interface TransactionSort {
  key: TransactionSortKey
  direction: SortDirection
}

/** `null` means "no client-side sort" — render the server's order untouched. */
export type TransactionSortState = TransactionSort | null

/**
 * The fields the comparators read, so tests and other callers can pass plain
 * objects without the whole API `Transaction` shape.
 */
export type SortableTransaction = Pick<Transaction, 'timestamp' | 'type' | 'status' | 'amountUsdc'>

/** Locale-independent string ordering, so sort results do not vary by browser. */
function compareStrings(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Timestamps parse to `NaN` when malformed. Map that to `0` so the comparator
 * stays total (a `NaN` result would leave `Array#sort` order undefined).
 */
function timestampValue(timestamp: string): number {
  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Ascending comparator for one column. Amounts sort low-to-high with rows that
 * have no amount (`—`) always last, regardless of direction — see
 * {@link sortTransactions}.
 */
export function compareTransactions(
  a: SortableTransaction,
  b: SortableTransaction,
  key: TransactionSortKey
): number {
  switch (key) {
    case 'date':
      return timestampValue(a.timestamp) - timestampValue(b.timestamp)
    case 'type':
      return compareStrings(a.type, b.type)
    case 'status':
      return compareStrings(a.status, b.status)
    case 'amount': {
      const aAmount = a.amountUsdc
      const bAmount = b.amountUsdc
      const aMissing = aAmount === undefined || aAmount === null
      const bMissing = bAmount === undefined || bAmount === null
      if (aMissing && bMissing) return 0
      if (aMissing) return 1
      if (bMissing) return -1
      return aAmount - bAmount
    }
  }
}

/**
 * Returns the next state in the asc → desc → none cycle for `key`.
 *
 * Clicking a different header always starts at `asc`; a third click on the
 * active header clears the sort so the server's newest-first order is restored.
 */
export function nextTransactionSort(
  current: TransactionSortState,
  key: TransactionSortKey
): TransactionSortState {
  if (!current || current.key !== key) return { key, direction: 'asc' }
  return current.direction === 'asc' ? { key, direction: 'desc' } : null
}

/** `aria-sort` value for a column header. */
export function ariaSortFor(
  current: TransactionSortState,
  key: TransactionSortKey
): 'ascending' | 'descending' | 'none' {
  if (!current || current.key !== key) return 'none'
  return current.direction === 'asc' ? 'ascending' : 'descending'
}

/**
 * Sorts a copy of `rows` by the active column.
 *
 * Guarantees:
 * - Stable: equal keys keep their incoming (server) order via an index tiebreak.
 * - Total: malformed timestamps and missing amounts still produce a definite
 *   order.
 * - Non-destructive: returns a new array and never mutates the input; with no
 *   active sort it returns the rows in their original order.
 * - Missing amounts stay at the bottom in both directions so the `—` rows never
 *   lead an amount sort.
 */
export function sortTransactions<T extends SortableTransaction>(
  rows: readonly T[],
  sort: TransactionSortState
): T[] {
  if (!sort) return rows.slice()

  const { key, direction } = sort
  const indexed = rows.map((row, index) => ({ row, index }))

  indexed.sort((a, b) => {
    const base = compareTransactions(a.row, b.row, key)
    const unpinned = key === 'amount' && (a.row.amountUsdc == null || b.row.amountUsdc == null)
    const directed = unpinned || direction === 'asc' ? base : -base
    return directed !== 0 ? directed : a.index - b.index
  })

  return indexed.map((entry) => entry.row)
}
