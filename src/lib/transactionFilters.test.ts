import { describe, expect, it } from 'vitest'
import type { Transaction } from '../api/types'
import {
  applyTransactionFilters,
  DEFAULT_TRANSACTION_FILTERS,
  parseTransactionFilters,
  serializeTransactionFilters,
} from './transactionFilters'

const items: Transaction[] = [
  {
    id: 'first',
    hash: 'ABC123',
    type: 'bond',
    status: 'confirmed',
    timestamp: '2026-01-15T00:00:00Z',
  },
  {
    id: 'last',
    hash: 'def456',
    type: 'withdraw',
    status: 'failed',
    timestamp: '2026-01-15T23:59:59.999Z',
  },
  {
    id: 'next',
    hash: 'abc789',
    type: 'attestation',
    status: 'pending',
    timestamp: '2026-01-16T00:00:00Z',
  },
]
const parse = (query: string) => parseTransactionFilters(new URLSearchParams(query))

describe('transaction filters', () => {
  it('uses defaults for absent and invalid parameters', () => {
    expect(parse('')).toEqual(DEFAULT_TRANSACTION_FILTERS)
    expect(parse('status=unknown&type=unknown&from=2026-02-30&to=not-a-date')).toEqual(
      DEFAULT_TRANSACTION_FILTERS
    )
    expect(parse('from=2026-02-01&to=2026-01-01')).toEqual(DEFAULT_TRANSACTION_FILTERS)
  })

  it('validates leap days and rejects non-calendar date syntax', () => {
    expect(parse('from=2024-02-29').from).toBe('2024-02-29')
    for (const date of ['2025-02-29', '2026-1-01', '2026-01-01T12:00:00Z', '2026-13-01']) {
      expect(parse(`from=${date}`).from).toBe('')
    }
  })

  it('round trips all filters and preserves unrelated query parameters without mutating the input', () => {
    const current = new URLSearchParams('tab=history&status=failed&status=pending')
    const filters = {
      ...DEFAULT_TRANSACTION_FILTERS,
      status: 'confirmed' as const,
      type: 'bond' as const,
      from: '2026-01-01',
      to: '2026-01-31',
      q: 'ABC & + ?',
    }
    const result = serializeTransactionFilters(filters, current)
    expect(parseTransactionFilters(result)).toEqual(filters)
    expect(result.get('tab')).toBe('history')
    expect(result.getAll('status')).toEqual(['confirmed'])
    expect(current.getAll('status')).toEqual(['failed', 'pending'])
    expect(serializeTransactionFilters(DEFAULT_TRANSACTION_FILTERS, result).toString()).toBe(
      'tab=history'
    )
  })

  it('combines status, type, date and case-insensitive text with AND semantics', () => {
    expect(
      applyTransactionFilters(
        items,
        parse('status=confirmed&type=bond&from=2026-01-15&to=2026-01-15&q=abc')
      )
    ).toEqual([items[0]])
    expect(applyTransactionFilters(items, parse('status=pending&type=bond'))).toEqual([])
  })

  it('includes both date boundaries in UTC and supports open-ended ranges', () => {
    expect(applyTransactionFilters(items, parse('from=2026-01-15&to=2026-01-15'))).toEqual(
      items.slice(0, 2)
    )
    expect(applyTransactionFilters(items, parse('from=2026-01-16'))).toEqual([items[2]])
    expect(applyTransactionFilters(items, parse('to=2026-01-15'))).toEqual(items.slice(0, 2))
    const offset = { ...items[0], timestamp: '2026-01-16T01:00:00+02:00' }
    expect(applyTransactionFilters([offset], parse('to=2026-01-15'))).toEqual([offset])
  })

  it('searches IDs, hashes, types and statuses without interpreting text as a regular expression', () => {
    for (const q of [' FIRST ', 'abc123', 'BOND', 'CONFIRMED']) {
      expect(applyTransactionFilters(items, { ...DEFAULT_TRANSACTION_FILTERS, q })).toEqual([
        items[0],
      ])
    }
    expect(applyTransactionFilters(items, { ...DEFAULT_TRANSACTION_FILTERS, q: '.*' })).toEqual([])
  })

  it('does not mutate rows and ignores invalid timestamps only when a date filter is active', () => {
    const invalid = Object.freeze({ ...items[0], timestamp: 'invalid' })
    const frozen = Object.freeze([invalid])
    expect(applyTransactionFilters(frozen, DEFAULT_TRANSACTION_FILTERS)).toEqual([invalid])
    expect(applyTransactionFilters(frozen, parse('from=2026-01-01'))).toEqual([])
  })
})
