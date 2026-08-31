/**
 * State-transition invariant regression tests — QE-2026-08
 *
 * Covers every legal edge plus stale, repeated, skipped, and out-of-order
 * transitions.  All assertions operate at the actual integration boundary:
 * the exported helpers from `src/events/schema.ts` that are consumed by
 * the ActivityTimeline surface and its parent mutation paths.
 *
 * Design invariants verified here
 * ────────────────────────────────
 * 1. Every legal transition is accepted.
 * 2. Every illegal transition throws before any state is mutated.
 * 3. The `accepted` terminal state has no outbound transitions.
 * 4. Unknown / misspelled status values are rejected at both ends.
 * 5. Repeated (idempotent re-submission) transitions are illegal and throw.
 * 6. Skipped transitions (bypassing in-review) are illegal.
 * 7. Out-of-order (reverse) transitions are illegal.
 * 8. `isLegalTransition` mirrors `assertLegalTransition` without throwing.
 * 9. `LEGAL_TRANSITIONS` is exhaustive — every known status has an entry.
 * 10. `resolveItemStatus` prefers explicit status over tone fallback.
 * 11. New `eventVersion` and `correlationId` fields round-trip on ActivityItem.
 */

import { describe, it, expect } from 'vitest'
import {
  ATTESTATION_STATUSES,
  LEGAL_TRANSITIONS,
  assertLegalTransition,
  isLegalTransition,
  statusToTone,
  toneToStatus,
  type AttestationStatus,
  type ActivityItem,
} from '../events'
import { resolveItemStatus } from './ActivityTimeline'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_STATUSES = Object.values(ATTESTATION_STATUSES) as AttestationStatus[]

