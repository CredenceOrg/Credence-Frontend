import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  lookupTrustScore,
  getTrustScoreOperationStatus,
  retryTrustScoreLookup,
  cancelTrustScoreLookup,
  lookupTrustScoresBatch,
  createEnhancedTrustScoreLookup,
} from './trustScoreMutations'
import { isValidStellarAddress } from './stellar'
import { initiateMutation, mutationRecoveryEngine } from './mutationRecovery'
import { getMutationOperation, updateMutationOperation } from './mutationStorage'
import { logInfo, logWarn } from './log'

vi.mock('./stellar', () => ({
  isValidStellarAddress: vi.fn(),
}))

vi.mock('./mutationRecovery', () => ({
  initiateMutation: vi.fn(),
  mutationRecoveryEngine: {
    recoverOperation: vi.fn(),
    cancelRecovery: vi.fn(),
  },
}))

vi.mock('./mutationStorage', () => ({
  getMutationOperation: vi.fn(),
  updateMutationOperation: vi.fn(),
}))

vi.mock('./log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

const VALID_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
const INVALID_ADDRESS = 'invalid-address'

describe('trustScoreMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isValidStellarAddress).mockImplementation((addr) => addr === VALID_ADDRESS)
  })

  describe('lookupTrustScore', () => {
    it('throws an error for an invalid Stellar address', async () => {
      await expect(lookupTrustScore(INVALID_ADDRESS)).rejects.toThrow(
        'Invalid Stellar address format'
      )
      expect(initiateMutation).not.toHaveBeenCalled()
    })

    it('initiates a new trust_score_lookup mutation for a valid address', async () => {
      vi.mocked(initiateMutation).mockResolvedValue({
        operationId: 'op-123',
        isNewOperation: true,
        started: true,
      })

      const result = await lookupTrustScore(VALID_ADDRESS)

      expect(initiateMutation).toHaveBeenCalledWith(
        'trust_score_lookup',
        { address: VALID_ADDRESS },
        3
      )
      expect(result).toEqual({
        operationId: 'op-123',
        isNewOperation: true,
      })
      expect(logWarn).not.toHaveBeenCalled()
    })

    it('logs a warning if the mutation fails to start', async () => {
      vi.mocked(initiateMutation).mockResolvedValue({
        operationId: 'op-456',
        isNewOperation: false,
        started: false,
      })

      const result = await lookupTrustScore(VALID_ADDRESS, true)

      expect(result).toEqual({
        operationId: 'op-456',
        isNewOperation: false,
      })
      expect(logWarn).toHaveBeenCalledWith('trust_score_lookup_failed_to_start', {
        operationId: 'op-456',
        address: VALID_ADDRESS,
      })
    })
  })

  describe('getTrustScoreOperationStatus', () => {
    it('returns null when operation does not exist', () => {
      vi.mocked(getMutationOperation).mockReturnValue(null)
      expect(getTrustScoreOperationStatus('missing-op')).toBeNull()
    })

    it('returns null when operation type is not trust_score_lookup', () => {
      vi.mocked(getMutationOperation).mockReturnValue({
        operationId: 'op-other',
        type: 'bond_creation' as never,
        status: 'pending',
        attempts: [],
        maxAttempts: 3,
      } as never)

      expect(getTrustScoreOperationStatus('op-other')).toBeNull()
    })

    it('returns status with canRetry=true for retryable error under maxAttempts', () => {
      vi.mocked(getMutationOperation).mockReturnValue({
        operationId: 'op-1',
        type: 'trust_score_lookup',
        status: 'error',
        maxAttempts: 3,
        attempts: [
          {
            attemptNumber: 1,
            timestamp: '2026-01-01T00:00:00.000Z',
            error: { message: 'Network timeout', retryable: true },
          },
        ],
      } as never)

      expect(getTrustScoreOperationStatus('op-1')).toEqual({
        operationId: 'op-1',
        status: 'error',
        data: undefined,
        error: 'Network timeout',
        attempts: 1,
        canRetry: true,
        lastAttemptAt: '2026-01-01T00:00:00.000Z',
      })
    })

    it('returns canRetry=false when retry attempts are exhausted', () => {
      vi.mocked(getMutationOperation).mockReturnValue({
        operationId: 'op-2',
        type: 'trust_score_lookup',
        status: 'error',
        maxAttempts: 3,
        attempts: [
          { timestamp: '2026-01-01T00:00:00.000Z', error: { message: 'Err 1', retryable: true } },
          { timestamp: '2026-01-01T00:01:00.000Z', error: { message: 'Err 2', retryable: true } },
          { timestamp: '2026-01-01T00:02:00.000Z', error: { message: 'Err 3', retryable: true } },
        ],
      } as never)

      const status = getTrustScoreOperationStatus('op-2')
      expect(status?.canRetry).toBe(false)
      expect(status?.attempts).toBe(3)
      expect(status?.error).toBe('Err 3')
    })

    it('returns canRetry=false for non-retryable errors', () => {
      vi.mocked(getMutationOperation).mockReturnValue({
        operationId: 'op-3',
        type: 'trust_score_lookup',
        status: 'error',
        maxAttempts: 3,
        attempts: [
          {
            timestamp: '2026-01-01T00:00:00.000Z',
            error: { message: 'Bad request', retryable: false },
          },
        ],
      } as never)

      const status = getTrustScoreOperationStatus('op-3')
      expect(status?.canRetry).toBe(false)
      expect(status?.error).toBe('Bad request')
    })

    it('returns canRetry=false and data when operation succeeded', () => {
      const mockScore = { address: VALID_ADDRESS, score: 85 }
      vi.mocked(getMutationOperation).mockReturnValue({
        operationId: 'op-4',
        type: 'trust_score_lookup',
        status: 'success',
        maxAttempts: 3,
        finalResponse: mockScore,
        attempts: [{ timestamp: '2026-01-01T00:00:00.000Z' }],
      } as never)

      expect(getTrustScoreOperationStatus('op-4')).toEqual({
        operationId: 'op-4',
        status: 'success',
        data: mockScore,
        error: undefined,
        attempts: 1,
        canRetry: false,
        lastAttemptAt: '2026-01-01T00:00:00.000Z',
      })
    })
  })

  describe('retryTrustScoreLookup', () => {
    it('returns false when operation is missing or wrong type', async () => {
      vi.mocked(getMutationOperation).mockReturnValue(null)
      expect(await retryTrustScoreLookup('op-missing')).toBe(false)
      expect(logWarn).toHaveBeenCalledWith('trust_score_retry_invalid_operation', {
        operationId: 'op-missing',
      })
    })

    it('returns false when operation is not in error state', async () => {
      vi.mocked(getMutationOperation).mockReturnValue({
        operationId: 'op-1',
        type: 'trust_score_lookup',
        status: 'success',
      } as never)

      expect(await retryTrustScoreLookup('op-1')).toBe(false)
      expect(logWarn).toHaveBeenCalledWith('trust_score_retry_invalid_state', {
        operationId: 'op-1',
        status: 'success',
      })
    })

    it('resets status to pending and triggers recovery when in error state', async () => {
      vi.mocked(getMutationOperation).mockReturnValue({
        operationId: 'op-1',
        type: 'trust_score_lookup',
        status: 'error',
      } as never)
      vi.mocked(mutationRecoveryEngine.recoverOperation).mockResolvedValue(true)

      const result = await retryTrustScoreLookup('op-1')

      expect(result).toBe(true)
      expect(updateMutationOperation).toHaveBeenCalledWith('op-1', expect.any(Function))
      expect(mutationRecoveryEngine.recoverOperation).toHaveBeenCalledWith('op-1')
      expect(logInfo).toHaveBeenCalledWith('trust_score_retry_initiated', {
        operationId: 'op-1',
        recovered: true,
      })
    })
  })

  describe('cancelTrustScoreLookup', () => {
    it('returns false for invalid operation', () => {
      vi.mocked(getMutationOperation).mockReturnValue(null)
      expect(cancelTrustScoreLookup('op-missing')).toBe(false)
      expect(logWarn).toHaveBeenCalledWith('trust_score_cancel_invalid_operation', {
        operationId: 'op-missing',
      })
    })

    it('cancels recovery for valid trust_score_lookup operation', () => {
      vi.mocked(getMutationOperation).mockReturnValue({
        operationId: 'op-1',
        type: 'trust_score_lookup',
      } as never)
      vi.mocked(mutationRecoveryEngine.cancelRecovery).mockReturnValue(true)

      expect(cancelTrustScoreLookup('op-1')).toBe(true)
      expect(mutationRecoveryEngine.cancelRecovery).toHaveBeenCalledWith('op-1')
      expect(logInfo).toHaveBeenCalledWith('trust_score_lookup_cancelled', {
        operationId: 'op-1',
        cancelled: true,
      })
    })
  })

  describe('lookupTrustScoresBatch', () => {
    it('filters invalid addresses and aggregates valid lookup results', async () => {
      vi.mocked(initiateMutation)
        .mockResolvedValueOnce({ operationId: 'op-1', isNewOperation: true, started: true })
        .mockResolvedValueOnce({ operationId: 'op-2', isNewOperation: false, started: true })

      const result = await lookupTrustScoresBatch([
        VALID_ADDRESS,
        INVALID_ADDRESS,
        VALID_ADDRESS,
      ])

      expect(logWarn).toHaveBeenCalledWith('trust_score_batch_invalid_addresses', {
        total: 3,
        valid: 2,
      })
      expect(result).toEqual({
        operations: [
          { address: VALID_ADDRESS, operationId: 'op-1', isNewOperation: true },
          { address: VALID_ADDRESS, operationId: 'op-2', isNewOperation: false },
        ],
        totalOperations: 2,
        newOperations: 1,
      })
    })
  })

  describe('createEnhancedTrustScoreLookup', () => {
    it('returns idle status before refetch and null for invalid address', async () => {
      const helper = createEnhancedTrustScoreLookup()

      expect(helper.getStatus()).toEqual({
        data: null,
        isLoading: false,
        error: null,
        canRetry: false,
      })
      expect(helper.cancel()).toBe(false)
      expect(await helper.refetch(INVALID_ADDRESS)).toBeNull()
    })

    it('tracks operation status, retry, and cancel after refetch', async () => {
      vi.mocked(initiateMutation).mockResolvedValue({
        operationId: 'op-99',
        isNewOperation: true,
        started: true,
      })

      const helper = createEnhancedTrustScoreLookup()
      await helper.refetch(VALID_ADDRESS)

      vi.mocked(getMutationOperation).mockReturnValue({
        operationId: 'op-99',
        type: 'trust_score_lookup',
        status: 'pending',
        maxAttempts: 3,
        attempts: [],
      } as never)

      expect(helper.getStatus()).toEqual({
        data: null,
        isLoading: true,
        error: null,
        operationId: 'op-99',
        canRetry: false,
      })

      vi.mocked(getMutationOperation).mockReturnValue(null)
      expect(helper.getStatus()).toEqual({
        data: null,
        isLoading: false,
        error: 'Operation not found',
        canRetry: false,
      })
    })
  })
})
