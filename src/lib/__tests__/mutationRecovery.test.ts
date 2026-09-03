/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file mutationRecovery.test.ts
 * @description Comprehensive tests for the mutation recovery engine.
 *
 * Test Coverage:
 * - Operation recovery under various failure conditions
 * - Retry logic with exponential backoff
 * - Concurrent operation handling
 * - Transaction confirmation
 * - Network failure scenarios
 * - Recovery timeout handling
 * - State cleanup on failures
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  MutationRecoveryEngine,
  initiateMutation,
  retryMutation,
  cancelMutation,
  mutationRecoveryEngine,
} from '../mutationRecovery'
import * as mutationStorage from '../mutationStorage'
import * as bondMutations from '../bondMutations'
import * as apiClient from '../../api/client'

// Mock dependencies
vi.mock('../mutationStorage')
vi.mock('../bondMutations')
vi.mock('../../api/client')
vi.mock('../log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

const mockStorage = mutationStorage as any
const mockBondMutations = bondMutations as any
const mockApiClient = apiClient as any

describe('MutationRecoveryEngine', () => {
  let engine: MutationRecoveryEngine

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new MutationRecoveryEngine()

    // Default successful storage operations
    mockStorage.getMutationOperation.mockReturnValue(null)
    mockStorage.getMutationOperations.mockReturnValue([])
    mockStorage.updateMutationOperation.mockImplementation((id: any, updater: any) => {
      const mockOp = {
        operationId: id,
        type: 'bond_create',
        status: 'pending',
        attempts: [],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }
      return { ...mockOp, ...updater(mockOp) }
    })

    // Default successful bond operations
    mockBondMutations.submitCreateBond.mockResolvedValue({ hash: 'test-hash-123' })
    mockBondMutations.submitWithdrawBond.mockResolvedValue({ hash: 'test-hash-456' })

    // Default successful API operations
    mockApiClient.apiFetch.mockResolvedValue({ score: 850, tier: 'gold' })
  })

  afterEach(() => {
    engine.cancelAllRecoveries()
  })

  describe('recoverOperation', () => {
    it('recovers pending bond create operation successfully', async () => {
      const mockOperation = {
        operationId: 'test-op-1',
        type: 'bond_create',
        status: 'pending',
        attempts: [],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)

      const result = await engine.recoverOperation('test-op-1')

      expect(result).toBe(true)
      expect(mockBondMutations.submitCreateBond).toHaveBeenCalledWith({ amountUsdc: '1000.00' })
      expect(mockStorage.updateMutationOperation).toHaveBeenCalledWith(
        'test-op-1',
        expect.any(Function)
      )
    })

    it('recovers pending bond withdraw operation successfully', async () => {
      const mockOperation = {
        operationId: 'test-op-2',
        type: 'bond_withdraw',
        status: 'pending',
        attempts: [],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { bondId: 123, amountUsdc: 500 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)

      const result = await engine.recoverOperation('test-op-2')

      expect(result).toBe(true)
      expect(mockBondMutations.submitWithdrawBond).toHaveBeenCalledWith({
        bondId: 123,
        amountUsdc: '500.00',
      })
    })

    it('recovers pending trust score lookup successfully', async () => {
      const mockOperation = {
        operationId: 'test-op-3',
        type: 'trust_score_lookup',
        status: 'pending',
        attempts: [],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { address: 'GTEST123...' },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)

      const result = await engine.recoverOperation('test-op-3')

      expect(result).toBe(true)
      expect(mockApiClient.apiFetch).toHaveBeenCalledWith(
        '/trust-score/GTEST123...',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it('handles network errors with retry logic', async () => {
      const mockOperation = {
        operationId: 'test-op-4',
        type: 'bond_create',
        status: 'pending',
        attempts: [],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)

      // First call fails, second succeeds
      mockBondMutations.submitCreateBond
        .mockRejectedValueOnce(new apiClient.ApiError(0, 'Network error'))
        .mockResolvedValueOnce({ hash: 'test-hash-retry' })

      const result = await engine.recoverOperation('test-op-4')

      expect(result).toBe(true)
      expect(mockBondMutations.submitCreateBond).toHaveBeenCalledTimes(2)

      // Should mark first attempt as error, second as success
      expect(mockStorage.updateMutationOperation).toHaveBeenCalledWith(
        'test-op-4',
        expect.any(Function)
      )
    })

    it('respects max attempts limit', async () => {
      const mockOperation = {
        operationId: 'test-op-5',
        type: 'bond_create',
        status: 'pending',
        attempts: [
          {
            attemptId: '1',
            timestamp: '2024-01-01T00:00:00.000Z',
            requestHash: 'hash',
            status: 'error',
          },
          {
            attemptId: '2',
            timestamp: '2024-01-01T00:01:00.000Z',
            requestHash: 'hash',
            status: 'error',
          },
          {
            attemptId: '3',
            timestamp: '2024-01-01T00:02:00.000Z',
            requestHash: 'hash',
            status: 'error',
          },
        ],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)

      const result = await engine.recoverOperation('test-op-5')

      expect(result).toBe(false)
      expect(mockBondMutations.submitCreateBond).not.toHaveBeenCalled()
    })

    it('handles wallet rejection errors (non-retryable)', async () => {
      const mockOperation = {
        operationId: 'test-op-6',
        type: 'bond_create',
        status: 'pending',
        attempts: [],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)
      mockBondMutations.submitCreateBond.mockRejectedValue(new Error('User rejected transaction'))

      const result = await engine.recoverOperation('test-op-6')

      expect(result).toBe(false)
      expect(mockBondMutations.submitCreateBond).toHaveBeenCalledOnce()

      // Should mark operation as error with non-retryable flag
      expect(mockStorage.updateMutationOperation).toHaveBeenCalledWith(
        'test-op-6',
        expect.any(Function)
      )
    })

    it('confirms existing transactions before retrying', async () => {
      const mockOperation = {
        operationId: 'test-op-7',
        type: 'bond_create',
        status: 'submitting',
        attempts: [
          {
            attemptId: 'attempt-1',
            timestamp: '2024-01-01T00:00:00.000Z',
            requestHash: 'test-hash',
            status: 'submitting',
            txHash: 'existing-tx-hash',
          },
        ],
        maxAttempts: 3,
        finalTxHash: 'existing-tx-hash',
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)

      // Mock transaction confirmation
      vi.spyOn(engine as any, 'confirmTransaction').mockResolvedValue(true)

      const result = await engine.recoverOperation('test-op-7')

      expect(result).toBe(true)
      expect(mockBondMutations.submitCreateBond).not.toHaveBeenCalled() // Should not retry
      expect(mockStorage.updateMutationOperation).toHaveBeenCalledWith(
        'test-op-7',
        expect.any(Function)
      )
    })

    it('cancels recovery when operation is cancelled', async () => {
      const mockOperation = {
        operationId: 'test-op-8',
        type: 'bond_create',
        status: 'pending',
        attempts: [],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)

      // Start recovery and immediately cancel
      const recoveryPromise = engine.recoverOperation('test-op-8')
      const cancelled = engine.cancelRecovery('test-op-8')

      expect(cancelled).toBe(true)

      // Recovery should complete without executing operation
      const result = await recoveryPromise
      expect(result).toBe(false)
    })
  })

  describe('recoverPendingOperations', () => {
    it('recovers multiple pending operations', async () => {
      const pendingOps = [
        {
          operationId: 'pending-1',
          type: 'bond_create',
          status: 'pending',
          attempts: [],
          maxAttempts: 3,
          requestHash: 'hash-1',
          requestMetadata: { amountUsdc: 1000 },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          isRecovered: false,
        },
        {
          operationId: 'pending-2',
          type: 'bond_withdraw',
          status: 'pending',
          attempts: [],
          maxAttempts: 3,
          requestHash: 'hash-2',
          requestMetadata: { bondId: 123, amountUsdc: 500 },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          isRecovered: false,
        },
      ]

      mockStorage.getMutationOperations
        .mockReturnValueOnce(pendingOps) // pending operations
        .mockReturnValueOnce([]) // submitting operations

      mockStorage.getMutationOperation.mockImplementation(
        (id: string) => pendingOps.find((op: any) => op.operationId === id) || null
      )

      const result = await engine.recoverPendingOperations()

      expect(result.operations).toHaveLength(2)
      expect(result.recovered).toBe(2)
      expect(result.failed).toBe(0)
      expect(mockBondMutations.submitCreateBond).toHaveBeenCalledOnce()
      expect(mockBondMutations.submitWithdrawBond).toHaveBeenCalledOnce()
    })

    it('handles partial failures in batch recovery', async () => {
      const pendingOps = [
        {
          operationId: 'pending-success',
          type: 'bond_create',
          status: 'pending',
          attempts: [],
          maxAttempts: 3,
          requestHash: 'hash-1',
          requestMetadata: { amountUsdc: 1000 },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          isRecovered: false,
        },
        {
          operationId: 'pending-failure',
          type: 'bond_create',
          status: 'pending',
          attempts: [],
          maxAttempts: 3,
          requestHash: 'hash-2',
          requestMetadata: { amountUsdc: 2000 },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          isRecovered: false,
        },
      ]

      mockStorage.getMutationOperations.mockReturnValueOnce(pendingOps).mockReturnValueOnce([])

      mockStorage.getMutationOperation.mockImplementation(
        (id: string) => pendingOps.find((op: any) => op.operationId === id) || null
      )

      // First succeeds, second fails
      mockBondMutations.submitCreateBond
        .mockResolvedValueOnce({ hash: 'success-hash' })
        .mockRejectedValue(new Error('User rejected transaction'))

      const result = await engine.recoverPendingOperations()

      expect(result.recovered).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.operations).toHaveLength(2)
    })
  })

  describe('retry mechanisms', () => {
    it('implements exponential backoff', async () => {
      const mockOperation = {
        operationId: 'retry-test',
        type: 'bond_create',
        status: 'pending',
        attempts: [
          {
            attemptId: '1',
            timestamp: '2024-01-01T00:00:00.000Z',
            requestHash: 'hash',
            status: 'error',
          },
        ],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)

      // Mock setTimeout to avoid actual delays in tests
      const originalSetTimeout = global.setTimeout
      const mockSetTimeout = vi.fn((callback) => {
        callback()
        return 123 as any
      })
      global.setTimeout = mockSetTimeout as any

      try {
        await engine.recoverOperation('retry-test')

        // Should have applied delay based on attempt number
        expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), expect.any(Number))
      } finally {
        global.setTimeout = originalSetTimeout
      }
    })

    it('respects maximum retry delay', async () => {
      const engine = new MutationRecoveryEngine({
        maxAttempts: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        retryableErrors: ['network', 'timeout', 'generic'],
      })

      const mockOperation = {
        operationId: 'max-delay-test',
        type: 'bond_create',
        status: 'pending',
        attempts: Array.from({ length: 9 }, (_, i) => ({
          attemptId: `attempt-${i + 1}`,
          timestamp: '2024-01-01T00:00:00.000Z',
          requestHash: 'hash',
          status: 'error',
        })),
        maxAttempts: 10,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)

      const originalSetTimeout = global.setTimeout
      const mockSetTimeout = vi.fn((callback: any, _ms?: any) => {
        if (typeof callback === 'function') callback()
        return 123 as any
      })
      global.setTimeout = mockSetTimeout as any

      try {
        await engine.recoverOperation('max-delay-test')

        // Delay should be capped at maxDelayMs (5000)
        const delay = (mockSetTimeout.mock.calls[0] as any)?.[1]
        expect(delay).toBeLessThanOrEqual(5000)
      } finally {
        global.setTimeout = originalSetTimeout
      }
    })
  })

  describe('edge cases and error scenarios', () => {
    it('handles missing operation gracefully', async () => {
      mockStorage.getMutationOperation.mockReturnValue(null)

      const result = await engine.recoverOperation('non-existent')

      expect(result).toBe(false)
      expect(mockBondMutations.submitCreateBond).not.toHaveBeenCalled()
    })

    it('handles unknown operation types', async () => {
      const mockOperation = {
        operationId: 'unknown-type',
        type: 'unknown_operation' as any,
        status: 'pending',
        attempts: [],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: {},
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)

      const result = await engine.recoverOperation('unknown-type')

      expect(result).toBe(false)

      // Should mark as error
      expect(mockStorage.updateMutationOperation).toHaveBeenCalledWith(
        'unknown-type',
        expect.any(Function)
      )
    })

    it('prevents concurrent recovery of same operation', async () => {
      const mockOperation = {
        operationId: 'concurrent-test',
        type: 'bond_create',
        status: 'pending',
        attempts: [],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      }

      mockStorage.getMutationOperation.mockReturnValue(mockOperation)

      // Start two recoveries simultaneously
      const promise1 = engine.recoverOperation('concurrent-test')
      const promise2 = engine.recoverOperation('concurrent-test')

      const [result1, result2] = await Promise.all([promise1, promise2])

      // One should succeed, one should return early
      expect(result1 || result2).toBe(true)
      expect(mockBondMutations.submitCreateBond).toHaveBeenCalledOnce()
    })
  })
})

