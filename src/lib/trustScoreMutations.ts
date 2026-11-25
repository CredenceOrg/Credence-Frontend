/**
 * @file trustScoreMutations.ts  
 * @description Trust score mutation system with storage compatibility and deterministic recovery.
 *
 * This extends the existing trust score functionality to provide:
 * - Persistent storage of lookup operations across browser sessions
 * - Automatic recovery of failed trust score lookups
 * - Deduplication of concurrent requests for the same address
 * - Observable operation state for UI components
 * - Integration with the unified mutation storage system
 */

import type { TrustScore } from '../api/types'

import { isValidStellarAddress } from './stellar'
import { initiateMutation } from './mutationRecovery'
import {
  type MutationOperationId,
  getMutationOperation,
  getMutationOperations,
  updateMutationOperation,
} from './mutationStorage'
import { mutationRecoveryEngine } from './mutationRecovery'
import { logInfo, logWarn } from './log'
import { QUERY_CACHE_TTLS } from '../config/queryCache'

// ═══════════════════════════════════════════════════════════════════════════
// Trust Score Mutation Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TrustScoreLookupParams {
  address: string
}

export interface TrustScoreLookupResult {
  operationId: MutationOperationId
  isNewOperation: boolean
  data?: TrustScore
  fromCache?: boolean
}

