import type { Transaction } from '../api/types'

export type StatusFilter = 'all' | Transaction['status']
export type TypeFilter = 'all' | Transaction['type']
export interface TransactionFilters {
  status: StatusFilter
  type: TypeFilter
  from: string
  to: string
  q: string
}

export const TRANSACTION_TYPES: Transaction['type'][] = ['bond', 'withdraw', 'attestation']
export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  status: 'all',
  type: 'all',
  from: '',
  to: '',
  q: '',
}

// Reject rollover dates (for example February 30), not just unparsable strings.
function validDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : ''
}

export function parseTransactionFilters(params: URLSearchParams): TransactionFilters {
  const status = params.get('status')
  const type = params.get('type')
  let from = validDate(params.get('from'))
  let to = validDate(params.get('to'))
  // An inverted URL range is invalid as a whole; use the unbounded default.
  if (from && to && from > to) {
    from = ''
    to = ''
  }
  return {
    status: status === 'pending' || status === 'confirmed' || status === 'failed' ? status : 'all',
    type: TRANSACTION_TYPES.includes(type as Transaction['type'])
      ? (type as Transaction['type'])
      : 'all',
    from,
    to,
    q: params.get('q') ?? '',
  }
}

/** Omit defaults and retain query parameters owned by other features. */
export function serializeTransactionFilters(
  filters: TransactionFilters,
  current = new URLSearchParams()
): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const key of ['status', 'type', 'from', 'to', 'q'] as const) {
    next.delete(key)
    if (filters[key] !== DEFAULT_TRANSACTION_FILTERS[key]) next.set(key, filters[key])
  }
  return next
}

/** Apply all active predicates with AND semantics; dates are inclusive UTC days. */
export function applyTransactionFilters(
  transactions: readonly Transaction[],
  filters: TransactionFilters
): Transaction[] {
  const query = filters.q.trim().toLowerCase()
  const from = filters.from ? Date.parse(`${filters.from}T00:00:00.000Z`) : -Infinity
  const until = filters.to ? Date.parse(`${filters.to}T00:00:00.000Z`) + 86400000 : Infinity
  return transactions.filter((tx) => {
    if (filters.status !== 'all' && tx.status !== filters.status) return false
    if (filters.type !== 'all' && tx.type !== filters.type) return false
    if (filters.from || filters.to) {
      const time = Date.parse(tx.timestamp)
      if (!Number.isFinite(time) || time < from || time >= until) return false
    }
    return (
      !query ||
      [tx.id, tx.hash, tx.type, tx.status].some(
        (value) => typeof value === 'string' && value.toLowerCase().includes(query)
      )
    )
  })
}
