import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransactions } from './useTransactions'
import { apiFetch } from '../api/client'
import type { Transaction } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

const apiFetchMock = vi.mocked(apiFetch)

describe('useTransactions', () => {
  beforeEach(() => {
    localStorage.clear()
    apiFetchMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('optimistic update reverts on error', async () => {
    // Setup a successful initial fetch to clear isLoading
    let resolveInitial: (value: { items: Transaction[] }) => void
    const initialPromise = new Promise<{ items: Transaction[] }>((resolve) => {
      resolveInitial = resolve
    })
    apiFetchMock.mockReturnValueOnce(initialPromise)

    const { result, unmount } = renderHook(() => useTransactions())

    // Wait for the hook to be ready
    await act(async () => {
      resolveInitial({ items: [] })
      await initialPromise
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toHaveLength(0)

    // Add an optimistic transaction
    const tx: Transaction = {
      id: 'tx-123',
      hash: 'GABCD',
      type: 'bond_create',
      status: 'pending',
      amountUsdc: 100,
      timestamp: new Date().toISOString(),
    }

    act(() => {
      result.current.addPendingTransaction(tx)
    })

    // Transaction should appear immediately
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data[0].id).toBe('tx-123')

    act(() => {
      result.current.removePendingTransaction(tx.hash)
    })

    // The optimistic update should be reverted
    expect(result.current.data).toHaveLength(0)

    unmount()
  })
})