export interface TrustScoreOperationStatus {
  operationId: MutationOperationId
  status: 'idle' | 'pending' | 'submitting' | 'success' | 'error' | 'cancelled'
  data?: TrustScore
  error?: string
  attempts: number
  canRetry: boolean
  lastAttemptAt?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Enhanced Trust Score Lookup
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Performs a persistent trust score lookup with automatic recovery and deduplication.
 *
 * Unlike the basic useTrustScore hook, this function:
 * - Persists lookup state across browser sessions
 * - Automatically recovers from network failures
 * - Prevents duplicate requests for the same address
 * - Integrates with the unified mutation system
 *
 * @param address Stellar public address to lookup
 * @param forceRefresh Whether to bypass cache and perform fresh lookup
 * @returns Promise resolving to lookup result with operation tracking
 */
export async function lookupTrustScore(
  address: string,
  forceRefresh: boolean = false
): Promise<TrustScoreLookupResult> {
  // Validate address before creating operation
  if (!isValidStellarAddress(address)) {
    throw new Error('Invalid Stellar address format')
  }

  const params: TrustScoreLookupParams = { address }

  // Check for existing successful operation unless forced refresh
  if (!forceRefresh) {
    const existingResult = checkExistingTrustScoreOperation(address)
    if (existingResult) {
      return existingResult
    }
  }

  // Initiate new mutation operation
  const { operationId, isNewOperation, started } = await initiateMutation(
    'trust_score_lookup',
    { ...params },
    3 // Max attempts for trust score lookups
  )

  if (!started) {
    logWarn('trust_score_lookup_failed_to_start', { operationId, address })
  }

  return {
    operationId,
    isNewOperation,
  }
}

/**
 * Normalise a Stellar address for cache lookup. Stellar public keys are
 * case-sensitive on chain, but we match loosely here so a caller passing
 * mixed case does not miss a cached entry it just produced. The stored
 * `requestMetadata.address` is whatever the caller originally supplied.
 */
function normaliseAddressKey(address: string): string {
  return address.trim().toLowerCase()
}

/**
 * Checks for a recent successful trust score lookup for `address` and
 * returns it as a cache hit when the stored entry is within the freshness
 * window (`QUERY_CACHE_TTLS.TRUST_SCORE_FRESHNESS_MS`). Failed, pending
 * or cancelled operations are ignored; stale successful entries trigger
 * a fresh lookup.
 */
export function checkExistingTrustScoreOperation(
  address: string
): TrustScoreLookupResult | null {
  const target = normaliseAddressKey(address)
  const freshnessMs = QUERY_CACHE_TTLS.TRUST_SCORE_FRESHNESS_MS
  const now = Date.now()

  // `getMutationOperations` returns the matching list sorted newest-first
  // by `updatedAt`, which is the right order for picking the most recent
  // successful lookup.
  const candidates = getMutationOperations('trust_score_lookup', 'success')

  for (const op of candidates) {
    const storedAddress = (op.requestMetadata?.address as string | undefined) ?? ''
    if (!storedAddress || normaliseAddressKey(storedAddress) !== target) {
      continue
    }

    const completedAt = op.completedAt ?? op.updatedAt
    const completedMs = Date.parse(completedAt)
    if (!Number.isFinite(completedMs)) {
      continue
    }
    if (now - completedMs > freshnessMs) {
      // Newest matching entry is already stale; older ones can only be
      // older still, so stop looking.
      return null
    }

    const data = op.finalResponse as TrustScore | undefined
    if (!data) {
      continue
    }

    logInfo('trust_score_lookup_cache_hit', {
      operationId: op.operationId,
      address,
      ageMs: now - completedMs,
    })

    return {
      operationId: op.operationId,
      isNewOperation: false,
      data,
      fromCache: true,
    }
  }

  return null
}

/**
 * Gets the current status of a trust score lookup operation.
 */
export function getTrustScoreOperationStatus(
  operationId: MutationOperationId
): TrustScoreOperationStatus | null {
  const operation = getMutationOperation(operationId)
  if (!operation || operation.type !== 'trust_score_lookup') {
    return null
  }

  const lastAttempt = operation.attempts[operation.attempts.length - 1]
  const canRetry =
    operation.status === 'error' &&
    operation.attempts.length < operation.maxAttempts &&
    (lastAttempt?.error?.retryable ?? false)

  return {
    operationId: operation.operationId,
    status: operation.status,
    data: operation.finalResponse as TrustScore | undefined,
    error: lastAttempt?.error?.message,
    attempts: operation.attempts.length,
    canRetry,
    lastAttemptAt: lastAttempt?.timestamp,
  }
}

/**
 * Retries a failed trust score lookup operation.
 */
export async function retryTrustScoreLookup(operationId: MutationOperationId): Promise<boolean> {
  const operation = getMutationOperation(operationId)
  if (!operation || operation.type !== 'trust_score_lookup') {
    logWarn('trust_score_retry_invalid_operation', { operationId })
    return false
  }

  if (operation.status !== 'error') {
    logWarn('trust_score_retry_invalid_state', { operationId, status: operation.status })
    return false
  }

  // Reset to pending and trigger recovery
  updateMutationOperation(operationId, () => ({ status: 'pending' }))
  const recovered = await mutationRecoveryEngine.recoverOperation(operationId)

  logInfo('trust_score_retry_initiated', { operationId, recovered })
  return recovered
}

/**
 * Cancels an active trust score lookup operation.
 */
export function cancelTrustScoreLookup(operationId: MutationOperationId): boolean {
  const operation = getMutationOperation(operationId)
  if (!operation || operation.type !== 'trust_score_lookup') {
    logWarn('trust_score_cancel_invalid_operation', { operationId })
    return false
  }

  const cancelled = mutationRecoveryEngine.cancelRecovery(operationId)
  logInfo('trust_score_lookup_cancelled', { operationId, cancelled })
  return cancelled
}

// ═══════════════════════════════════════════════════════════════════════════
// Batch Operations
// ═══════════════════════════════════════════════════════════════════════════

export interface BatchTrustScoreLookupResult {
  operations: Array<{
    address: string
    operationId: MutationOperationId
    isNewOperation: boolean
  }>
  totalOperations: number
  newOperations: number
}

/**
 * Performs batch trust score lookups with deduplication and parallel execution.
 */
export async function lookupTrustScoresBatch(
  addresses: string[]
): Promise<BatchTrustScoreLookupResult> {
  const validAddresses = addresses.filter((addr) => isValidStellarAddress(addr))

  if (validAddresses.length !== addresses.length) {
    logWarn('trust_score_batch_invalid_addresses', {
      total: addresses.length,
      valid: validAddresses.length,
    })
  }

  const operations: BatchTrustScoreLookupResult['operations'] = []
  let newOperations = 0

  // Process addresses sequentially to avoid overwhelming the storage system
  for (const address of validAddresses) {
    try {
      const result = await lookupTrustScore(address, false)
      operations.push({
        address,
        operationId: result.operationId,
        isNewOperation: result.isNewOperation,
      })

      if (result.isNewOperation) {
        newOperations++
      }
    } catch (error) {
      logWarn('trust_score_batch_lookup_failed', {
        address,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  logInfo('trust_score_batch_completed', {
    totalOperations: operations.length,
    newOperations,
  })

  return {
    operations,
    totalOperations: operations.length,
    newOperations,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Integration Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Enhanced version of the existing trust score hook that integrates with persistent storage.
 *
 * This can be used to gradually migrate from the basic useTrustScore hook to the
 * storage-backed version without breaking existing components.
 */
export interface EnhancedTrustScoreHookResult {
  data: TrustScore | null
  isLoading: boolean
  error: string | null
  operationId?: MutationOperationId
  canRetry: boolean
  refetch: () => Promise<void>
  retry: () => Promise<void>
  cancel: () => boolean
}

/**
 * Factory function to create an enhanced trust score lookup function.
 * This bridges the gap between the existing hook-based API and the new mutation system.
 */
export function createEnhancedTrustScoreLookup() {
  let currentOperationId: MutationOperationId | null = null

  const refetch = async (address: string, forceRefresh: boolean = false) => {
    if (!address || !isValidStellarAddress(address)) {
      return null
    }

    const result = await lookupTrustScore(address, forceRefresh)
    currentOperationId = result.operationId
    return result
  }

  const getStatus = (): Omit<EnhancedTrustScoreHookResult, 'refetch' | 'retry' | 'cancel'> => {
    if (!currentOperationId) {
      return {
        data: null,
        isLoading: false,
        error: null,
        canRetry: false,
      }
    }

    const status = getTrustScoreOperationStatus(currentOperationId)
    if (!status) {
      return {
        data: null,
        isLoading: false,
        error: 'Operation not found',
        canRetry: false,
      }
    }

    return {
      data: status.data || null,
      isLoading: status.status === 'pending' || status.status === 'submitting',
      error: status.error || null,
      operationId: status.operationId,
      canRetry: status.canRetry,
    }
  }

  const retry = async () => {
    if (currentOperationId) {
      await retryTrustScoreLookup(currentOperationId)
    }
  }

  const cancel = () => {
    if (currentOperationId) {
      return cancelTrustScoreLookup(currentOperationId)
    }
    return false
  }

  return {
    refetch,
    getStatus,
    retry,
    cancel,
  }
}
