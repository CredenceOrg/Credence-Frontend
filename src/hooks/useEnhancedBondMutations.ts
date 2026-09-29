/**
 * @file useEnhancedBondMutations.ts
 * @description Enhanced React hook for bond mutations with persistent storage and recovery.
 *
 * This hook provides a React-friendly interface to the enhanced bond mutation system,
 * offering automatic persistence, recovery, and consistent state management across
 * browser sessions and network failures.
 *
 * Features:
 * - Automatic recovery of incomplete operations on mount
 * - Real-time status updates for active operations
 * - Deduplication of concurrent requests
 * - Retry capabilities with exponential backoff
 * - Integration with existing UI patterns
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { type MutationOperationId } from '../lib/mutationStorage'
import { retryMutation, cancelMutation, mutationRecoveryEngine } from '../lib/mutationRecovery'
import {
  readBondActions,
  updateBondAction,
  createEnhancedBondAction,
  getBondActionMutationOperation,
  type BondActionKind,
} from '../lib/bondActionStorage'
import { logInfo, logWarn } from '../lib/log'

// ═══════════════════════════════════════════════════════════════════════════
// Hook Types
// ═══════════════════════════════════════════════════════════════════════════

export interface BondMutationState {
  // Operation tracking
  operationId: MutationOperationId | null
  isActive: boolean

  // Status information
  status: 'idle' | 'pending' | 'submitting' | 'success' | 'error' | 'cancelled'
  attempts: number
  canRetry: boolean

  // Data
  txHash?: string
  error?: string

  // Timing
  createdAt?: string
  lastAttemptAt?: string
  completedAt?: string
}

export interface BondMutationActions {
  // Primary actions
  createBond: (amountUsdc: number) => Promise<MutationOperationId>
  withdrawBond: (bondId: number, amountUsdc: number) => Promise<MutationOperationId>

  // Recovery actions
  retry: () => Promise<boolean>
  cancel: () => boolean

  // Utility
  reset: () => void
}

export interface UseEnhancedBondMutationsResult {
  create: BondMutationState
  withdraw: BondMutationState
  actions: BondMutationActions

  // Global state
  hasActiveOperations: boolean
  recoveryStatus: {
    isRecovering: boolean
    recoveredCount: number
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════════════════

export function useEnhancedBondMutations(): UseEnhancedBondMutationsResult {
  // State for each operation type
  const [createState, setCreateState] = useState<BondMutationState>(() =>
    initializeBondMutationState('create')
  )
  const [withdrawState, setWithdrawState] = useState<BondMutationState>(() =>
    initializeBondMutationState('withdraw')
  )

  // Global recovery state
  const [recoveryStatus, setRecoveryStatus] = useState({
    isRecovering: false,
    recoveredCount: 0,
  })

  // Track active operation for actions
  const activeOperationRef = useRef<{
    kind: BondActionKind
    operationId: MutationOperationId
  } | null>(null)

  // Refs to prevent stale closures
  const mountedRef = useRef(true)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ═══════════════════════════════════════════════════════════════════════════
  // State Management Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  const updateStateFromOperation = useCallback((kind: BondActionKind) => {
    const operation = getBondActionMutationOperation(kind)
    const newState = operation ? operationToState(operation) : initializeBondMutationState(kind)

    if (kind === 'create') {
      setCreateState((prev) => {
        if (
          prev.status === newState.status &&
          prev.attempts === newState.attempts &&
          prev.txHash === newState.txHash &&
          prev.error === newState.error &&
          prev.operationId === newState.operationId &&
          prev.canRetry === newState.canRetry &&
          prev.isActive === newState.isActive
        ) {
          return prev
        }
        return newState
      })
    } else {
      setWithdrawState((prev) => {
        if (
          prev.status === newState.status &&
          prev.attempts === newState.attempts &&
          prev.txHash === newState.txHash &&
          prev.error === newState.error &&
          prev.operationId === newState.operationId &&
          prev.canRetry === newState.canRetry &&
          prev.isActive === newState.isActive
        ) {
          return prev
        }
        return newState
      })
    }
  }, [])

  const scheduleStateUpdate = useCallback(
    (delayMs: number = 100) => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      updateTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          updateStateFromOperation('create')
          updateStateFromOperation('withdraw')
        }
      }, delayMs)
    },
    [updateStateFromOperation]
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // Effect: Initialize and Recover Operations
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    let isMounted = true

    const initializeAndRecover = async () => {
      setRecoveryStatus((prev) => ({ ...prev, isRecovering: true }))

      try {
        // Initialize states from existing operations
        updateStateFromOperation('create')
        updateStateFromOperation('withdraw')

        // Recover any pending operations
        const results = await mutationRecoveryEngine.recoverPendingOperations()

        if (isMounted) {
          setRecoveryStatus({
            isRecovering: false,
            recoveredCount: results.recovered,
          })

          logInfo('bond_mutations_hook_initialized', {
            recoveredOperations: results.recovered,
            failedRecovery: results.failed,
          })
        }
      } catch (error) {
        if (isMounted) {
          setRecoveryStatus((prev) => ({ ...prev, isRecovering: false }))
          logWarn('bond_mutations_hook_recovery_failed', {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    void initializeAndRecover()

    return () => {
      isMounted = false
    }
  }, [updateStateFromOperation])

  // ═══════════════════════════════════════════════════════════════════════════
  // Effect: Polling for Active Operations
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const hasActive = createState.isActive || withdrawState.isActive

    if (hasActive) {
      const interval = setInterval(() => {
        if (mountedRef.current) {
          updateStateFromOperation('create')
          updateStateFromOperation('withdraw')
        }
      }, 500)

      return () => clearInterval(interval)
    }
  }, [createState.isActive, withdrawState.isActive, updateStateFromOperation])

  // ═══════════════════════════════════════════════════════════════════════════
  // Actions Implementation
  // ═══════════════════════════════════════════════════════════════════════════

  const createBond = useCallback(
    async (amountUsdc: number): Promise<MutationOperationId> => {
      if (createState.isActive) {
        logWarn('bond_create_already_active')
        return undefined as unknown as MutationOperationId
      }

      try {
        const { operationId } = await createEnhancedBondAction('create', { amountUsdc })

        activeOperationRef.current = { kind: 'create', operationId }
        scheduleStateUpdate(0)

        logInfo('bond_create_initiated', { operationId, amountUsdc })
        return operationId
      } catch (error) {
        logWarn('bond_create_failed', {
          amountUsdc,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    [createState.isActive, scheduleStateUpdate]
  )

  const withdrawBond = useCallback(
    async (bondId: number, amountUsdc: number): Promise<MutationOperationId> => {
      if (withdrawState.isActive) {
        logWarn('bond_withdraw_already_active')
        return undefined as unknown as MutationOperationId
      }

      try {
        const { operationId } = await createEnhancedBondAction('withdraw', { bondId, amountUsdc })

        activeOperationRef.current = { kind: 'withdraw', operationId }
        scheduleStateUpdate(0)

        logInfo('bond_withdraw_initiated', { operationId, bondId, amountUsdc })
        return operationId
      } catch (error) {
        logWarn('bond_withdraw_failed', {
          bondId,
          amountUsdc,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    [withdrawState.isActive, scheduleStateUpdate]
  )

  const retry = useCallback(async (): Promise<boolean> => {
    const targetOperationId =
      activeOperationRef.current?.operationId ||
      (createState.canRetry
        ? createState.operationId
        : withdrawState.canRetry
          ? withdrawState.operationId
          : null)

    if (!targetOperationId) {
      logWarn('bond_retry_no_active_operation')
      return false
    }

    try {
      const success = await retryMutation(targetOperationId)
      scheduleStateUpdate(0)

      logInfo('bond_retry_attempted', {
        operationId: targetOperationId,
        success,
      })

      return success
    } catch (error) {
      logWarn('bond_retry_failed', {
        operationId: targetOperationId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }, [
    createState.canRetry,
    createState.operationId,
    withdrawState.canRetry,
    withdrawState.operationId,
    scheduleStateUpdate,
  ])

  const cancel = useCallback((): boolean => {
    const targetOperationId =
      activeOperationRef.current?.operationId ||
      (createState.isActive
        ? createState.operationId
        : withdrawState.isActive
          ? withdrawState.operationId
          : null)

    if (!targetOperationId) {
      logWarn('bond_cancel_no_active_operation')
      return false
    }

    try {
      const cancelled = cancelMutation(targetOperationId)
      if (cancelled) {
        activeOperationRef.current = null
        scheduleStateUpdate(0)

        logInfo('bond_operation_cancelled', {
          operationId: targetOperationId,
        })
      }

      return cancelled
    } catch (error) {
      logWarn('bond_cancel_failed', {
        operationId: targetOperationId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }, [
    createState.isActive,
    createState.operationId,
    withdrawState.isActive,
    withdrawState.operationId,
    scheduleStateUpdate,
  ])

  const reset = useCallback((): void => {
    // Reset both legacy and unified storage to idle state
    updateBondAction('create', () => ({
      status: 'idle',
      attempts: 0,
    }))

    updateBondAction('withdraw', () => ({
      status: 'idle',
      attempts: 0,
    }))

    activeOperationRef.current = null
    scheduleStateUpdate(0)

    logInfo('bond_mutations_reset')
  }, [scheduleStateUpdate])

  // ═══════════════════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // Return Hook Interface
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    create: createState,
    withdraw: withdrawState,
    actions: {
      createBond,
      withdrawBond,
      retry,
      cancel,
      reset,
    },
    hasActiveOperations: createState.isActive || withdrawState.isActive,
    recoveryStatus,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function initializeBondMutationState(kind: BondActionKind): BondMutationState {
  const bondActions = readBondActions()
  const record = kind === 'create' ? bondActions.create : bondActions.withdraw

  // If there's an active operation, get its current state
  if (record.operationId) {
    const operation = getBondActionMutationOperation(kind)
    if (operation) {
      return operationToState(operation)
    }
  }

  // Return idle state based on legacy record
  return {
    operationId: record.operationId || null,
    isActive: record.status === 'pending',
    status: mapLegacyStatus(record.status),
    attempts: record.attempts,
    canRetry: record.status === 'error',
    txHash: record.lastTxHash,
    error: record.lastError?.message,
    lastAttemptAt: record.lastAttemptAt,
    completedAt: record.lastSuccessAt,
  }
}

function operationToState(operation: {
  operationId: string
  status: string
  attempts: Array<{
    attemptId?: string
    status?: string
    timestamp?: string
    error?: { message?: string; retryable?: boolean }
    txHash?: string
  }>
  finalTxHash?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  maxAttempts: number
}): BondMutationState {
  const lastAttempt = operation.attempts[operation.attempts.length - 1]

  const normalizeStatus = (status: string): BondMutationState['status'] => {
    switch (status) {
      case 'idle':
      case 'pending':
      case 'submitting':
      case 'success':
      case 'error':
      case 'cancelled':
        return status
      default:
        return 'error'
    }
  }

  return {
    operationId: operation.operationId,
    isActive: operation.status === 'pending' || operation.status === 'submitting',
    status: normalizeStatus(operation.status),
    attempts: operation.attempts.length,
    canRetry:
      operation.status === 'error' &&
      operation.attempts.length < operation.maxAttempts &&
      (lastAttempt?.error?.retryable ?? false),
    txHash: operation.finalTxHash || lastAttempt?.txHash,
    error: lastAttempt?.error?.message,
    createdAt: operation.createdAt,
    lastAttemptAt: lastAttempt?.timestamp,
    completedAt: operation.completedAt,
  }
}

function mapLegacyStatus(status: string): BondMutationState['status'] {
  switch (status) {
    case 'idle':
      return 'idle'
    case 'pending':
      return 'pending'
    case 'success':
      return 'success'
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}
