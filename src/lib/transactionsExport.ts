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
    return formatAmount(tx.amountUsdc)
  }
  const value = tx[key]
  if (value == null) return ''
  return neutralizeFormula(stripControlCharacters(String(value)))
}

function formatAmount(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''

  const fixed = value.toFixed(7)
  const expanded = /e/i.test(fixed) ? expandScientificNotation(fixed) : fixed
  const [integer, fraction] = expanded.split('.')
  const trimmedFraction = fraction?.replace(/0+$/, '')
  return trimmedFraction ? `${integer}.${trimmedFraction}` : integer
}

function expandScientificNotation(value: string): string {
  const [coefficient, exponentString] = value.toLowerCase().split('e')
  const sign = coefficient.startsWith('-') ? '-' : ''
  const unsignedCoefficient = sign ? coefficient.slice(1) : coefficient
  const [integer, fraction = ''] = unsignedCoefficient.split('.')
  const digits = integer + fraction
  const decimalPosition = integer.length + Number(exponentString)

  if (decimalPosition >= digits.length) {
    return `${sign}${digits}${'0'.repeat(decimalPosition - digits.length)}`
  }
  return `${sign}${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`
}

function stripControlCharacters(value: string): string {
  let result = ''
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    ) {
      continue
    }
    result += value[i]
  }
  return result
}

function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

/**
 * RFC 4180-style CSV field escaping. Wraps any value that contains a
 * comma, double quote, newline, or carriage return in double quotes
 * and escapes embedded double quotes by doubling them.
 */
function escapeCsvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  value = safe
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
    if (typeof tx?.id !== 'string' || typeof tx.hash !== 'string') continue
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
  options: {
    document?: Document
    createObjectURL?: typeof URL.createObjectURL
    revokeObjectURL?: typeof URL.revokeObjectURL
  } = {}
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

export interface ExportAllPage {
  items: Transaction[]
  nextCursor?: string
}

export interface ExportAllProgress {
  pagesFetched: number
  rowsFetched: number
}

export interface ExportAllOptions {
  /** Fetches one cursor page of transactions. */
  fetchPage: (cursor: string | undefined, signal?: AbortSignal) => Promise<ExportAllPage>
  /** Optional progress callback invoked after each page is fetched. */
  onProgress?: (progress: ExportAllProgress) => void
  /** Optional AbortSignal to cancel the multi-page walk promptly. */
  signal?: AbortSignal
  /** Hard ceiling on the number of pages to fetch (defaults to 1000). */
  maxPages?: number
}

export interface ExportAllResult {
  csv: string
  rows: number
  pagesFetched: number
  truncated: boolean
  stopReason: 'complete' | 'max_pages' | 'cursor_loop'
}

function createAbortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

/**
 * Walk every cursor page of transactions via `fetchPage`, detecting cursor
 * loops, respecting `maxPages` and `signal` cancellation, reporting progress
 * after each page, and serializing all rows with `transactionsToCsv` (which
 * preserves RFC 4180 escaping and formula-injection neutralization).
 */
export async function exportAllTransactions({
  fetchPage,
  onProgress,
  signal,
  maxPages = 1000,
}: ExportAllOptions): Promise<ExportAllResult> {
  if (signal?.aborted) {
    throw createAbortError()
  }

  const allRows: Transaction[] = []
  const seenCursors = new Set<string>()
  let cursor: string | undefined = undefined
  let pagesFetched = 0
  let stopReason: ExportAllResult['stopReason'] = 'complete'

  while (pagesFetched < maxPages) {
    if (signal?.aborted) {
      throw createAbortError()
    }

    const page = await fetchPage(cursor, signal)

    if (signal?.aborted) {
      throw createAbortError()
    }

    pagesFetched += 1
    if (Array.isArray(page.items) && page.items.length > 0) {
      allRows.push(...page.items)
    }

    onProgress?.({
      pagesFetched,
      rowsFetched: allRows.length,
    })

    const nextCursor = page.nextCursor
    if (!nextCursor) {
      stopReason = 'complete'
      break
    }

    if (seenCursors.has(nextCursor)) {
      stopReason = 'cursor_loop'
      break
    }

    if (pagesFetched >= maxPages) {
      stopReason = 'max_pages'
      break
    }

    seenCursors.add(nextCursor)
    cursor = nextCursor
  }

  return {
    csv: transactionsToCsv(allRows),
    rows: allRows.length,
    pagesFetched,
    truncated: stopReason !== 'complete',
    stopReason,
  }
}
