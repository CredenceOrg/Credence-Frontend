import { describe, it, expect } from 'vitest'
import { scrubPII, scrubTelemetryPII, PIIScrubError } from './piiScrub'

// ---------------------------------------------------------------------------
// Happy path — non-PII data is returned unchanged (structurally equal)
// ---------------------------------------------------------------------------

describe('scrubPII — happy path', () => {
  it('returns_primitives_unchanged', () => {
    expect(scrubPII(42)).toBe(42)
    expect(scrubPII(true)).toBe(true)
    expect(scrubPII(null)).toBe(null)
    expect(scrubPII(undefined)).toBe(undefined)
  })

  it('returns_non_pii_object_unchanged', () => {
    const input = { id: 1, trustScore: 87, label: 'recent-activity' }
    expect(scrubPII(input)).toEqual(input)
  })

  it('returns_a_deep_clone_not_the_same_reference', () => {
    const input = { nested: { id: 1 } }
    const result = scrubPII(input)
    expect(result).toEqual(input)
    expect(result).not.toBe(input)
    expect(result.nested).not.toBe(input.nested)
  })

  it('leaves_non_email_strings_untouched', () => {
    const input = { note: 'trust score recalculated after audit' }
    expect(scrubPII(input)).toEqual(input)
  })
})

// ---------------------------------------------------------------------------
// PII redaction — the actual fix
// ---------------------------------------------------------------------------

describe('scrubPII — redacts known PII', () => {
  it('redacts_known_pii_field_names_at_the_top_level', () => {
    const input = {
      id: 1,
      email: 'alice@example.com',
      fullName: 'Alice Smith',
      phone: '+1-555-0100',
    }
    const result = scrubPII(input)
    expect(result.id).toBe(1)
    expect(result.email).toBe('[REDACTED]')
    expect(result.fullName).toBe('[REDACTED]')
    expect(result.phone).toBe('[REDACTED]')
  })

  it('redacts_pii_fields_nested_inside_objects_and_arrays', () => {
    const input = {
      widget: 'issuer-dashboard',
      recentActivity: [
        { id: 1, actor: { fullName: 'Bob Jones', email: 'bob@example.com' } },
        { id: 2, actor: { fullName: 'Carol Reed', email: 'carol@example.com' } },
      ],
    }
    const result = scrubPII(input)
    expect(result.recentActivity[0].actor.fullName).toBe('[REDACTED]')
    expect(result.recentActivity[0].actor.email).toBe('[REDACTED]')
    expect(result.recentActivity[1].actor.fullName).toBe('[REDACTED]')
    expect(result.recentActivity[1].actor.email).toBe('[REDACTED]')
    // Non-PII sibling data survives.
    expect(result.widget).toBe('issuer-dashboard')
    expect(result.recentActivity[0].id).toBe(1)
  })

  it('redacts_email_shaped_strings_even_under_an_unrelated_key_name', () => {
    // Defense in depth: PII can leak through fields the allowlist doesn't
    // anticipate (e.g. a free-text "notes" field).
    const input = { notes: 'contact was ceo@example.com about the bond' }
    const result = scrubPII(input)
    expect(result.notes).toBe('[REDACTED]')
  })

  it('is_case_insensitive_on_pii_key_names', () => {
    const input = { Email: 'a@b.com', FULLNAME: 'A B' }
    const result = scrubPII(input) as Record<string, unknown>
    expect(result.Email).toBe('[REDACTED]')
    expect(result.FULLNAME).toBe('[REDACTED]')
  })
})

// ---------------------------------------------------------------------------
// Explicit failure mode — negative test.
// Before this fix, `WidgetCacheStore` stored fetcher results directly with
// no scrubbing step at all, so a circular payload was simply cached by
// reference (no crash, but no PII protection either — and no typed way to
// reject data that can't be safely cached). This test locks in the new,
// intentional failure mode: a typed, catchable error.
// ---------------------------------------------------------------------------