function makeItem(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: 'test-item',
    timestamp: 'Jun 20, 10:00 UTC',
    title: 'Test event',
    description: 'A test event.',
    actor: 'Tester',
    statusLabel: 'In review',
    tone: 'info',
    meta: 'meta-value',
    status: ATTESTATION_STATUSES.IN_REVIEW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. LEGAL_TRANSITIONS matrix — structural completeness
// ---------------------------------------------------------------------------

describe('LEGAL_TRANSITIONS matrix', () => {
  it('has an entry for every known AttestationStatus', () => {
    for (const s of ALL_STATUSES) {
      expect(LEGAL_TRANSITIONS).toHaveProperty(s)
    }
  })

  it('contains only known statuses as targets', () => {
    for (const targets of Object.values(LEGAL_TRANSITIONS)) {
      for (const t of targets) {
        expect(ALL_STATUSES).toContain(t)
      }
    }
  })

  it('accepted is terminal — zero outbound transitions', () => {
    expect(LEGAL_TRANSITIONS[ATTESTATION_STATUSES.ACCEPTED]).toHaveLength(0)
  })

  it('in-review has exactly two legal targets: accepted and needs-update', () => {
    expect(LEGAL_TRANSITIONS[ATTESTATION_STATUSES.IN_REVIEW]).toEqual(
      expect.arrayContaining([
        ATTESTATION_STATUSES.ACCEPTED,
        ATTESTATION_STATUSES.NEEDS_UPDATE,
      ])
    )
    expect(LEGAL_TRANSITIONS[ATTESTATION_STATUSES.IN_REVIEW]).toHaveLength(2)
  })

  it('needs-update has exactly one legal target: in-review', () => {
    expect(LEGAL_TRANSITIONS[ATTESTATION_STATUSES.NEEDS_UPDATE]).toEqual([
      ATTESTATION_STATUSES.IN_REVIEW,
    ])
  })
})

// ---------------------------------------------------------------------------
// 2. isLegalTransition — every legal edge
// ---------------------------------------------------------------------------

describe('isLegalTransition — legal edges', () => {
  it.each([
    [ATTESTATION_STATUSES.IN_REVIEW, ATTESTATION_STATUSES.ACCEPTED],
    [ATTESTATION_STATUSES.IN_REVIEW, ATTESTATION_STATUSES.NEEDS_UPDATE],
    [ATTESTATION_STATUSES.NEEDS_UPDATE, ATTESTATION_STATUSES.IN_REVIEW],
  ] as [AttestationStatus, AttestationStatus][])(
    'returns true for %s → %s',
    (from, to) => {
      expect(isLegalTransition(from, to)).toBe(true)
    }
  )
})

// ---------------------------------------------------------------------------
// 3. isLegalTransition — illegal edges (reverse, skipped, terminal, repeated)
// ---------------------------------------------------------------------------

describe('isLegalTransition — illegal edges', () => {
  it.each([
    // Reverse / out-of-order
    [ATTESTATION_STATUSES.ACCEPTED, ATTESTATION_STATUSES.IN_REVIEW],
    [ATTESTATION_STATUSES.ACCEPTED, ATTESTATION_STATUSES.NEEDS_UPDATE],
    [ATTESTATION_STATUSES.NEEDS_UPDATE, ATTESTATION_STATUSES.ACCEPTED],
    // Repeated (same-to-same)
    [ATTESTATION_STATUSES.IN_REVIEW, ATTESTATION_STATUSES.IN_REVIEW],
    [ATTESTATION_STATUSES.NEEDS_UPDATE, ATTESTATION_STATUSES.NEEDS_UPDATE],
    [ATTESTATION_STATUSES.ACCEPTED, ATTESTATION_STATUSES.ACCEPTED],
  ] as [AttestationStatus, AttestationStatus][])(
    'returns false for %s → %s',
    (from, to) => {
      expect(isLegalTransition(from, to)).toBe(false)
    }
  )
})

// ---------------------------------------------------------------------------
// 4. assertLegalTransition — accepts every legal edge without throwing
// ---------------------------------------------------------------------------

describe('assertLegalTransition — legal edges do not throw', () => {
  it.each([
    [ATTESTATION_STATUSES.IN_REVIEW, ATTESTATION_STATUSES.ACCEPTED],
    [ATTESTATION_STATUSES.IN_REVIEW, ATTESTATION_STATUSES.NEEDS_UPDATE],
    [ATTESTATION_STATUSES.NEEDS_UPDATE, ATTESTATION_STATUSES.IN_REVIEW],
  ] as [AttestationStatus, AttestationStatus][])(
    'does not throw for %s → %s',
    (from, to) => {
      expect(() => assertLegalTransition(from, to)).not.toThrow()
    }
  )
})

// ---------------------------------------------------------------------------
// 5. assertLegalTransition — throws on every illegal transition
//    Verifies that no state mutation can occur before the guard fires.
// ---------------------------------------------------------------------------

describe('assertLegalTransition — illegal transitions throw RangeError', () => {
  it.each([
    // Reverse / out-of-order
    [ATTESTATION_STATUSES.ACCEPTED, ATTESTATION_STATUSES.IN_REVIEW,     'terminal'],
    [ATTESTATION_STATUSES.ACCEPTED, ATTESTATION_STATUSES.NEEDS_UPDATE,  'terminal'],
    [ATTESTATION_STATUSES.NEEDS_UPDATE, ATTESTATION_STATUSES.ACCEPTED,  'skipped'],
    // Repeated (idempotent re-submission is not a valid transition)
    [ATTESTATION_STATUSES.IN_REVIEW,    ATTESTATION_STATUSES.IN_REVIEW,    'repeated'],
    [ATTESTATION_STATUSES.NEEDS_UPDATE, ATTESTATION_STATUSES.NEEDS_UPDATE, 'repeated'],
    [ATTESTATION_STATUSES.ACCEPTED,     ATTESTATION_STATUSES.ACCEPTED,     'repeated'],
  ] as [AttestationStatus, AttestationStatus, string][])(
    'throws for %s → %s (%s)',
    (from, to) => {
      expect(() => assertLegalTransition(from, to)).toThrow(RangeError)
    }
  )

  it('error message names both states for an illegal transition', () => {
    expect(() =>
      assertLegalTransition(ATTESTATION_STATUSES.ACCEPTED, ATTESTATION_STATUSES.IN_REVIEW)
    ).toThrow(/accepted.*in-review|in-review.*accepted/)
  })

  it('leaves no side-effect: object is unchanged after a thrown transition', () => {
    const item = makeItem({ status: ATTESTATION_STATUSES.ACCEPTED })
    const snapshot = { ...item }

    expect(() =>
      assertLegalTransition(item.status!, ATTESTATION_STATUSES.IN_REVIEW)
    ).toThrow(RangeError)

    // The item itself must be completely unchanged.
    expect(item).toEqual(snapshot)
  })
})

// ---------------------------------------------------------------------------
// 6. Unknown / misspelled status values are rejected
// ---------------------------------------------------------------------------

describe('assertLegalTransition — unknown status values', () => {
  it('throws for unknown source status', () => {
    expect(() =>
      assertLegalTransition('bogus' as AttestationStatus, ATTESTATION_STATUSES.ACCEPTED)
    ).toThrow(RangeError)
  })

  it('throws for unknown target status', () => {
    expect(() =>
      assertLegalTransition(ATTESTATION_STATUSES.IN_REVIEW, 'bogus' as AttestationStatus)
    ).toThrow(RangeError)
  })

  it('throws for both source and target unknown', () => {
    expect(() =>
      assertLegalTransition('foo' as AttestationStatus, 'bar' as AttestationStatus)
    ).toThrow(RangeError)
  })

  it('error message identifies the unknown source value', () => {
    expect(() =>
      assertLegalTransition('pending' as AttestationStatus, ATTESTATION_STATUSES.ACCEPTED)
    ).toThrow(/pending/)
  })

  it('isLegalTransition returns false for unknown statuses without throwing', () => {
    expect(
      isLegalTransition('pending' as AttestationStatus, ATTESTATION_STATUSES.ACCEPTED)
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 7. Stale / concurrent write protection
//    The guard must prevent a stale (superseded) response from overwriting
//    a later terminal state.
// ---------------------------------------------------------------------------

describe('stale and concurrent write protection', () => {
  it('rejects a stale in-review→needs-update when item has already reached accepted', () => {
    // Item has already reached the terminal accepted state (e.g. from a faster response).
    const currentStatus = ATTESTATION_STATUSES.ACCEPTED
    const staleTargetStatus = ATTESTATION_STATUSES.NEEDS_UPDATE

    expect(() => assertLegalTransition(currentStatus, staleTargetStatus)).toThrow(RangeError)
  })

  it('rejects a stale in-review→accepted when item has already reached accepted', () => {
    expect(() =>
      assertLegalTransition(ATTESTATION_STATUSES.ACCEPTED, ATTESTATION_STATUSES.ACCEPTED)
    ).toThrow(RangeError)
  })

  it('accepts a fresh needs-update→in-review after a failed prior attempt', () => {
    // Simulates a re-submission after an earlier correction cycle.
    expect(() =>
      assertLegalTransition(ATTESTATION_STATUSES.NEEDS_UPDATE, ATTESTATION_STATUSES.IN_REVIEW)
    ).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// 8. resolveItemStatus — integration boundary for the timeline surface
// ---------------------------------------------------------------------------

describe('resolveItemStatus — status resolution at the timeline boundary', () => {
  it('returns the explicit status when present (all three legal values)', () => {
    for (const s of ALL_STATUSES) {
      const item = makeItem({ status: s, tone: 'warning' })
      expect(resolveItemStatus(item)).toBe(s)
    }
  })

  it('falls back to toneToStatus when status is absent', () => {
    const item = makeItem({ status: undefined, tone: 'success' })
    expect(resolveItemStatus(item)).toBe(ATTESTATION_STATUSES.ACCEPTED)
  })

  it('fallback is consistent with toneToStatus for all tones', () => {
    const tones = ['success', 'warning', 'info'] as const
    for (const tone of tones) {
      const item = makeItem({ status: undefined, tone })
      expect(resolveItemStatus(item)).toBe(toneToStatus(tone))
    }
  })

  it('explicit status takes priority over a mismatched tone', () => {
    // tone says "success" but status says "needs-update" — status wins.
    const item = makeItem({ status: ATTESTATION_STATUSES.NEEDS_UPDATE, tone: 'success' })
    expect(resolveItemStatus(item)).toBe(ATTESTATION_STATUSES.NEEDS_UPDATE)
  })
})

// ---------------------------------------------------------------------------
// 9. statusToTone / toneToStatus roundtrip consistency
// ---------------------------------------------------------------------------

describe('statusToTone / toneToStatus — bidirectional consistency', () => {
  it.each(ALL_STATUSES)('roundtrips %s → tone → status', (status) => {
    expect(toneToStatus(statusToTone(status))).toBe(status)
  })
})

// ---------------------------------------------------------------------------
// 10. ActivityItem interface — eventVersion and correlationId fields
// ---------------------------------------------------------------------------

describe('ActivityItem — eventVersion and correlationId fields', () => {
  it('accepts an item without eventVersion or correlationId (backward compat)', () => {
    const item: ActivityItem = makeItem()
    expect(item.eventVersion).toBeUndefined()
    expect(item.correlationId).toBeUndefined()
  })

  it('round-trips eventVersion on an ActivityItem', () => {
    const item: ActivityItem = makeItem({ eventVersion: '1.0' })
    expect(item.eventVersion).toBe('1.0')
  })

  it('round-trips correlationId on an ActivityItem', () => {
    const item: ActivityItem = makeItem({ correlationId: 'corr-001' })
    expect(item.correlationId).toBe('corr-001')
  })

  it('carries both eventVersion and correlationId independently', () => {
    const item: ActivityItem = makeItem({ eventVersion: '2.0', correlationId: 'corr-xyz' })
    expect(item.eventVersion).toBe('2.0')
    expect(item.correlationId).toBe('corr-xyz')
  })
})

// ---------------------------------------------------------------------------
// 11. Full lifecycle walk — valid and invalid paths
// ---------------------------------------------------------------------------

describe('full lifecycle walk', () => {
  it('valid path: in-review → accepted', () => {
    let status: AttestationStatus = ATTESTATION_STATUSES.IN_REVIEW
    expect(() => {
      assertLegalTransition(status, ATTESTATION_STATUSES.ACCEPTED)
      status = ATTESTATION_STATUSES.ACCEPTED
    }).not.toThrow()
    expect(status).toBe(ATTESTATION_STATUSES.ACCEPTED)
  })

  it('valid path: in-review → needs-update → in-review → accepted', () => {
    let status: AttestationStatus = ATTESTATION_STATUSES.IN_REVIEW

    assertLegalTransition(status, ATTESTATION_STATUSES.NEEDS_UPDATE)
    status = ATTESTATION_STATUSES.NEEDS_UPDATE

    assertLegalTransition(status, ATTESTATION_STATUSES.IN_REVIEW)
    status = ATTESTATION_STATUSES.IN_REVIEW

    assertLegalTransition(status, ATTESTATION_STATUSES.ACCEPTED)
    status = ATTESTATION_STATUSES.ACCEPTED

    expect(status).toBe(ATTESTATION_STATUSES.ACCEPTED)
  })

  it('invalid path: accepted → in-review is blocked and status is unchanged', () => {
    let status: AttestationStatus = ATTESTATION_STATUSES.ACCEPTED

    expect(() => {
      assertLegalTransition(status, ATTESTATION_STATUSES.IN_REVIEW)
      // This line must never execute:
      status = ATTESTATION_STATUSES.IN_REVIEW
    }).toThrow(RangeError)

    // Status must remain at accepted — no partial write.
    expect(status).toBe(ATTESTATION_STATUSES.ACCEPTED)
  })

  it('invalid path: needs-update → accepted is blocked (skipped in-review)', () => {
    let status: AttestationStatus = ATTESTATION_STATUSES.NEEDS_UPDATE

    expect(() => {
      assertLegalTransition(status, ATTESTATION_STATUSES.ACCEPTED)
      status = ATTESTATION_STATUSES.ACCEPTED
    }).toThrow(RangeError)

    expect(status).toBe(ATTESTATION_STATUSES.NEEDS_UPDATE)
  })
})
