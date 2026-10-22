import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTransactions } from './useTransactions'
import { apiFetch, ApiSessionConflictError, advanceIdentityEpoch, resetIdentityEpoch } from '../api/client'
import type { Transaction } from '../api/types'
import { migrateToV2, scopedKey, PENDING_TXS_LEGACY_KEY, PENDING_TXS_V1_KEY } from '../lib/pendingTransactionsStorage'

// Mock API client
vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

// Mock contexts
vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    address: mockWalletAddress,
    network: mockWalletNetwork,
  }),
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    network: mockSettingsNetwork,
  }),
}))

let mockWalletAddress = ''
let mockWalletNetwork: 'public' | 'test' | null = null
let mockSettingsNetwork: 'public' | 'test' = 'public'

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id ?? 'id-1',
    type: overrides.type ?? 'bond',
    timestamp: overrides.timestamp ?? new Date('2026-01-01T00:00:00Z').toISOString(),
    status: overrides.status ?? 'confirmed',
    hash: overrides.hash ?? 'hash-1',
    amountUsdc: overrides.amountUsdc,
  }
}

describe('useTransactions identity scoping', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    resetIdentityEpoch()
    mockWalletAddress = ''
    mockWalletNetwork = null
    mockSettingsNetwork = 'public'
  })

  it('disconnected state does not call apiFetch and returns empty list with isLoading=false', async () => {
    const mockedApiFetch = vi.mocked(apiFetch)
    mockedApiFetch.mockResolvedValue({ items: [], nextCursor: undefined })

    const { result } = renderHook(() => useTransactions())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockedApiFetch).not.toHaveBeenCalled()
    expect(result.current.data).toEqual([])
    expect(result.current.error).toBe(null)
  })

  it('account switch A→B triggers exactly one new /transactions request and shows only B items', async () => {
    const mockedApiFetch = vi.mocked(apiFetch)
    mockedApiFetch.mockResolvedValue({ items: [tx({ id: 'tx-b' })], nextCursor: undefined })

    // Start with account A
    mockWalletAddress = 'GA…A'
    mockWalletNetwork = 'test'
    const { result, rerender } = renderHook(() => useTransactions())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockedApiFetch).toHaveBeenCalledTimes(1)
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data[0].id).toBe('tx-b')

    // Switch to account B
    mockedApiFetch.mockClear()
    mockWalletAddress = 'GB…B'
    advanceIdentityEpoch()
    rerender()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Exactly one new request for B
    expect(mockedApiFetch).toHaveBeenCalledTimes(1)
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/transactions?limit=20',
      expect.objectContaining({
        identityEpoch: expect.any(Number),
      })
    )
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data[0].id).toBe('tx-b')
  })

  it('response for A that resolves after switch to B is discarded silently', async () => {
    const mockedApiFetch = vi.mocked(apiFetch)

    // Create a delayed response for account A
    let resolveA: (value: { items: Transaction[]; nextCursor?: string }) => void
    const promiseA = new Promise<{ items: Transaction[]; nextCursor?: string }>((resolve) => {
      resolveA = resolve
    })
    mockedApiFetch.mockReturnValue(promiseA)

    // Start with account A
    mockWalletAddress = 'GA…A'
    mockWalletNetwork = 'test'
    const { result, rerender } = renderHook(() => useTransactions())

    // Switch to account B before A's response arrives
    mockedApiFetch.mockResolvedValue({ items: [tx({ id: 'tx-b' })], nextCursor: undefined })
    mockWalletAddress = 'GB…B'
    advanceIdentityEpoch()
    rerender()

    // Resolve A's stale response
    resolveA!({ items: [tx({ id: 'tx-a' })], nextCursor: undefined })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // A's data should not appear
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data[0].id).toBe('tx-b')
    expect(result.current.error).toBe(null)
  })

  it('ApiSessionConflictError is discarded silently', async () => {
    const mockedApiFetch = vi.mocked(apiFetch)
    mockedApiFetch.mockRejectedValue(
      new ApiSessionConflictError(1, 2, 'Session changed during request')
    )

    mockWalletAddress = 'GA…A'
    mockWalletNetwork = 'test'

    const { result } = renderHook(() => useTransactions())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Error should be discarded, not shown to user
    expect(result.current.error).toBe(null)
    expect(result.current.data).toEqual([])
  })

  it('addPendingTransaction under A, switch to B, then back to A shows A pending row again', async () => {
    const mockedApiFetch = vi.mocked(apiFetch)
    mockedApiFetch.mockResolvedValue({ items: [], nextCursor: undefined })

    // Account A: add pending transaction
    mockWalletAddress = 'GA…A'
    mockWalletNetwork = 'test'
    const { result, rerender } = renderHook(() => useTransactions())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    result.current.addPendingTransaction(tx({ id: 'pending-a', hash: 'hash-a' }))

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1)
    })
    expect(result.current.data[0].id).toBe('pending-a')

    // Switch to account B
    mockedApiFetch.mockClear()
    mockedApiFetch.mockResolvedValue({ items: [tx({ id: 'server-b' })], nextCursor: undefined })
    mockWalletAddress = 'GB…B'
    advanceIdentityEpoch()
    rerender()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // B should only see server items, not A's pending
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data[0].id).toBe('server-b')

    // Switch back to A
    mockedApiFetch.mockClear()
    mockedApiFetch.mockResolvedValue({ items: [], nextCursor: undefined })
    mockWalletAddress = 'GA…A'
    advanceIdentityEpoch()
    rerender()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // A should see pending row again
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data[0].id).toBe('pending-a')
  })

  it('network switch test→public clears cache and refetches', async () => {
    const mockedApiFetch = vi.mocked(apiFetch)
    mockedApiFetch.mockResolvedValue({ items: [tx({ id: 'tx-test' })], nextCursor: undefined })

    // Start on testnet
    mockWalletAddress = 'GA…A'
    mockWalletNetwork = 'test'
    mockSettingsNetwork = 'test'
    const { result, rerender } = renderHook(() => useTransactions())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data[0].id).toBe('tx-test')

    // Switch to public
    mockedApiFetch.mockClear()
    mockedApiFetch.mockResolvedValue({ items: [tx({ id: 'tx-public' })], nextCursor: undefined })
    mockWalletNetwork = 'public'
    mockSettingsNetwork = 'public'
    advanceIdentityEpoch()
    rerender()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Should refetch for public network
    expect(mockedApiFetch).toHaveBeenCalledTimes(1)
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data[0].id).toBe('tx-public')
  })

  it('legacy key is removed after first mount', async () => {
    const mockedApiFetch = vi.mocked(apiFetch)
    mockedApiFetch.mockResolvedValue({ items: [], nextCursor: undefined })

    // Set up legacy v1 data
    localStorage.setItem(
      PENDING_TXS_V1_KEY,
      JSON.stringify({ schemaVersion: 1, items: [tx({ id: 'legacy' })] })
    )
    localStorage.setItem(PENDING_TXS_LEGACY_KEY, JSON.stringify([tx({ id: 'legacy-0' })]))

    mockWalletAddress = 'GA…A'
    mockWalletNetwork = 'public'

    renderHook(() => useTransactions())

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalled()
    })

    // Legacy keys should be cleared
    expect(localStorage.getItem(PENDING_TXS_V1_KEY)).toBeNull()
    expect(localStorage.getItem(PENDING_TXS_LEGACY_KEY)).toBeNull()

    // Data should be migrated to scoped v2 key
    const v2Key = scopedKey('public', 'GA…A')
    expect(v2Key).not.toBeNull()
    const v2Data = JSON.parse(localStorage.getItem(v2Key!)!)
    expect(v2Data.schemaVersion).toBe(2)
    expect(v2Data.items).toHaveLength(1)
    expect(v2Data.items[0].id).toBe('legacy')
    expect(v2Data.items[0]._network).toBe('public')
  })

  it('pending transactions are scoped by (network, address)', async () => {
    const mockedApiFetch = vi.mocked(apiFetch)
    mockedApiFetch.mockResolvedValue({ items: [], nextCursor: undefined })

    // Account A on testnet
    mockWalletAddress = 'GA…A'
    mockWalletNetwork = 'test'
    const { result, rerender } = renderHook(() => useTransactions())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    result.current.addPendingTransaction(tx({ id: 'pending-a-test', hash: 'hash-a-test' }))

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1)
    })

    // Account B on testnet should not see A's pending
    mockedApiFetch.mockClear()
    mockWalletAddress = 'GB…B'
    advanceIdentityEpoch()
    rerender()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toHaveLength(0)

    // Account A on public should not see testnet pending
    mockedApiFetch.mockClear()
    mockWalletAddress = 'GA…A'
    mockWalletNetwork = 'public'
    mockSettingsNetwork = 'public'
    advanceIdentityEpoch()
    rerender()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toHaveLength(0)
  })
})
