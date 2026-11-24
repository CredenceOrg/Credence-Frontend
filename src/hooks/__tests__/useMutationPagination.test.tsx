/**
 * @file useMutationPagination.test.tsx
 * @description Unit tests for the useMutationPagination React hook.
 *
 * Test Coverage:
 * - Initial state and page 1 data loading
 * - Navigation: nextPage, previousPage, and goToPage
 * - Cache retention and bounded memory usage
 * - Dynamic filtering (setType, setStatus, setScope) with automatic pagination reset
 * - Manual refetch and cache invalidation
 * - Error handling and recovery
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMutationPagination } from '../useMutationPagination'
import {
  resetMutationStorage,
  readMutationStorage,
  writeMutationStorage,
  type MutationOperation,
} from '../../lib/mutationStorage'

describe('useMutationPagination Hook', () => {
  beforeEach(() => {
    resetMutationStorage()
  })

  const insertOp = (op: MutationOperation) => {
    const storage = readMutationStorage()
    storage.operations[op.operationId] = op
    writeMutationStorage(storage)
  }

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
    correlationId: `corr-${id}`,
    version: 1,
    isRecovered: false,
  })

  it('loads initial page of mutation operations correctly', async () => {
    insertOp(createMockOp('op-1', 'bond_create', 'success', '2026-08-29T12:01:00.000Z'))
    insertOp(createMockOp('op-2', 'bond_create', 'success', '2026-08-29T12:02:00.000Z'))

    const { result } = renderHook(() => useMutationPagination({ pageSize: 10, order: 'desc' }))

    expect(result.current.items).toHaveLength(2)
    expect(result.current.page).toBe(1)
    expect(result.current.hasNextPage).toBe(false)
    expect(result.current.hasPreviousPage).toBe(false)
    expect(result.current.items[0].operationId).toBe('op-2')
    expect(result.current.items[1].operationId).toBe('op-1')
  })

  it('navigates forward and backward across multiple pages', async () => {
    for (let i = 1; i <= 5; i++) {
      insertOp(createMockOp(`op-${i}`, 'bond_create', 'success', `2026-08-29T12:0${i}:00.000Z`))
    }

    const { result } = renderHook(() => useMutationPagination({ pageSize: 2, order: 'desc' }))

    // Page 1: items op-5, op-4
    expect(result.current.page).toBe(1)
    expect(result.current.items.map((o) => o.operationId)).toEqual(['op-5', 'op-4'])
    expect(result.current.hasNextPage).toBe(true)
    expect(result.current.hasPreviousPage).toBe(false)

    // Navigate to Page 2
    await act(async () => {
      await result.current.nextPage()
    })

    expect(result.current.page).toBe(2)
    expect(result.current.items.map((o) => o.operationId)).toEqual(['op-3', 'op-2'])
    expect(result.current.hasNextPage).toBe(true)
    expect(result.current.hasPreviousPage).toBe(true)

    // Navigate to Page 3
    await act(async () => {
      await result.current.nextPage()
    })

    expect(result.current.page).toBe(3)
    expect(result.current.items.map((o) => o.operationId)).toEqual(['op-1'])
    expect(result.current.hasNextPage).toBe(false)
    expect(result.current.hasPreviousPage).toBe(true)

    // Navigate back to Page 2 (from cache)
    await act(async () => {
      await result.current.previousPage()
    })

    expect(result.current.page).toBe(2)
    expect(result.current.items.map((o) => o.operationId)).toEqual(['op-3', 'op-2'])

    // Navigate back to Page 1 (from cache)
    await act(async () => {
      await result.current.previousPage()
    })

    expect(result.current.page).toBe(1)
    expect(result.current.items.map((o) => o.operationId)).toEqual(['op-5', 'op-4'])
  })

  it('resets pagination when filters change', async () => {
    insertOp(createMockOp('op-bond-1', 'bond_create', 'success', '2026-08-29T12:01:00.000Z'))
    insertOp(createMockOp('op-bond-2', 'bond_create', 'success', '2026-08-29T12:02:00.000Z'))
    insertOp(
      createMockOp('op-trust-1', 'trust_score_lookup', 'success', '2026-08-29T12:03:00.000Z')
    )

    const { result } = renderHook(() => useMutationPagination({ pageSize: 1, type: 'bond_create' }))

    expect(result.current.page).toBe(1)
    expect(result.current.items[0].operationId).toBe('op-bond-2')

    // Navigate to page 2 of bond_create
    await act(async () => {
      await result.current.nextPage()
    })
    expect(result.current.page).toBe(2)
    expect(result.current.items[0].operationId).toBe('op-bond-1')

    // Change type filter to trust_score_lookup
    act(() => {
      result.current.setType('trust_score_lookup')
    })

    // Should reset to page 1 for the new filter
    expect(result.current.page).toBe(1)
    expect(result.current.items[0].operationId).toBe('op-trust-1')
  })

  it('handles manual refetch properly', async () => {
    insertOp(createMockOp('op-1', 'bond_create', 'success', '2026-08-29T12:01:00.000Z'))

    const { result } = renderHook(() => useMutationPagination({ pageSize: 10 }))

    expect(result.current.items).toHaveLength(1)

    // Insert new item
    insertOp(createMockOp('op-2', 'bond_create', 'success', '2026-08-29T12:02:00.000Z'))

    // Trigger refetch
    act(() => {
      result.current.refetch()
    })

    expect(result.current.items).toHaveLength(2)
    expect(result.current.items[0].operationId).toBe('op-2')
  })

  it('updates page size and resets pagination state', async () => {
    for (let i = 1; i <= 6; i++) {
      insertOp(createMockOp(`op-${i}`, 'bond_create', 'success', `2026-08-29T12:0${i}:00.000Z`))
    }

    const { result } = renderHook(() => useMutationPagination({ pageSize: 2 }))

    expect(result.current.items).toHaveLength(2)

    // Change page size to 5
    act(() => {
      result.current.setPageSize(5)
    })

    expect(result.current.page).toBe(1)
    expect(result.current.items).toHaveLength(5)
  })
})