describe('scrubPII — explicit failure mode', () => {
  it('throws_a_typed_pii_scrub_error_for_circular_data_instead_of_caching_it_raw', () => {
    const circular: Record<string, unknown> = { id: 1 }
    circular.self = circular

    expect(() => scrubPII(circular)).toThrow(PIIScrubError)
    expect(() => scrubPII(circular)).toThrow(/circular/i)
  })
})

// ---------------------------------------------------------------------------
// Telemetry scrubbing — used by `src/lib/errorReporting.ts` before events are
// handed to Sentry. Unlike `scrubPII` it must never throw: a crash report is
// worth more than a perfectly sanitised payload, but it must not leak
// addresses, emails or amounts.
// ---------------------------------------------------------------------------

describe('scrubTelemetryPII', () => {
  const WALLET = `G${'A'.repeat(55)}`
  const CONTRACT = `C${'B'.repeat(55)}`

  it('redacts Stellar account and contract addresses inside free-form text', () => {
    const input = {
      message: `Bond ${WALLET} failed while calling ${CONTRACT}`,
      stack: `at transfer(${WALLET}:12:3)`,
    }

    const result = scrubTelemetryPII(input)

    expect(result.message).not.toContain(WALLET)
    expect(result.message).not.toContain(CONTRACT)
    expect(result.stack).not.toContain(WALLET)
    expect(result.message).toContain('[REDACTED]')
  })

  it('redacts addresses nested inside arrays and objects', () => {
    const input = {
      extra: { bonds: [{ borrower: WALLET, status: 'active' }] },
      tags: [WALLET],
    }

    const serialized = JSON.stringify(scrubTelemetryPII(input))

    expect(serialized).not.toContain(WALLET)
    expect(serialized).toContain('active')
  })

  it('redacts amount and balance keys while keeping unrelated context', () => {
    const input = {
      amount: '1250.00',
      amountUsdc: 99,
      balance: '7',
      totals: { totalAmount: '12' },
      route: '/bond/42',
    }

    const result = scrubTelemetryPII(input) as Record<string, unknown>

    expect(result.amount).toBe('[REDACTED]')
    expect(result.amountUsdc).toBe('[REDACTED]')
    expect(result.balance).toBe('[REDACTED]')
    expect((result.totals as Record<string, unknown>).totalAmount).toBe('[REDACTED]')
    expect(result.route).toBe('/bond/42')
  })

  it('redacts classic PII keys and email-shaped strings', () => {
    const input = { email: 'user@example.com', note: 'contact me at a@b.co' }

    const result = scrubTelemetryPII(input) as Record<string, unknown>

    expect(result.email).toBe('[REDACTED]')
    // Free-form text keeps its readable shape; only the address is replaced.
    expect(result.note).toBe('contact me at [REDACTED]')
  })

  it('reduces Error instances to their class name and a scrubbed message', () => {
    const input = { cause: new TypeError(`bad address ${WALLET}`), label: 'submit' }

    const result = scrubTelemetryPII(input) as {
      cause: { name: string; message: string }
      label: string
    }

    expect(result.cause).not.toBeInstanceOf(Error)
    expect(result.cause.name).toBe('TypeError')
    expect(result.cause.message).not.toContain(WALLET)
    expect(result.label).toBe('submit')
  })

  it('survives circular structures instead of throwing', () => {
    const circular: Record<string, unknown> = { id: 1 }
    circular.self = circular

    const result = scrubTelemetryPII(circular) as Record<string, unknown>

    expect(result.self).toBe('[Circular]')
  })

  it('does not mutate the input object', () => {
    const input = { borrower: WALLET, amount: '5' }

    scrubTelemetryPII(input)

    expect(input.borrower).toBe(WALLET)
    expect(input.amount).toBe('5')
  })

  it('leaves benign primitives and class instances untouched', () => {
    const date = new Date('2026-01-01T00:00:00.000Z')
    const input = { retries: 2, ok: false, at: date }

    const result = scrubTelemetryPII(input)

    expect(result.retries).toBe(2)
    expect(result.ok).toBe(false)
    expect(result.at).toBe(date)
  })
})
