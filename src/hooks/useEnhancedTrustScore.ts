/**
 * @file useEnhancedTrustScore.ts
 * @description Enhanced React hook for trust score lookups with persistent storage and recovery.
 *
 * This hook extends the existing useTrustScore functionality with:
 * - Automatic persistence across browser sessions
 * - Deterministic recovery of failed operations
 * - Deduplication of concurrent requests
 * - Enhanced error handling with retry capabilities
 * - Integration with the unified mutation system
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { TrustScore } from '../api/types'
import { isValidStellarAddress } from '../lib/stellar'
import {
  lookupTrustScore,
  getTrustScoreOperationStatus,
  retryTrustScoreLookup,
  cancelTrustScoreLookup,
  type TrustScoreOperationStatus,
} from '../lib/trustScoreMutations'
import { type MutationOperationId, getMutationOperations } from '../lib/mutationStorage'
import { mutationRecoveryEngine } from '../lib/mutationRecovery'
import { logInfo, logWarn } from '../lib/log'

// ═══════════════════════════════════════════════════════════════════════════
// Hook Types
// ═══════════════════════════════════════════════════════════════════════════

export interface UseEnhancedTrustScoreResult {
  /** Trust score data from successful lookup, or null */
  data: TrustScore | null
  /** True while a lookup request is in flight */
  isLoading: boolean
  /** Error message from the most recent failed lookup */
  error: string | null
  /** Current operation ID for tracking */
  operationId: MutationOperationId | null
  /** True if the current operation can be retried */
  canRetry: boolean
  /** Number of attempts made for current operation */
  attempts: number
  /** Whether data is from recovered operation */
  isRecovered: boolean

  // Actions
  /** Performs lookup for the current address */
  refetch: () => Promise<void>
  /** Forces fresh lookup bypassing any cache */
  refresh: () => Promise<void>
  /** Retries the current failed operation */
  retry: () => Promise<boolean>
  /** Cancels the current active operation */
  cancel: () => boolean
  /** Resets to idle state */
  reset: () => void
}

