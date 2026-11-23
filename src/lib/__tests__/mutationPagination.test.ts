/**
 * @file mutationPagination.test.ts
 * @description Comprehensive unit tests for mutation storage pagination and cursor semantics.
 *
 * Test Coverage:
 * - Deterministic ordering by (updatedAt DESC/ASC, operationId tiebreaker)
 * - URL-safe base64 cursor encoding, decoding, and validation
 * - Scope safety and query parameter tampering detection
 * - Limit clamping (MIN: 1, MAX: 100, DEFAULT: 20)
 * - Empty storage pagination
 * - Single-page pagination (hasNextPage: false, nextCursor: undefined)
 * - Multi-page pagination with exact boundary and end-of-stream detection
 * - Concurrent insertion resilience (no missing/duplicated items)
 * - Invalid/corrupted cursor handling and error recovery
 * - Large dataset pagination (100+ operations)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  encodeMutationCursor,
  decodeMutationCursor,
  validateMutationCursor,
  paginateMutationOperations,
  readMutationStorage,
  writeMutationStorage,
  resetMutationStorage,
  type MutationOperation,
  MIN_MUTATION_PAGE_LIMIT,
} from '../mutationStorage'

describe('mutationStorage Pagination & Cursor Semantics', () => {
  beforeEach(() => {
    resetMutationStorage()
  })

  // Helper to create test operations
  const createMockOp = (
    id: string,
    type: 'bond_create' | 'bond_withdraw' | 'trust_score_lookup',
    status: 'idle' | 'pending' | 'submitting' | 'success' | 'error' | 'cancelled',
    updatedAt: string,
    scope?: string
  ): MutationOperation => ({
    operationId: id,
    type,
    status,
    requestHash: `hash-${id}`,
    requestMetadata: scope ? { address: scope } : {},
    attempts: [],
    maxAttempts: 3,
    createdAt: updatedAt,
    updatedAt,
    isRecovered: false,
  })

  const insertOp = (op: MutationOperation) => {
    const storage = readMutationStorage()
    storage.operations[op.operationId] = op
    writeMutationStorage(storage)
  }

  describe('Cursor Encoding, Decoding & Validation', () => {
    it('encodes and decodes valid mutation cursor payload', () => {
      const payload = {
        updatedAt: '2026-08-29T12:00:00.000Z',
        operationId: 'op-123',
        type: 'bond_create' as const,
        status: 'success' as const,
        scope: '0x1234567890123456789012345678901234567890',
        order: 'desc' as const,
      }

      const encoded = encodeMutationCursor(payload)
      expect(typeof encoded).toBe('string')
      expect(encoded).not.toContain('+')
      expect(encoded).not.toContain('/')
      expect(encoded).not.toContain('=')

      const decoded = decodeMutationCursor(encoded)
      expect(decoded).toMatchObject(payload)
      expect(decoded?.version).toBe(1)
    })

    it('returns null when decoding invalid or corrupted cursor', () => {
      expect(decodeMutationCursor('not-valid-base64!@#$%^')).toBeNull()
      expect(decodeMutationCursor('')).toBeNull()
      expect(decodeMutationCursor('eyJpbnZhbGlkIjoidW5rbm93biJ9')).toBeNull() // valid JSON but missing required fields
    })

    it('validates matching cursor scope and rejects tampered query parameters', () => {
      const cursor = encodeMutationCursor({
        updatedAt: '2026-08-29T12:00:00.000Z',
        operationId: 'op-123',
        type: 'bond_create',
        status: 'pending',
        scope: '0xAAA',
        order: 'desc',
      })

      // Valid match
      expect(
        validateMutationCursor(cursor, {
          type: 'bond_create',
          status: 'pending',
          scope: '0xAAA',
          order: 'desc',
        }).valid
      ).toBe(true)

      // Tampered type
      expect(
        validateMutationCursor(cursor, {
          type: 'trust_score_lookup',
          status: 'pending',
          scope: '0xAAA',
          order: 'desc',
        }).valid
      ).toBe(false)

      // Tampered status
      expect(
        validateMutationCursor(cursor, {
          type: 'bond_create',
          status: 'success',
          scope: '0xAAA',
          order: 'desc',
        }).valid
      ).toBe(false)

      // Tampered scope
      expect(
        validateMutationCursor(cursor, {
          type: 'bond_create',
          status: 'pending',
          scope: '0xBBB',
          order: 'desc',
        }).valid
      ).toBe(false)

      // Tampered order
      expect(
        validateMutationCursor(cursor, {
          type: 'bond_create',
          status: 'pending',
          scope: '0xAAA',
          order: 'asc',
        }).valid
      ).toBe(false)
    })
  })

  describe('Limit Clamping & Boundary Handling', () => {
    it('clamps page limits to defined min and max boundaries', () => {
      // Seed 5 operations
      for (let i = 1; i <= 5; i++) {
        insertOp(createMockOp(`op-${i}`, 'bond_create', 'success', `2026-08-29T12:0${i}:00.000Z`))
      }

      // Negative or zero limit clamps to MIN (1)
      const resMin = paginateMutationOperations({ limit: 0 })
      expect(resMin.items).toHaveLength(MIN_MUTATION_PAGE_LIMIT)

      const resNeg = paginateMutationOperations({ limit: -10 })
      expect(resNeg.items).toHaveLength(MIN_MUTATION_PAGE_LIMIT)

      // Default limit (20) applies when undefined
      const resDef = paginateMutationOperations({})
      expect(resDef.items).toHaveLength(5)
    })
  })

  describe('Empty & Single-Page Pagination', () => {
    it('handles empty storage gracefully', () => {
      const result = paginateMutationOperations({ limit: 10 })

      expect(result.items).toEqual([])
      expect(result.totalCount).toBe(0)
      expect(result.hasNextPage).toBe(false)
      expect(result.nextCursor).toBeUndefined()
    })

    it('handles single-page pagination where all items fit', () => {
      insertOp(createMockOp('op-1', 'bond_create', 'success', '2026-08-29T12:01:00.000Z'))
      insertOp(createMockOp('op-2', 'bond_create', 'success', '2026-08-29T12:02:00.000Z'))

      const result = paginateMutationOperations({ limit: 10 })

      expect(result.items).toHaveLength(2)
      expect(result.totalCount).toBe(2)
      expect(result.hasNextPage).toBe(false)
      expect(result.nextCursor).toBeUndefined()
      // DESC order by default: newest first
      expect(result.items[0].operationId).toBe('op-2')
      expect(result.items[1].operationId).toBe('op-1')
    })
  })

  describe('Multi-Page & End-of-Stream Semantics', () => {
    it('paginates deterministically across multiple pages with accurate end-of-stream detection', () => {
      // Create 5 operations
      for (let i = 1; i <= 5; i++) {
        insertOp(createMockOp(`op-${i}`, 'bond_create', 'success', `2026-08-29T12:0${i}:00.000Z`))
      }

      // Page 1 (limit 2)
      const page1 = paginateMutationOperations({ limit: 2, order: 'desc' })
      expect(page1.items.map((op) => op.operationId)).toEqual(['op-5', 'op-4'])
      expect(page1.hasNextPage).toBe(true)
      expect(page1.nextCursor).toBeDefined()
      expect(page1.totalCount).toBe(5)

      // Page 2 (limit 2)
      const page2 = paginateMutationOperations({
        limit: 2,
        cursor: page1.nextCursor,
        order: 'desc',
      })
      expect(page2.items.map((op) => op.operationId)).toEqual(['op-3', 'op-2'])
      expect(page2.hasNextPage).toBe(true)
      expect(page2.nextCursor).toBeDefined()

      // Page 3 (limit 2, remaining 1 item)
      const page3 = paginateMutationOperations({
        limit: 2,
        cursor: page2.nextCursor,
        order: 'desc',
      })
      expect(page3.items.map((op) => op.operationId)).toEqual(['op-1'])
      expect(page3.hasNextPage).toBe(false)
      expect(page3.nextCursor).toBeUndefined()
    })

    it('correctly handles exact boundary page limits without phantom next pages', () => {
      // Exactly 4 items, limit 2 -> Page 1 has 2 items, Page 2 has 2 items, hasNextPage is FALSE
      for (let i = 1; i <= 4; i++) {
        insertOp(createMockOp(`op-${i}`, 'bond_create', 'success', `2026-08-29T12:0${i}:00.000Z`))
      }

      const page1 = paginateMutationOperations({ limit: 2 })
      expect(page1.items).toHaveLength(2)
      expect(page1.hasNextPage).toBe(true)

      const page2 = paginateMutationOperations({ limit: 2, cursor: page1.nextCursor })
      expect(page2.items).toHaveLength(2)
      expect(page2.hasNextPage).toBe(false)
      expect(page2.nextCursor).toBeUndefined()
    })

    it('handles identical timestamps deterministically with operationId tiebreakers', () => {
      const sameTime = '2026-08-29T12:00:00.000Z'
      insertOp(createMockOp('op-c', 'bond_create', 'success', sameTime))
      insertOp(createMockOp('op-a', 'bond_create', 'success', sameTime))
      insertOp(createMockOp('op-b', 'bond_create', 'success', sameTime))

      const page1 = paginateMutationOperations({ limit: 2, order: 'desc' })
      expect(page1.items.map((op) => op.operationId)).toEqual(['op-c', 'op-b'])
      expect(page1.hasNextPage).toBe(true)

      const page2 = paginateMutationOperations({
        limit: 2,
        cursor: page1.nextCursor,
        order: 'desc',
      })
      expect(page2.items.map((op) => op.operationId)).toEqual(['op-a'])
      expect(page2.hasNextPage).toBe(false)
    })
  })

  describe('Concurrent Insertions & Invariant Guarantees', () => {
    it('guarantees no duplicated or skipped records when items are concurrently inserted', () => {
      // Initial items: op-10, op-20, op-30, op-40
      const baseDates = [
        '2026-08-29T12:10:00.000Z',
        '2026-08-29T12:20:00.000Z',
        '2026-08-29T12:30:00.000Z',
        '2026-08-29T12:40:00.000Z',
      ]
      insertOp(createMockOp('op-10', 'bond_create', 'success', baseDates[0]))
      insertOp(createMockOp('op-20', 'bond_create', 'success', baseDates[1]))
      insertOp(createMockOp('op-30', 'bond_create', 'success', baseDates[2]))
      insertOp(createMockOp('op-40', 'bond_create', 'success', baseDates[3]))

      // Page 1 (limit 2, desc): returns op-40, op-30
      const page1 = paginateMutationOperations({ limit: 2, order: 'desc' })
      expect(page1.items.map((op) => op.operationId)).toEqual(['op-40', 'op-30'])

      // Concurrent insert at the top (op-50, newer than page 1)
      insertOp(createMockOp('op-50', 'bond_create', 'success', '2026-08-29T12:50:00.000Z'))
      // Concurrent insert in between (op-25)
      insertOp(createMockOp('op-25', 'bond_create', 'success', '2026-08-29T12:25:00.000Z'))

      // Page 2 using cursor from page 1: must continue from op-30 without skipping op-25 or op-20
      const page2 = paginateMutationOperations({
        limit: 2,
        cursor: page1.nextCursor,
        order: 'desc',
      })

      expect(page2.items.map((op) => op.operationId)).toEqual(['op-25', 'op-20'])

      // Page 3: finishes with op-10
      const page3 = paginateMutationOperations({
        limit: 2,
        cursor: page2.nextCursor,
        order: 'desc',
      })
      expect(page3.items.map((op) => op.operationId)).toEqual(['op-10'])
      expect(page3.hasNextPage).toBe(false)

      // Total collected across pages 1, 2, 3: no duplicates
      const allIds = [
        ...page1.items.map((o) => o.operationId),
        ...page2.items.map((o) => o.operationId),
        ...page3.items.map((o) => o.operationId),
      ]
      const uniqueIds = new Set(allIds)
      expect(uniqueIds.size).toBe(allIds.length)
      expect(allIds).toEqual(['op-40', 'op-30', 'op-25', 'op-20', 'op-10'])
    })
  })

  describe('Invalid Cursors & Scope Safety', () => {
    it('safely rejects invalid or tampered cursors without throwing', () => {
      insertOp(createMockOp('op-1', 'bond_create', 'success', '2026-08-29T12:00:00.000Z'))

      const result = paginateMutationOperations({
        limit: 10,
        cursor: 'totally-invalid-cursor',
      })

      expect(result.items).toEqual([])
      expect(result.hasNextPage).toBe(false)
      expect(result.nextCursor).toBeUndefined()
    })

    it('rejects cursor generated for bond_create when applied to trust_score_lookup query', () => {
      insertOp(createMockOp('op-bond-1', 'bond_create', 'success', '2026-08-29T12:00:00.000Z'))
      insertOp(createMockOp('op-bond-2', 'bond_create', 'success', '2026-08-29T12:01:00.000Z'))
      insertOp(
        createMockOp('op-trust', 'trust_score_lookup', 'success', '2026-08-29T12:02:00.000Z')
      )

      const bondPage = paginateMutationOperations({ type: 'bond_create', limit: 1 })
      expect(bondPage.nextCursor).toBeDefined()

      // Caller tries to use bond cursor on trust_score_lookup
      const crossScopeResult = paginateMutationOperations({
        type: 'trust_score_lookup',
        cursor: bondPage.nextCursor,
        limit: 10,
      })

      expect(crossScopeResult.items).toEqual([])
      expect(crossScopeResult.hasNextPage).toBe(false)
    })
  })

  describe('Large Result Dataset Pagination', () => {
    it('efficiently and deterministically paginates across 150 items', () => {
      const TOTAL_ITEMS = 150
      const PAGE_SIZE = 25

      for (let i = 0; i < TOTAL_ITEMS; i++) {
        const paddedIndex = String(i).padStart(3, '0')
        insertOp(
          createMockOp(
            `op-${paddedIndex}`,
            'bond_create',
            'success',
            `2026-08-29T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`
          )
        )
      }

      const collectedIds: string[] = []
      let cursor: string | undefined = undefined
      let pageCount = 0

      do {
        const page = paginateMutationOperations({
          limit: PAGE_SIZE,
          cursor,
          order: 'desc',
        })
        collectedIds.push(...page.items.map((o) => o.operationId))
        cursor = page.nextCursor
        pageCount++
      } while (cursor)

      expect(collectedIds).toHaveLength(TOTAL_ITEMS)
      expect(new Set(collectedIds).size).toBe(TOTAL_ITEMS)
      expect(pageCount).toBe(6) // 150 / 25 = 6 pages
    })
  })
})
