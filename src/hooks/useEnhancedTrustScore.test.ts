import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useEnhancedTrustScore } from './useEnhancedTrustScore'
import { isValidStellarAddress } from '../lib/stellar'
import {
  lookupTrustScore,
  getTrustScoreOperationStatus,
  retryTrustScoreLookup,
  cancelTrustScoreLookup,
} from '../lib/trustScoreMutations'
import { getMutationOperations } from '../lib/mutationStorage'
import { mutationRecoveryEngine } from '../lib/mutationRecovery'

vi.mock('../lib/stellar', () => ({
  isValidStellarAddress: vi.fn(),
}))

vi.mock('../lib/trustScoreMutations', () => ({
  lookupTrustScore: vi.fn(),
  getTrustScoreOperationStatus: vi.fn(),
  retryTrustScoreLookup: vi.fn(),
  cancelTrustScoreLookup: vi.fn(),
}))

vi.mock('../lib/mutationStorage', () => ({
  getMutationOperations: vi.fn(),
}))

vi.mock('../lib/mutationRecovery', () => ({
  mutationRecoveryEngine: {
    recoverOperation: vi.fn(),
  },
}))

vi.mock('../lib/log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

const VALID_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
const INVALID_ADDRESS = 'bad-address'

describe('useEnhancedTrustScore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isValidStellarAddress).mockImplementation((addr) => addr === VALID_ADDRESS)
    vi.mocked(getMutationOperations).mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes in idle state for an invalid address', () => {
    const { result } = renderHook(() => useEnhancedTrustScore(INVALID_ADDRESS))

    expect(result.current.data).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.operationId).toBeNull()
    expect(result.current.canRetry).toBe(false)
    expect(result.current.attempts).toBe(0)
    expect(result.current.isRecovered).toBe(false)
  })

  it('sets error when refetch is called with an invalid address', async () => {
    const { result } = renderHook(() => useEnhancedTrustScore(INVALID_ADDRESS))

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.error).toBe('Invalid Stellar address format')
    expect(lookupTrustScore).not.toHaveBeenCalled()
  })

  it('transitions from loading to success on refetch', async () => {
    const mockScore = { address: VALID_ADDRESS, score: 92 } as never
    vi.mocked(lookupTrustScore).mockResolvedValue({
      operationId: 'op-success',
      isNewOperation: true,
    })
    vi.mocked(getTrustScoreOperationStatus).mockReturnValue({
      operationId: 'op-success',
      status: 'success',
      data: mockScore,
      attempts: 1,
      canRetry: false,
    })

    const { result } = renderHook(() =>
      useEnhancedTrustScore(VALID_ADDRESS, { enablePolling: false })
    )

    await act(async () => {
      await result.current.refetch()
    })

    expect(lookupTrustScore).toHaveBeenCalledWith(VALID_ADDRESS, false)
    expect(result.current.operationId).toBe('op-success')

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.data).toEqual(mockScore)
      expect(result.current.error).toBeNull()
    })
  })

  it('transitions to error state with canRetry when operation fails', async () => {
    vi.mocked(lookupTrustScore).mockResolvedValue({
      operationId: 'op-err',
      isNewOperation: true,
    })
    vi.mocked(getTrustScoreOperationStatus).mockReturnValue({
      operationId: 'op-err',
      status: 'error',
      error: 'Temporary failure',
      attempts: 1,
      canRetry: true,
    })

    const { result } = renderHook(() =>
      useEnhancedTrustScore(VALID_ADDRESS, { enablePolling: false })
    )

    await act(async () => {
      await result.current.refresh()
    })

    expect(lookupTrustScore).toHaveBeenCalledWith(VALID_ADDRESS, true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Temporary failure')
      expect(result.current.canRetry).toBe(true)
      expect(result.current.attempts).toBe(1)
    })
  })

  it('handles lookupTrustScore rejection', async () => {
    vi.mocked(lookupTrustScore).mockRejectedValue(new Error('Storage unavailable'))

    const { result } = renderHook(() =>
      useEnhancedTrustScore(VALID_ADDRESS, { enablePolling: false })
    )

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe('Storage unavailable')
  })

  it('supports retry, cancel, and reset actions', async () => {
    vi.mocked(lookupTrustScore).mockResolvedValue({
      operationId: 'op-act',
      isNewOperation: true,
    })
    vi.mocked(getTrustScoreOperationStatus).mockReturnValue({
      operationId: 'op-act',
      status: 'error',
      error: 'Timeout',
      attempts: 1,
      canRetry: true,
    })
    vi.mocked(retryTrustScoreLookup).mockResolvedValue(true)
    vi.mocked(cancelTrustScoreLookup).mockReturnValue(true)

    const { result } = renderHook(() =>
      useEnhancedTrustScore(VALID_ADDRESS, { enablePolling: false })
    )

    // Before any operation, retry and cancel return false
    expect(await result.current.retry()).toBe(false)
    expect(result.current.cancel()).toBe(false)

    await act(async () => {
      await result.current.refetch()
    })

    let retried = false
    await act(async () => {
      retried = await result.current.retry()
    })
    expect(retried).toBe(true)
    expect(retryTrustScoreLookup).toHaveBeenCalledWith('op-act')

    let cancelled = false
    act(() => {
      cancelled = result.current.cancel()
    })
    expect(cancelled).toBe(true)
    expect(cancelTrustScoreLookup).toHaveBeenCalledWith('op-act')

    act(() => {
      result.current.reset()
    })
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.operationId).toBeNull()
    expect(result.current.canRetry).toBe(false)
  })

  it('auto-recovers pending operations on mount', async () => {
    vi.mocked(getMutationOperations).mockReturnValue([
      {
        operationId: 'op-recover',
        type: 'trust_score_lookup',
        status: 'pending',
        isRecovered: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
        requestMetadata: { address: VALID_ADDRESS },
      } as never,
    ])
    vi.mocked(getTrustScoreOperationStatus).mockReturnValue({
      operationId: 'op-recover',
      status: 'pending',
      attempts: 1,
      canRetry: false,
    })
    vi.mocked(mutationRecoveryEngine.recoverOperation).mockResolvedValue(true)

    const { result } = renderHook(() =>
      useEnhancedTrustScore(VALID_ADDRESS, { autoRecover: true, enablePolling: false })
    )

    await waitFor(() => {
      expect(result.current.operationId).toBe('op-recover')
      expect(result.current.isRecovered).toBe(true)
      expect(mutationRecoveryEngine.recoverOperation).toHaveBeenCalledWith('op-recover')
    })
  })
})
