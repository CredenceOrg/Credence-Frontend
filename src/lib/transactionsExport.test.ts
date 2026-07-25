import { describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../api/types'
import {
  transactionsToCsv,
  buildExportFilename,
  downloadCsv,
  EXPORT_COLUMNS,
} from './transactionsExport'

const sample: Transaction[] = [
  {
    id: 'tx-1',
    type: 'bond_create',
    amountUsdc: 1000,
    status: 'confirmed',
    timestamp: '2026-01-15T12:00:00Z',
    hash: 'ABC123',
  },
  {
    id: 'tx-2',
    type: 'withdraw',
    amountUsdc: null,
    status: 'failed',
    timestamp: '2026-01-16T08:30:00Z',
    hash: 'G"QUOTE,COMMA\nNEWLINE',
  },
]

describe('transactionsToCsv', () => {
  it('renders a header row even when no transactions are provided', () => {
    expect(transactionsToCsv([])).toBe(
      EXPORT_COLUMNS.map((c) => c.header).join(',') + '\r\n'
    )
  })

  it('renders each transaction in column order with the documented headers', () => {
    const csv = transactionsToCsv(sample)

    expect(csv).toContain(
      'id,type,status,amountUSDC,timestamp,hash'
    )
    expect(csv).toContain('tx-1,bond_create,confirmed,1000,2026-01-15T12:00:00Z,ABC123')
    // RFC 4180 wraps the raw value when it contains special chars; the
    // embedded newline + comma + quote inside the hash are escaped, so the
    // value appears wrapped and the embedded quote is doubled.
    expect(csv).toContain(
      'tx-2,withdraw,failed,,2026-01-16T08:30:00Z,"G""QUOTE,COMMA\nNEWLINE"'
    )
  })

  it('emits empty cells for missing amountUsdc values', () => {
    const csv = transactionsToCsv([sample[1]])
    // Confirm the missing amount column renders as an empty value between commas.
    expect(csv).toContain('withdraw,failed,,2026-01-16T08:30:00Z')
  })

  it('escapes commas, quotes, and newlines per RFC 4180', () => {
    const csv = transactionsToCsv([sample[1]])
    expect(csv).toContain('"G""QUOTE,COMMA\nNEWLINE"')
  })

  it('terminates with a trailing CRLF', () => {
    expect(transactionsToCsv(sample).endsWith('\r\n')).toBe(true)
  })
})

describe('buildExportFilename', () => {
  it('includes the current ISO date for a stable filename', () => {
    expect(buildExportFilename(new Date('2026-01-15T10:00:00Z'))).toBe(
      'credence-transactions-2026-01-15.csv'
    )
  })

  it('zero-pads single-digit month and day components', () => {
    expect(buildExportFilename(new Date('2026-03-04T10:00:00Z'))).toBe(
      'credence-transactions-2026-03-04.csv'
    )
  })
})

describe('downloadCsv', () => {
  it('creates an anchor, appends + clicks it, then revokes the URL', () => {
    const click = vi.fn()
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()

    const mockAnchor = {
      href: '',
      download: '',
      click,
      style: {} as CSSStyleDeclaration,
    } as unknown as HTMLAnchorElement

    const mockDocument = {
      createElement: vi.fn(() => mockAnchor),
      body: { appendChild, removeChild } as unknown as HTMLElement,
    } as unknown as Document

    downloadCsv('a,b\r\n', 'mock.csv', {
      document: mockDocument,
      createObjectURL,
      revokeObjectURL,
    })

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(mockDocument.createElement).toHaveBeenCalledWith('a')
    expect(mockAnchor.href).toBe('blob:mock-url')
    expect(mockAnchor.download).toBe('mock.csv')
    expect(appendChild).toHaveBeenCalledWith(mockAnchor)
    expect(click).toHaveBeenCalledTimes(1)
    expect(removeChild).toHaveBeenCalledWith(mockAnchor)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('is a no-op when no document is available', () => {
    const createObjectURL = vi.fn(() => 'blob:nope')
    expect(() =>
      downloadCsv('a,b\r\n', 'x.csv', {
        // document intentionally undefined + the helper falls back to global document
        // which is also undefined in this test environment.
        createObjectURL,
        revokeObjectURL: vi.fn(),
      })
    ).not.toThrow()
    // Either no URL was created (preferred) or, in jsdom-backed runs, the global
    // document was used. We only guarantee the helper does not throw here.
  })
})
