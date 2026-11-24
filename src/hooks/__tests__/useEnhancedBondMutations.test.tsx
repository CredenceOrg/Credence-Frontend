/**
 * @file useEnhancedBondMutations.test.tsx
 * @description Tests for the enhanced bond mutations React hook.
 *
 * Test Coverage:
 * - Hook initialization and state management
 * - Bond creation and withdrawal operations
 * - Recovery system integration
 * - Error handling and retry logic
 * - State synchronization between legacy and enhanced systems
 * - Concurrent operation handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useEnhancedBondMutations } from '../useEnhancedBondMutations'
import * as mutationRecovery from '../../lib/mutationRecovery'
import * as bondActionStorage from '../../lib/bondActionStorage'

// Mock dependencies
vi.mock('../../lib/mutationRecovery')
vi.mock('../../lib/bondActionStorage')
vi.mock('../../lib/log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

describe('useEnhancedBondMutations', () => {
  const mockMutationRecovery = mutationRecovery as typeof mutationRecovery
  const mockBondActionStorage = bondActionStorage as typeof bondActionStorage

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock mutation recovery engine
    mockMutationRecovery.mutationRecoveryEngine = {
      recoverPendingOperations: vi.fn().mockResolvedValue({
        recovered: 0,
        failed: 0,
        operations: [],
      }),
      getRecoveryStatus: vi.fn().mockReturnValue({
        active: [],
        pending: 0,
        failed: 0,
      }),
    }

    // Mock bond action storage
    mockBondActionStorage.readBondActions.mockReturnValue({
      schemaVersion: 1,
      create: { status: 'idle', attempts: 0 },
      withdraw: { status: 'idle', attempts: 0 },
    })

    mockBondActionStorage.getBondActionMutationOperation.mockReturnValue(null)

    mockBondActionStorage.createEnhancedBondAction.mockResolvedValue({
      legacyUpdated: {},
      operationId: 'test-op-123',
      isNewOperation: true,
    })
  })

  describe('initialization', () => {
    it('initializes with idle state when no existing operations', async () => {
      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.status).toBe('idle')
        expect(result.current.withdraw.status).toBe('idle')
        expect(result.current.hasActiveOperations).toBe(false)
      })
    })

    it('recovers existing operations on mount', async () => {
      mockBondActionStorage.getBondActionMutationOperation
        .mockReturnValueOnce({
          operationId: 'create-op',
          type: 'bond_create',
          status: 'pending',
          attempts: [],
          requestMetadata: { amountUsdc: 1000 },
          isRecovered: true,
        })
        .mockReturnValueOnce(null)

      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.status).toBe('pending')
        expect(result.current.create.operationId).toBe('create-op')
        expect(result.current.create.isActive).toBe(true)
        expect(result.current.hasActiveOperations).toBe(true)
      })

      expect(
        mockMutationRecovery.mutationRecoveryEngine.recoverPendingOperations
      ).toHaveBeenCalled()
    })

    it('displays recovery status during initialization', async () => {
      mockMutationRecovery.mutationRecoveryEngine.recoverPendingOperations.mockResolvedValue({
        recovered: 2,
        failed: 0,
        operations: ['op-1', 'op-2'],
      })

      const { result } = renderHook(() => useEnhancedBondMutations())

      // Initially should show recovering
      expect(result.current.recoveryStatus.isRecovering).toBe(true)

      await waitFor(() => {
        expect(result.current.recoveryStatus.isRecovering).toBe(false)
        expect(result.current.recoveryStatus.recoveredCount).toBe(2)
      })
    })
  })

  describe('bond creation', () => {
    it('creates bond operation successfully', async () => {
      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.status).toBe('idle')
      })

      await act(async () => {
        const operationId = await result.current.actions.createBond(1000)
        expect(operationId).toBe('test-op-123')
      })

      expect(mockBondActionStorage.createEnhancedBondAction).toHaveBeenCalledWith('create', {
        amountUsdc: 1000,
      })
    })

    it('prevents concurrent bond creation', async () => {
      mockBondActionStorage.getBondActionMutationOperation.mockReturnValue({
        operationId: 'active-create',
        type: 'bond_create',
        status: 'submitting',
        attempts: [],
        requestMetadata: { amountUsdc: 1000 },
        isRecovered: false,
      })

      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.isActive).toBe(true)
      })

      await act(async () => {
        // Should not create new operation while one is active
        const promise = result.current.actions.createBond(2000)
        await expect(promise).resolves.toBeUndefined()
      })

      expect(mockBondActionStorage.createEnhancedBondAction).not.toHaveBeenCalled()
    })

    it('handles bond creation errors gracefully', async () => {
      mockBondActionStorage.createEnhancedBondAction.mockRejectedValue(
        new Error('Insufficient funds')
      )

      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.status).toBe('idle')
      })

      await act(async () => {
        await expect(result.current.actions.createBond(1000)).rejects.toThrow('Insufficient funds')
      })
    })
  })

  describe('bond withdrawal', () => {
    it('withdraws bond operation successfully', async () => {
      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.withdraw.status).toBe('idle')
      })

      await act(async () => {
        const operationId = await result.current.actions.withdrawBond(123, 500)
        expect(operationId).toBe('test-op-123')
      })

      expect(mockBondActionStorage.createEnhancedBondAction).toHaveBeenCalledWith('withdraw', {
        bondId: 123,
        amountUsdc: 500,
      })
    })

    it('prevents concurrent bond withdrawal', async () => {
      mockBondActionStorage.getBondActionMutationOperation
        .mockReturnValueOnce(null) // create
        .mockReturnValue({
          // withdraw
          operationId: 'active-withdraw',
          type: 'bond_withdraw',
          status: 'pending',
          attempts: [],
          requestMetadata: { bondId: 123, amountUsdc: 500 },
          isRecovered: false,
        })

      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.withdraw.isActive).toBe(true)
      })

      await act(async () => {
        // Should not create new operation while one is active
        const promise = result.current.actions.withdrawBond(456, 1000)
        await expect(promise).resolves.toBeUndefined()
      })

      expect(mockBondActionStorage.createEnhancedBondAction).not.toHaveBeenCalled()
    })
  })

  describe('retry and cancel operations', () => {
    it('retries failed operations', async () => {
      mockBondActionStorage.getBondActionMutationOperation.mockReturnValue({
        operationId: 'failed-op',
        type: 'bond_create',
        status: 'error',
        attempts: [{ attemptId: '1', status: 'error', error: { retryable: true } }],
        requestMetadata: { amountUsdc: 1000 },
        maxAttempts: 3,
        isRecovered: false,
      })

      mockMutationRecovery.retryMutation.mockResolvedValue(true)

      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.canRetry).toBe(true)
      })

      await act(async () => {
        const success = await result.current.actions.retry()
        expect(success).toBe(true)
      })

      expect(mockMutationRecovery.retryMutation).toHaveBeenCalledWith('failed-op')
    })

    it('cancels active operations', async () => {
      mockBondActionStorage.getBondActionMutationOperation.mockReturnValue({
        operationId: 'active-op',
        type: 'bond_create',
        status: 'pending',
        attempts: [],
        requestMetadata: { amountUsdc: 1000 },
        isRecovered: false,
      })

      mockMutationRecovery.cancelMutation.mockReturnValue(true)

      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.isActive).toBe(true)
      })

      act(() => {
        const cancelled = result.current.actions.cancel()
        expect(cancelled).toBe(true)
      })

      expect(mockMutationRecovery.cancelMutation).toHaveBeenCalledWith('active-op')
    })

    it('handles retry when no active operation', async () => {
      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.status).toBe('idle')
      })

      await act(async () => {
        const success = await result.current.actions.retry()
        expect(success).toBe(false)
      })
    })

    it('handles cancel when no active operation', async () => {
      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.status).toBe('idle')
      })

      act(() => {
        const cancelled = result.current.actions.cancel()
        expect(cancelled).toBe(false)
      })
    })
  })

  describe('state synchronization', () => {
    it('updates state from operation changes', async () => {
      let mockOperation = {
        operationId: 'sync-test',
        type: 'bond_create',
        status: 'pending',
        attempts: [],
        requestMetadata: { amountUsdc: 1000 },
        isRecovered: false,
      }

      mockBondActionStorage.getBondActionMutationOperation.mockReturnValue(mockOperation)

      const { result, rerender } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.status).toBe('pending')
        expect(result.current.create.isActive).toBe(true)
      })

      // Simulate operation completion
      mockOperation = {
        ...mockOperation,
        status: 'success',
        finalTxHash: 'success-hash-123',
        completedAt: '2024-01-01T00:05:00.000Z',
      } as unknown as ReturnType<typeof getBondActionMutationOperation>

      mockBondActionStorage.getBondActionMutationOperation.mockReturnValue(mockOperation)

      // Force update
      rerender()

      await waitFor(() => {
        expect(result.current.create.status).toBe('success')
        expect(result.current.create.isActive).toBe(false)
        expect(result.current.create.txHash).toBe('success-hash-123')
      })
    })

    it('synchronizes with legacy storage state', async () => {
      // Start with legacy storage showing pending
      mockBondActionStorage.readBondActions.mockReturnValue({
        schemaVersion: 1,
        create: {
          status: 'pending',
          attempts: 1,
          lastAttemptAt: '2024-01-01T00:00:00.000Z',
        },
        withdraw: { status: 'idle', attempts: 0 },
      })

      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        // Should start in pending state based on legacy storage
        expect(result.current.create.status).toBe('pending')
      })
    })
  })

  describe('polling for active operations', () => {
    it('polls for updates when operations are active', async () => {
      let callCount = 0
      mockBondActionStorage.getBondActionMutationOperation.mockImplementation(() => {
        callCount++
        if (callCount <= 2) {
          return {
            operationId: 'polling-test',
            type: 'bond_create',
            status: 'submitting',
            attempts: [],
            requestMetadata: { amountUsdc: 1000 },
            isRecovered: false,
          }
        } else {
          return {
            operationId: 'polling-test',
            type: 'bond_create',
            status: 'success',
            attempts: [],
            requestMetadata: { amountUsdc: 1000 },
            finalTxHash: 'polling-success-hash',
            isRecovered: false,
          }
        }
      })

      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.status).toBe('submitting')
        expect(result.current.create.isActive).toBe(true)
      })

      // Wait for polling to detect completion
      await waitFor(
        () => {
          expect(result.current.create.status).toBe('success')
          expect(result.current.create.isActive).toBe(false)
        },
        { timeout: 3000 }
      )

      expect(callCount).toBeGreaterThan(2)
    })

    it('stops polling when operations complete', async () => {
      mockBondActionStorage.getBondActionMutationOperation.mockReturnValue({
        operationId: 'completed-op',
        type: 'bond_create',
        status: 'success',
        attempts: [],
        requestMetadata: { amountUsdc: 1000 },
        finalTxHash: 'completed-hash',
        isRecovered: false,
      })

      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.status).toBe('success')
        expect(result.current.create.isActive).toBe(false)
      })

      const initialCallCount =
        mockBondActionStorage.getBondActionMutationOperation.mock.calls.length

      // Wait a bit to ensure polling has stopped
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const finalCallCount = mockBondActionStorage.getBondActionMutationOperation.mock.calls.length

      // Should not have made many additional calls after completion
      expect(finalCallCount - initialCallCount).toBeLessThan(3)
    })
  })

  describe('reset functionality', () => {
    it('resets all operations to idle state', async () => {
      mockBondActionStorage.getBondActionMutationOperation.mockReturnValue({
        operationId: 'reset-test',
        type: 'bond_create',
        status: 'error',
        attempts: [{ attemptId: '1', status: 'error' }],
        requestMetadata: { amountUsdc: 1000 },
        isRecovered: false,
      })

      const { result } = renderHook(() => useEnhancedBondMutations())

      await waitFor(() => {
        expect(result.current.create.status).toBe('error')
      })

      act(() => {
        result.current.actions.reset()
      })

      expect(mockBondActionStorage.updateBondAction).toHaveBeenCalledWith(
        'create',
        expect.any(Function)
      )
      expect(mockBondActionStorage.updateBondAction).toHaveBeenCalledWith(
        'withdraw',
        expect.any(Function)
      )
    })
  })
})
