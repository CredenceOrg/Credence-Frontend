/**
 * @file transactionsExport.ts
 * @description Utilities for serializing Transaction objects to CSV and
 * triggering a browser download. Used by the Transactions page bulk actions
 * (Issue #560). Kept dependency-free and pure for easy unit testing.
 */

import type { Transaction } from '../api/types'

/**
 * Columns included in the exported CSV. Order matters — it defines the
 * header row and the per-row order, so consumers / spreadsheets see the
 * same shape every time.
 */
export const EXPORT_COLUMNS: ReadonlyArray<{
  key: keyof Transaction | 'amountUsdcDisplay'
  header: string
}> = [
  { key: 'id', header: 'id' },
  { key: 'type', header: 'type' },
  { key: 'status', header: 'status' },
  { key: 'amountUsdcDisplay', header: 'amountUSDC' },
  { key: 'timestamp', header: 'timestamp' },
  { key: 'hash', header: 'hash' },
] as const

/**
 * Render a single Transaction's value for a CSV cell. Undefined /
 * null values become the empty string so Excel-style consumers don't
 * show "undefined" or "null".
 */
function cellValue(tx: Transaction, key: (typeof EXPORT_COLUMNS)[number]['key']): string {
  if (key === 'amountUsdcDisplay') {
    return tx.amountUsdc == null ? '' : String(tx.amountUsdc)
  }
  const value = tx[key]
  if (value == null) return ''
  return String(value)
}

/**
 * RFC 4180-style CSV field escaping. Wraps any value that contains a
 * comma, double quote, newline, or carriage return in double quotes
 * and escapes embedded double quotes by doubling them.
 */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Serialize a list of transactions to a CSV string with a header row.
 * Empty input produces just the header row, which keeps downstream
 * tooling predictable.
 */
export function transactionsToCsv(transactions: Transaction[]): string {
  const headerLine = EXPORT_COLUMNS.map((c) => escapeCsvField(c.header)).join(',')
  const lines: string[] = [headerLine]
  for (const tx of transactions) {
    lines.push(EXPORT_COLUMNS.map((c) => escapeCsvField(cellValue(tx, c.key))).join(','))
  }
  // Trailing newline matches the RFC 4180 convention and is friendly to
  // POSIX-style line readers.
  return lines.join('\r\n') + '\r\n'
}

/**
 * Build a filename including the current ISO date so repeated exports
 * don't overwrite each other. Example:
 * `credence-transactions-2026-01-15.csv`.
 */
export function buildExportFilename(now: Date = new Date()): string {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `credence-transactions-${yyyy}-${mm}-${dd}.csv`
}

/**
 * Trigger a browser download for the supplied CSV content. Uses the
 * standard `Blob` + `URL.createObjectURL` + temporary `<a>` anchor
 * trick so no third-party dependency is required. Safe to call from
 * SSR environments — it bails out on missing `document` / `Blob`.
 */
export function downloadCsv(
  csv: string,
  filename: string,
  options: { document?: Document; createObjectURL?: typeof URL.createObjectURL; revokeObjectURL?: typeof URL.revokeObjectURL } = {}
): void {
  if (typeof document === 'undefined' && !options.document) return
  const doc = options.document ?? document
  const createURL = options.createObjectURL ?? URL.createObjectURL.bind(URL)
  const revokeURL = options.revokeObjectURL ?? URL.revokeObjectURL.bind(URL)

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = createURL(blob)
  const anchor = doc.createElement('a')
  anchor.href = url
  anchor.download = filename
  // Some browsers ignore programmatic clicks on detached anchors.
  anchor.style.display = 'none'
  doc.body.appendChild(anchor)
  anchor.click()
  doc.body.removeChild(anchor)
  revokeURL(url)
}