export interface UseEnhancedTrustScoreOptions {
  /** Whether to automatically recover pending operations on mount */
  autoRecover?: boolean
  /** Whether to poll for updates during active operations */
  enablePolling?: boolean
  /** Polling interval in milliseconds for active operations */
  pollingInterval?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════

export function useEnhancedTrustScore(
  address: string,
  options: UseEnhancedTrustScoreOptions = {}
): UseEnhancedTrustScoreResult {
  const { autoRecover = true, enablePolling = true, pollingInterval = 1000 } = options

  // Core state
  const [data, setData] = useState<TrustScore | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [operationId, setOperationId] = useState<MutationOperationId | null>(null)
  const [operationStatus, setOperationStatus] = useState<TrustScoreOperationStatus | null>(null)
  const [isRecovered, setIsRecovered] = useState(false)

  // Refs to prevent stale closures and manage lifecycle
  const mountedRef = useRef(true)
  const currentAddressRef = useRef(address)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  currentAddressRef.current = address

  // ═══════════════════════════════════════════════════════════════════════════
  // State Management Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  const updateStateFromOperation = useCallback((status: TrustScoreOperationStatus | null) => {
    if (!mountedRef.current) return

    setOperationStatus(status)

    if (status) {
      setIsLoading(status.status === 'pending' || status.status === 'submitting')
      setError(status.error || null)
      setData(status.data || null)

      // Clear data only if we're fetching a different address
      if (status.data?.address !== currentAddressRef.current) {
        setData(null)
      }
    } else {
      setIsLoading(false)
      setError(null)
      setOperationId(null)
    }
  }, [])

  const scheduleStateUpdate = useCallback(
    (delayMs: number = 100) => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      updateTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && operationId) {
          const status = getTrustScoreOperationStatus(operationId)
          updateStateFromOperation(status)
        }
      }, delayMs)
    },
    [operationId, updateStateFromOperation]
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // Effect: Address Change and Recovery
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isValidStellarAddress(address)) {
      setData(null)
      setError(null)
      setIsLoading(false)
      setOperationId(null)
      setOperationStatus(null)
      setIsRecovered(false)
      return
    }

    const initializeForAddress = async () => {
      try {
        // Check for existing operations for this address
        const existingOperations = getMutationOperations('trust_score_lookup')
          .filter(
            (op) =>
              op.requestMetadata.address === address &&
              (op.status === 'pending' || op.status === 'submitting' || op.status === 'success')
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

        if (existingOperations.length > 0) {
          const latest = existingOperations[0]
          setOperationId(latest.operationId)
          setIsRecovered(latest.isRecovered)

          const status = getTrustScoreOperationStatus(latest.operationId)
          updateStateFromOperation(status)

          // Trigger recovery if needed and autoRecover is enabled
          if (autoRecover && (latest.status === 'pending' || latest.status === 'submitting')) {
            logInfo('trust_score_auto_recovery_triggered', {
              operationId: latest.operationId,
              address,
            })

            await mutationRecoveryEngine.recoverOperation(latest.operationId)
            scheduleStateUpdate(0)
          }
        } else {
          // No existing operations - reset to idle state
          setData(null)
          setError(null)
          setIsLoading(false)
          setOperationId(null)
          setOperationStatus(null)
          setIsRecovered(false)
        }
      } catch (error) {
        logWarn('trust_score_initialization_failed', {
          address,
          error: error instanceof Error ? error.message : String(error),
        })

        setError('Failed to initialize trust score lookup')
        setIsLoading(false)
      }
    }

    void initializeForAddress()
  }, [address, autoRecover, updateStateFromOperation, scheduleStateUpdate])

  // ═══════════════════════════════════════════════════════════════════════════
  // Effect: Polling for Active Operations
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (
      enablePolling &&
      operationId &&
      operationStatus &&
      (operationStatus.status === 'pending' || operationStatus.status === 'submitting')
    ) {
      pollingIntervalRef.current = setInterval(() => {
        if (mountedRef.current) {
          scheduleStateUpdate(0)
        }
      }, pollingInterval)

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }
  }, [enablePolling, operationId, operationStatus?.status, pollingInterval, scheduleStateUpdate])

  // ═══════════════════════════════════════════════════════════════════════════
  // Actions Implementation
  // ═══════════════════════════════════════════════════════════════════════════

  const performLookup = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!isValidStellarAddress(currentAddressRef.current)) {
        setError('Invalid Stellar address format')
        return
      }

      try {
        setError(null)
        setIsLoading(true)

        const result = await lookupTrustScore(currentAddressRef.current, forceRefresh)

        if (mountedRef.current) {
          setOperationId(result.operationId)
          setIsRecovered(false) // This is a fresh operation

          // Start polling for updates
          scheduleStateUpdate(100)

          logInfo('trust_score_lookup_initiated', {
            operationId: result.operationId,
            address: currentAddressRef.current,
            isNewOperation: result.isNewOperation,
            forceRefresh,
          })
        }
      } catch (error) {
        if (mountedRef.current) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          setError(errorMessage)
          setIsLoading(false)

          logWarn('trust_score_lookup_failed', {
            address: currentAddressRef.current,
            error: errorMessage,
          })
        }
      }
    },
    [scheduleStateUpdate]
  )

  const refetch = useCallback(() => performLookup(false), [performLookup])
  const refresh = useCallback(() => performLookup(true), [performLookup])

  const retry = useCallback(async (): Promise<boolean> => {
    if (!operationId) {
      logWarn('trust_score_retry_no_operation')
      return false
    }

    try {
      const success = await retryTrustScoreLookup(operationId)
      scheduleStateUpdate(0)

      logInfo('trust_score_retry_attempted', {
        operationId,
        address: currentAddressRef.current,
        success,
      })

      return success
    } catch (error) {
      logWarn('trust_score_retry_failed', {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }, [operationId, scheduleStateUpdate])

  const cancel = useCallback((): boolean => {
    if (!operationId) {
      logWarn('trust_score_cancel_no_operation')
      return false
    }

    try {
      const cancelled = cancelTrustScoreLookup(operationId)
      if (cancelled) {
        setIsLoading(false)
        scheduleStateUpdate(0)

        logInfo('trust_score_operation_cancelled', {
          operationId,
          address: currentAddressRef.current,
        })
      }

      return cancelled
    } catch (error) {
      logWarn('trust_score_cancel_failed', {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }, [operationId, scheduleStateUpdate])

  const reset = useCallback((): void => {
    setData(null)
    setError(null)
    setIsLoading(false)
    setOperationId(null)
    setOperationStatus(null)
    setIsRecovered(false)

    logInfo('trust_score_hook_reset', { address: currentAddressRef.current })
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // Return Hook Interface
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    data,
    isLoading,
    error,
    operationId,
    canRetry: operationStatus?.canRetry || false,
    attempts: operationStatus?.attempts || 0,
    isRecovered,
    refetch,
    refresh,
    retry,
    cancel,
    reset,
  }
}
