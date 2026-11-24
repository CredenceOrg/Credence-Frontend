import { describe, it, expect } from 'vitest'
import { formatDate } from './WhatsNewDialog'

/**
 * Deterministic boundary coverage for `formatDate` (#1172).
 *
 * `formatDate` parses a date-only ISO string as UTC midnight and renders it with
 * `timeZone: 'UTC'`, so its output must not depend on the machine running the
 * suite. These tests pin the valid boundaries (single-digit month/day, year end,
 * leap day) and the failure boundary (empty / malformed / out-of-range input
 * returns the raw value instead of throwing or printing "Invalid Date").
 */
describe('formatDate (#1172)', () => {
  it('renders a date-only ISO string in UTC', () => {
    expect(formatDate('2024-01-05')).toBe('January 5, 2024')
    expect(formatDate('2024-03-09')).toBe('March 9, 2024')
    expect(formatDate('2024-12-31')).toBe('December 31, 2024')
  })

  it('handles the leap-day boundary', () => {
    expect(formatDate('2024-02-29')).toBe('February 29, 2024')
    // 2023 is not a leap year: the ISO date is out of range and rejected.
    expect(formatDate('2023-02-29')).toBe('2023-02-29')
  })

  it('returns the raw value (never throws) for malformed input', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate('not-a-date')).toBe('not-a-date')
    expect(formatDate('2024-13-01')).toBe('2024-13-01')
    expect(formatDate('2024-00-10')).toBe('2024-00-10')
  })

  it('is deterministic across repeated calls', () => {
    const first = formatDate('2024-06-15')
    expect(formatDate('2024-06-15')).toBe(first)
    expect(first).toBe('June 15, 2024')
  })
})