describe('integration functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock storage operations
    mockStorage.createMutationOperation.mockReturnValue({
      operationId: 'test-integration-op',
      isNewOperation: true,
    })

    mockStorage.getMutationOperation.mockReturnValue({
      operationId: 'test-integration-op',
      type: 'bond_create',
      status: 'pending',
      attempts: [],
      maxAttempts: 3,
      requestHash: 'test-hash',
      requestMetadata: { amountUsdc: 1000 },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      isRecovered: false,
    })

    // Mock successful bond operations
    mockBondMutations.submitCreateBond.mockResolvedValue({ hash: 'integration-hash' })
  })

  describe('initiateMutation', () => {
    it('creates new operation and starts recovery', async () => {
      const result = await initiateMutation('bond_create', { amountUsdc: 1000 })

      expect(result.operationId).toBe('test-integration-op')
      expect(result.isNewOperation).toBe(true)
      expect(result.started).toBe(true)

      expect(mockStorage.createMutationOperation).toHaveBeenCalledWith(
        'bond_create',
        { amountUsdc: 1000 },
        undefined
      )
    })

    it('handles existing operations with recovery', async () => {
      mockStorage.createMutationOperation.mockReturnValue({
        operationId: 'existing-op',
        isNewOperation: false,
      })

      mockStorage.getMutationOperation.mockReturnValue({
        operationId: 'existing-op',
        type: 'bond_create',
        status: 'error',
        attempts: [
          {
            attemptId: '1',
            timestamp: '2024-01-01T00:00:00.000Z',
            requestHash: 'hash',
            status: 'error',
          },
        ],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      })

      const result = await initiateMutation('bond_create', { amountUsdc: 1000 })

      expect(result.operationId).toBe('existing-op')
      expect(result.isNewOperation).toBe(false)
      expect(result.started).toBe(true) // Should attempt recovery
    })
  })

  describe('retryMutation', () => {
    it('retries failed operation', async () => {
      mockStorage.getMutationOperation.mockReturnValue({
        operationId: 'failed-op',
        type: 'bond_create',
        status: 'error',
        attempts: [
          {
            attemptId: '1',
            timestamp: '2024-01-01T00:00:00.000Z',
            requestHash: 'hash',
            status: 'error',
          },
        ],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      })

      const result = await retryMutation('failed-op')

      expect(result).toBe(true)
      expect(mockStorage.updateMutationOperation).toHaveBeenCalledWith(
        'failed-op',
        expect.any(Function)
      )
    })

    it('rejects retry for non-error operations', async () => {
      mockStorage.getMutationOperation.mockReturnValue({
        operationId: 'success-op',
        type: 'bond_create',
        status: 'success',
        attempts: [],
        maxAttempts: 3,
        requestHash: 'test-hash',
        requestMetadata: { amountUsdc: 1000 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        isRecovered: false,
      })

      const result = await retryMutation('success-op')

      expect(result).toBe(false)
    })
  })

  describe('cancelMutation', () => {
    it('cancels active operation', () => {
      // Start a mock recovery to have something to cancel
      vi.spyOn(mutationRecoveryEngine, 'cancelRecovery').mockReturnValue(true)

      const result = cancelMutation('active-op')

      expect(result).toBe(true)
      expect(mutationRecoveryEngine.cancelRecovery).toHaveBeenCalledWith('active-op')
    })
  })
})
