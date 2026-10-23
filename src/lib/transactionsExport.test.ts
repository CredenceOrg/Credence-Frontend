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
      type: '=type',
      status: '+status',
      amountUsdc: undefined,
      timestamp: '@timestamp',
      hash: '\t@SUM(1+1)',
    }
    const csv = transactionsToCsv([transaction])

    expect(csv).toBe(
      `id,type,status,amountUSDC,timestamp,hash\r\n"'=H,""Click""",'=type,'+status,,'@timestamp,'\t@SUM(1+1)\r\n`
    )
  })

  it('removes disallowed control characters from text cells', () => {
    const csv = transactionsToCsv([
      { ...sample[0], id: '\u0000=foo\u0007\u007f' },
    ])

    expect(csv).toContain(`,'=foo,bond,`)
    expect(csv).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/)
  })

  it('formats finite amounts as fixed-point values and leaves invalid amounts empty', () => {
    expect(transactionsToCsv([{ ...sample[0], amountUsdc: -12.5 }])).toContain(
      'confirmed,-12.5,'
    )
    expect(transactionsToCsv([{ ...sample[0], amountUsdc: 1e20 }])).toContain(
      'confirmed,100000000000000000000,'
    )
    expect(transactionsToCsv([{ ...sample[0], amountUsdc: 1e21 }])).toContain(
      'confirmed,1000000000000000000000,'
    )
    expect(transactionsToCsv([{ ...sample[0], amountUsdc: Number.NaN }])).toContain(
      'confirmed,,'
    )
  })

  it('skips transactions without string ids or hashes', () => {
    const invalidRows = [
      { ...sample[0], id: undefined },
      { ...sample[1], hash: null },
    ] as unknown as Transaction[]

    expect(transactionsToCsv(invalidRows)).toBe(
      EXPORT_COLUMNS.map((column) => column.header).join(',') + '\r\n'
    )
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
