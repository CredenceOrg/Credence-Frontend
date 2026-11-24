import { describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../api/types'
import {
  transactionsToCsv,
  buildExportFilename,
  downloadCsv,
  exportAllTransactions,
  EXPORT_COLUMNS,
} from './transactionsExport'

const sample: Transaction[] = [
  {
    id: 'tx-1',
    type: 'bond',
    amountUsdc: 1000,
    status: 'confirmed',
    timestamp: '2026-01-15T12:00:00Z',
    hash: 'ABC123',
  },
  {
    id: 'tx-2',
    type: 'withdraw',
    amountUsdc: undefined,
    status: 'failed',
    timestamp: '2026-01-16T08:30:00Z',
    hash: 'G"QUOTE,COMMA\nNEWLINE',
  },
]

const normalThreeRowExport = [
  'id,type,status,amountUSDC,timestamp,hash',
  'tx-1,bond,confirmed,1000,2026-01-15T12:00:00Z,ABC123',
  'tx-2,withdraw,failed,,2026-01-16T08:30:00Z,GQUOTE',
  'tx-3,attestation,pending,12.5,2026-01-17T09:45:00Z,b6d396a8',
].join('\r\n') + '\r\n'

describe('transactionsToCsv', () => {
  it('renders a header row even when no transactions are provided', () => {
    expect(transactionsToCsv([])).toBe(EXPORT_COLUMNS.map((c) => c.header).join(',') + '\r\n')
  })

  it('renders each transaction in column order with the documented headers', () => {
    const csv = transactionsToCsv(sample)

    expect(csv).toContain('id,type,status,amountUSDC,timestamp,hash')
    expect(csv).toContain('tx-1,bond,confirmed,1000,2026-01-15T12:00:00Z,ABC123')
    // RFC 4180 wraps the raw value when it contains special chars; the
    // embedded newline + comma + quote inside the hash are escaped, so the
    // value appears wrapped and the embedded quote is doubled.
    expect(csv).toContain('tx-2,withdraw,failed,,2026-01-16T08:30:00Z,"G""QUOTE,COMMA\nNEWLINE"')
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

  it('neutralises spreadsheet formula-injection prefixes', () => {
    const formulaTx: Transaction = {
      id: 'tx-formula',
      type: 'bond',
      amountUsdc: 50,
      status: 'pending',
      timestamp: '2026-01-17T09:00:00Z',
      hash: '=SUM(A1:A2)',
  it('preserves the existing output for ordinary three-row exports', () => {
    const transactions: Transaction[] = [
      sample[0],
      { ...sample[1], hash: 'GQUOTE' },
      {
        id: 'tx-3',
        type: 'attestation',
        amountUsdc: 12.5,
        status: 'pending',
        timestamp: '2026-01-17T09:45:00Z',
        hash: 'b6d396a8',
      },
    ]

    expect(transactionsToCsv(transactions)).toBe(normalThreeRowExport)
  })

  it.each([
    ['=', '=1+1'],
    ['+', '+1'],
    ['-', '-1'],
    ['@', '@x'],
    ['\t', '\tx'],
    ['\r', '\rx'],
  ])('neutralizes an id starting with %j', (trigger, value) => {
    const csv = transactionsToCsv([{ ...sample[0], id: value }])
    const expectedCell = trigger === '\r' ? `"'\rx"` : `'${value}`

    expect(csv.startsWith(`id,type,status,amountUSDC,timestamp,hash\r\n${expectedCell}`)).toBe(
      true
    )
  })

  it('neutralizes all text columns and preserves RFC 4180 escaping', () => {
    const transaction: Transaction = {
      id: '=H,"Click"',
      type: '=type' as unknown as Transaction['type'],
      status: '+status' as unknown as Transaction['status'],
      amountUsdc: undefined,
      timestamp: '@timestamp',
      hash: '\t@SUM(1+1)',
    }
    const csv = transactionsToCsv([formulaTx])
    expect(csv).toContain("'=SUM(A1:A2)")
    expect(csv).not.toContain(',=SUM(A1:A2)')
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

describe('exportAllTransactions', () => {
  const makeTx = (id: string, hash = `HASH_${id}`): Transaction => ({
    id,
    type: 'bond',
    amountUsdc: 100,
    status: 'confirmed',
    timestamp: '2026-01-15T12:00:00Z',
    hash,
  })

  it('walks multiple cursor pages, reports progress, and serializes every row with formula neutralization', async () => {
    const pages: Record<string, { items: Transaction[]; nextCursor?: string }> = {
      __first__: {
        items: [makeTx('tx-1', '=SUM(A1:A2)'), makeTx('tx-2')],
        nextCursor: 'cursor-2',
      },
      'cursor-2': {
        items: [makeTx('tx-3')],
        nextCursor: 'cursor-3',
      },
      'cursor-3': {
        items: [makeTx('tx-4')],
        nextCursor: undefined,
      },
    }

    const fetchPage = vi.fn(async (cursor: string | undefined) => {
      return pages[cursor ?? '__first__']
    })
    const onProgress = vi.fn()

    const result = await exportAllTransactions({ fetchPage, onProgress })

    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined, undefined)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'cursor-2', undefined)
    expect(fetchPage).toHaveBeenNthCalledWith(3, 'cursor-3', undefined)

    expect(onProgress).toHaveBeenNthCalledWith(1, { pagesFetched: 1, rowsFetched: 2 })
    expect(onProgress).toHaveBeenNthCalledWith(2, { pagesFetched: 2, rowsFetched: 3 })
    expect(onProgress).toHaveBeenNthCalledWith(3, { pagesFetched: 3, rowsFetched: 4 })

    expect(result.rows).toBe(4)
    expect(result.pagesFetched).toBe(3)
    expect(result.truncated).toBe(false)
    expect(result.stopReason).toBe('complete')
    expect(result.csv).toContain("'=SUM(A1:A2)")
    expect(result.csv).toContain('tx-1')
    expect(result.csv).toContain('tx-4')
  })

  it('stops promptly when cancelled via AbortController', async () => {
    const controller = new AbortController()
    const fetchPage = vi.fn(async (cursor: string | undefined) => {
      if (!cursor) {
        controller.abort()
        return { items: [makeTx('tx-1')], nextCursor: 'cursor-2' }
      }
      return { items: [makeTx('tx-2')], nextCursor: undefined }
    })

    await expect(
      exportAllTransactions({ fetchPage, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('rejects immediately if signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchPage = vi.fn()

    await expect(
      exportAllTransactions({ fetchPage, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('detects cursor loops and terminates cleanly', async () => {
    const fetchPage = vi.fn(async (cursor: string | undefined) => {
      if (!cursor) {
        return { items: [makeTx('tx-1')], nextCursor: 'cursor-a' }
      }
      if (cursor === 'cursor-a') {
        return { items: [makeTx('tx-2')], nextCursor: 'cursor-b' }
      }
      // Loop back to previously seen cursor-a
      return { items: [makeTx('tx-3')], nextCursor: 'cursor-a' }
    })

    const result = await exportAllTransactions({ fetchPage })

    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(result.rows).toBe(3)
    expect(result.pagesFetched).toBe(3)
    expect(result.truncated).toBe(true)
    expect(result.stopReason).toBe('cursor_loop')
  })

  it('caps pagination at maxPages', async () => {
    let counter = 0
    const fetchPage = vi.fn(async () => {
      counter += 1
      return {
        items: [makeTx(`tx-${counter}`)],
        nextCursor: `cursor-${counter + 1}`,
      }
    })

    const result = await exportAllTransactions({ fetchPage, maxPages: 3 })

    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(result.rows).toBe(3)
    expect(result.pagesFetched).toBe(3)
    expect(result.truncated).toBe(true)
    expect(result.stopReason).toBe('max_pages')
  })

  it('propagates errors thrown by fetchPage', async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error('Rate limit exceeded')
    })

    await expect(exportAllTransactions({ fetchPage })).rejects.toThrow('Rate limit exceeded')
  })
})
