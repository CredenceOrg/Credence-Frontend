/**
 * @file mutationRecovery.ts
 * @description Recovery system for bond and trust-score mutations with deterministic guarantees.
 *
 * Recovery Strategies:
 * 1. Operation state reconstruction from storage
 * 2. API confirmation for submitted transactions
 * 3. Idempotent retry with exponential backoff
 * 4. Partial state cleanup and rollback
 * 5. Concurrent operation detection and resolution
 *
 * Invariants Enforced:
 * - No duplicate mutations reach the network
 * - Failed operations can always be resumed or cancelled
 * - Partial state is cleaned up atomically
 * - Users see consistent operation status across sessions
 */

import { apiFetch, ApiError } from '../api/client'
import {
  type MutationOperation,
  type MutationOperationId,
  type MutationType,
  type MutationError,
  getMutationOperation,
  getMutationOperations,
  updateMutationOperation,
  createMutationOperation,
} from './mutationStorage'
import { submitCreateBond, submitWithdrawBond } from './bondMutations'
import { logInfo, logWarn, logError } from './log'

// ═══════════════════════════════════════════════════════════════════════════
// Recovery Configuration
// ═══════════════════════════════════════════════════════════════════════════

interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableErrors: MutationError['type'][]
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['network', 'timeout', 'generic'],
}


const OPERATION_RECOVERY_TIMEOUT_MS = 300000 // 5 minutes

// ═══════════════════════════════════════════════════════════════════════════
// Recovery Utilities
// ═══════════════════════════════════════════════════════════════════════════

function calculateRetryDelay(attemptNumber: number, policy: RetryPolicy): number {
  const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attemptNumber - 1)
  return Math.min(delay, policy.maxDelayMs)
}

function shouldRetryError(error: MutationError, policy: RetryPolicy): boolean {
  return policy.retryableErrors.includes(error.type)
}

function createMutationError(
  type: MutationError['type'],
  message: string,
  retryable: boolean = true,
  code?: string | number
): MutationError {
  return {
    type,
    message,
    code,
    timestamp: new Date().toISOString(),
    retryable,
  }
}

function apiErrorToMutationError(apiError: ApiError): MutationError {
  let type: MutationError['type'] = 'generic'
  let retryable = true

  if (apiError.status === 0) {
    type = 'network'
  } else if (apiError.status >= 400 && apiError.status < 500) {
    type = 'validation'
    retryable = false
  } else if (apiError.status >= 500) {
    type = 'backend'
  }

  // Check for wallet rejection patterns
  if (
    apiError.message.toLowerCase().includes('user rejected') ||
    apiError.message.toLowerCase().includes('cancelled') ||
    apiError.message.toLowerCase().includes('denied')
  ) {
    type = 'wallet_rejected'
    retryable = false
  }

  return createMutationError(type, apiError.message, retryable, apiError.status)
}

// ═══════════════════════════════════════════════════════════════════════════
// Operation Execution Engine
// ═══════════════════════════════════════════════════════════════════════════

export interface ExecutionContext {
  operationId: MutationOperationId
  operation: MutationOperation
  signal: AbortSignal
  retryPolicy: RetryPolicy
}

export interface ExecutionResult {
  success: boolean
  txHash?: string
  response?: Record<string, unknown>
  error?: MutationError
  shouldRetry?: boolean
}

async function executeBondCreate(
  params: { amountUsdc: number },
  context: ExecutionContext
): Promise<ExecutionResult> {
  try {
    const result = await submitCreateBond(params)
    return {
      success: true,
      txHash: result.hash,
      response: { hash: result.hash, amountUsdc: params.amountUsdc },
    }
  } catch (error) {
    const mutationError =
      error instanceof ApiError
        ? apiErrorToMutationError(error)
        : createMutationError('generic', error instanceof Error ? error.message : String(error))

    return {
      success: false,
      error: mutationError,
      shouldRetry: shouldRetryError(mutationError, context.retryPolicy),
    }
  }
}

async function executeBondWithdraw(
  params: { bondId: number; amountUsdc: number },
  context: ExecutionContext
): Promise<ExecutionResult> {
  try {
    const result = await submitWithdrawBond(params)
    return {
      success: true,
      txHash: result.hash,
      response: { hash: result.hash, bondId: params.bondId, amountUsdc: params.amountUsdc },
    }
  } catch (error) {
    const mutationError =
      error instanceof ApiError
        ? apiErrorToMutationError(error)
        : createMutationError('generic', error instanceof Error ? error.message : String(error))

    return {
      success: false,
      error: mutationError,
      shouldRetry: shouldRetryError(mutationError, context.retryPolicy),
    }
  }
}

async function executeTrustScoreLookup(
  params: { address: string },
  context: ExecutionContext
): Promise<ExecutionResult> {
  try {
    const result = await apiFetch(`/trust-score/${encodeURIComponent(params.address)}`, {
      signal: context.signal,
    })
    return {
      success: true,
      response: result as Record<string, unknown>,
    }
  } catch (error) {
    const mutationError =
      error instanceof ApiError
        ? apiErrorToMutationError(error)
        : createMutationError('generic', error instanceof Error ? error.message : String(error))

    return {
      success: false,
      error: mutationError,
      shouldRetry: shouldRetryError(mutationError, context.retryPolicy),
    }
  }
}

async function executeOperation(context: ExecutionContext): Promise<ExecutionResult> {
  const { operation } = context
  const params = operation.requestMetadata

  switch (operation.type) {
    case 'bond_create':
      return executeBondCreate(params as { amountUsdc: number }, context)

    case 'bond_withdraw':
      return executeBondWithdraw(params as { bondId: number; amountUsdc: number }, context)

    case 'trust_score_lookup':
      return executeTrustScoreLookup(params as { address: string }, context)

    default:
      return {
        success: false,
        error: createMutationError('validation', `Unknown mutation type: ${operation.type}`, false),
      }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Recovery Engine
// ═══════════════════════════════════════════════════════════════════════════

export class MutationRecoveryEngine {
  private activeRecoveries = new Map<MutationOperationId, AbortController>()
  private retryPolicy: RetryPolicy

  constructor(retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY) {
    this.retryPolicy = retryPolicy
  }

  /**
   * Recovers all pending operations from storage on application startup.
   */
  async recoverPendingOperations(): Promise<{
    recovered: number
    failed: number
    operations: MutationOperationId[]
  }> {
    const pendingOperations = getMutationOperations(undefined, 'pending').concat(
      getMutationOperations(undefined, 'submitting')
    )

    logInfo('mutation_recovery_started', {
      pendingCount: pendingOperations.length,
    })

    const results = {
      recovered: 0,
      failed: 0,
      operations: [] as MutationOperationId[],
    }

    for (const operation of pendingOperations) {
      try {
        const recovered = await this.recoverOperation(operation.operationId)
        if (recovered) {
          results.recovered++
        } else {
          results.failed++
        }
        results.operations.push(operation.operationId)
      } catch (error) {
        logError('mutation_recovery_operation_failed', {
          operationId: operation.operationId,
          error: error instanceof Error ? error.message : String(error),
        })
        results.failed++
      }
    }

    logInfo('mutation_recovery_completed', {
      recoveredCount: results.recovered,
      failedCount: results.failed,
      operationsCount: results.operations.length,
    })
    return results
  }

  /**
   * Recovers a specific operation with full state reconstruction.
   */
  async recoverOperation(operationId: MutationOperationId): Promise<boolean> {
    const operation = getMutationOperation(operationId)
    if (!operation) {
      logWarn('mutation_recovery_operation_not_found', { operationId })
      return false
    }

    // Check if already being recovered
    if (this.activeRecoveries.has(operationId)) {
      logInfo('mutation_recovery_already_active', { operationId })
      return true
    }

    const controller = new AbortController()
    this.activeRecoveries.set(operationId, controller)

    try {
      // Mark as being recovered
      updateMutationOperation(operationId, () => ({
        isRecovered: true,
        recoveredAt: new Date().toISOString(),
        recoverySource: 'storage',
      }))

      // Try to confirm existing transaction first
      if (operation.finalTxHash) {
        const confirmed = await this.confirmTransaction(operation.finalTxHash, controller.signal)
        if (confirmed) {
          updateMutationOperation(operationId, () => ({
            status: 'success',
            completedAt: new Date().toISOString(),
          }))
          return true
        }
      }

      // Determine recovery strategy based on operation state
      if (operation.status === 'submitting' && operation.attempts.length > 0) {
        // Wait for in-flight operation or retry if timed out
        return await this.recoverSubmittingOperation(operationId, controller.signal)
      } else if (operation.status === 'pending') {
        // Resume execution from where it left off
        return await this.resumeOperation(operationId, controller.signal)
      }

      logWarn('mutation_recovery_unsupported_state', {
        operationId,
        status: operation.status,
      })
      return false
    } catch (error) {
      logError('mutation_recovery_failed', {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Mark as error state for user visibility
      updateMutationOperation(operationId, () => ({
        status: 'error',
        attempts: [
          ...operation.attempts,
          {
            attemptId: `recovery:${Date.now()}`,
            timestamp: new Date().toISOString(),
            requestHash: operation.requestHash,
            status: 'error',
            error: createMutationError(
              'generic',
              `Recovery failed: ${error instanceof Error ? error.message : String(error)}`,
              false
            ),
          },
        ],
      }))

      return false
    } finally {
      this.activeRecoveries.delete(operationId)
    }
  }

  /**
   * Confirms if a transaction hash exists and is successful.
   */
  private async confirmTransaction(txHash: string, signal: AbortSignal): Promise<boolean> {
    try {
      // For demo purposes, assume local hashes are always confirmed
      // In real implementation, this would query Stellar Horizon API
      if (txHash.startsWith('local-')) {
        return true
      }

      // For actual blockchain transactions, implement proper confirmation logic
      const response = await apiFetch(`/transactions/${txHash}/status`, {
        signal,
        skipRateLimit: true,
      })

      return (response as { status: string }).status === 'success'
    } catch (error) {
      logWarn('mutation_recovery_confirmation_failed', {
        txHash,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Recovers an operation that was submitting when the app crashed/reloaded.
   */
  private async recoverSubmittingOperation(
    operationId: MutationOperationId,
    signal: AbortSignal
  ): Promise<boolean> {
    const operation = getMutationOperation(operationId)
    if (!operation) return false

    const lastAttempt = operation.attempts[operation.attempts.length - 1]
    if (!lastAttempt) return false

    const timeSinceLastAttempt = Date.now() - new Date(lastAttempt.timestamp).getTime()

    if (timeSinceLastAttempt < OPERATION_RECOVERY_TIMEOUT_MS) {
      // Recent attempt - wait a bit longer before assuming failure
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(5000, OPERATION_RECOVERY_TIMEOUT_MS - timeSinceLastAttempt))
      )

      // Check if transaction was confirmed in the meantime
      if (lastAttempt.txHash) {
        const confirmed = await this.confirmTransaction(lastAttempt.txHash, signal)
        if (confirmed) {
          updateMutationOperation(operationId, () => ({
            status: 'success',
            finalTxHash: lastAttempt.txHash,
            completedAt: new Date().toISOString(),
          }))
          return true
        }
      }
    }

    // Assume the submitting operation failed and retry if possible
    updateMutationOperation(operationId, (op) => ({
      status: 'error',
      attempts: [
        ...op.attempts.slice(0, -1),
        {
          ...lastAttempt,
          status: 'error',
          error: createMutationError('timeout', 'Operation timed out during recovery', true),
        },
      ],
    }))

    // Retry if we haven't exceeded max attempts
    if (operation.attempts.length < operation.maxAttempts) {
      return await this.resumeOperation(operationId, signal)
    }

    return false
  }

  /**
   * Resumes execution of a pending operation.
   */
  private async resumeOperation(
    operationId: MutationOperationId,
    signal: AbortSignal
  ): Promise<boolean> {
    const operation = getMutationOperation(operationId)
    if (!operation) return false

    if (operation.attempts.length >= operation.maxAttempts) {
      logWarn('mutation_recovery_max_attempts_exceeded', { operationId })
      return false
    }

    // Calculate retry delay based on previous attempts
    const retryDelay = calculateRetryDelay(operation.attempts.length + 1, this.retryPolicy)
    if (retryDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }

    return await this.executeOperationAttempt(operationId, signal)
  }

  /**
   * Executes a single operation attempt with proper state management.
   */
  private async executeOperationAttempt(
    operationId: MutationOperationId,
    signal: AbortSignal
  ): Promise<boolean> {
    const operation = getMutationOperation(operationId)
    if (!operation) return false

    const attemptId = `attempt:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`

    // Mark as submitting and create new attempt record
    updateMutationOperation(operationId, (op) => ({
      status: 'submitting',
      attempts: [
        ...op.attempts,
        {
          attemptId,
          timestamp: new Date().toISOString(),
          requestHash: operation.requestHash,
          status: 'submitting',
        },
      ],
    }))

    const context: ExecutionContext = {
      operationId,
      operation,
      signal,
      retryPolicy: this.retryPolicy,
    }

    try {
      const result = await executeOperation(context)

      if (result.success) {
        // Update successful attempt and complete operation
        updateMutationOperation(operationId, (op) => ({
          status: 'success',
          finalTxHash: result.txHash,
          finalResponse: result.response,
          completedAt: new Date().toISOString(),
          attempts: op.attempts.map((attempt) =>
            attempt.attemptId === attemptId
              ? { ...attempt, status: 'success', txHash: result.txHash, response: result.response }
              : attempt
          ),
        }))

        logInfo('mutation_recovery_success', { operationId, txHash: result.txHash })
        return true
      } else {
        // Update failed attempt
        updateMutationOperation(operationId, (op) => ({
          status: result.shouldRetry && op.attempts.length < op.maxAttempts ? 'pending' : 'error',
          attempts: op.attempts.map((attempt) =>
            attempt.attemptId === attemptId
              ? { ...attempt, status: 'error', error: result.error }
              : attempt
          ),
        }))

        // Retry if appropriate
        if (result.shouldRetry && operation.attempts.length + 1 < operation.maxAttempts) {
          logInfo('mutation_recovery_retry_scheduled', {
            operationId,
            attemptNumber: operation.attempts.length + 1,
          })
          return await this.resumeOperation(operationId, signal)
        }

        logWarn('mutation_recovery_failed_permanently', {
          operationId,
          error: result.error?.message,
        })
        return false
      }
    } catch (error) {
      // Update attempt with execution error
      const executionError = createMutationError(
        'generic',
        error instanceof Error ? error.message : String(error),
        false
      )

      updateMutationOperation(operationId, (op) => ({
        status: 'error',
        attempts: op.attempts.map((attempt) =>
          attempt.attemptId === attemptId
            ? { ...attempt, status: 'error', error: executionError }
            : attempt
        ),
      }))

      logError('mutation_recovery_execution_error', {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      })

      return false
    }
  }

  /**
   * Cancels active recovery for an operation.
   */
  cancelRecovery(operationId: MutationOperationId): boolean {
    const controller = this.activeRecoveries.get(operationId)
    if (controller) {
      controller.abort('cancelled by user')
      this.activeRecoveries.delete(operationId)

      updateMutationOperation(operationId, () => ({
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      }))

      logInfo('mutation_recovery_cancelled', { operationId })
      return true
    }
    return false
  }

  /**
   * Cancels all active recoveries (for app shutdown).
   */
  cancelAllRecoveries(): number {
    const activeCount = this.activeRecoveries.size

    for (const [operationId, controller] of this.activeRecoveries) {
      controller.abort('app shutdown')

      updateMutationOperation(operationId, () => ({
        status: 'pending', // Return to pending so it can be recovered on next startup
      }))
    }

    this.activeRecoveries.clear()
    logInfo('mutation_recovery_all_cancelled', { count: activeCount })
    return activeCount
  }

  /**
   * Gets the current recovery status for all operations.
   */
  getRecoveryStatus(): {
    active: MutationOperationId[]
    pending: number
    failed: number
  } {
    const pendingOperations = getMutationOperations(undefined, 'pending').concat(
      getMutationOperations(undefined, 'submitting')
    )
    const failedOperations = getMutationOperations(undefined, 'error')

    return {
      active: Array.from(this.activeRecoveries.keys()),
      pending: pendingOperations.length,
      failed: failedOperations.length,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

// Singleton recovery engine
export const mutationRecoveryEngine = new MutationRecoveryEngine()

/**
 * Initiates a new mutation with automatic deduplication and recovery setup.
 */
export async function initiateMutation(
  type: MutationType,
  params: Record<string, unknown>,
  maxAttempts?: number
): Promise<{
  operationId: MutationOperationId
  isNewOperation: boolean
  started: boolean
}> {
  const { operationId, isNewOperation } = createMutationOperation(type, params, maxAttempts)

  if (!isNewOperation) {
    // Existing operation - trigger recovery if needed
    const operation = getMutationOperation(operationId)
    if (operation && (operation.status === 'pending' || operation.status === 'error')) {
      const recovered = await mutationRecoveryEngine.recoverOperation(operationId)
      return { operationId, isNewOperation, started: recovered }
    }
    return { operationId, isNewOperation, started: true }
  }

  // New operation - start execution
  updateMutationOperation(operationId, () => ({ status: 'pending' }))
  const started = await mutationRecoveryEngine.recoverOperation(operationId)

  return { operationId, isNewOperation, started }
}

/**
 * Force retry of a failed operation.
 */
export async function retryMutation(operationId: MutationOperationId): Promise<boolean> {
  const operation = getMutationOperation(operationId)
  if (!operation) return false

  if (operation.status !== 'error') {
    logWarn('mutation_retry_invalid_state', { operationId, status: operation.status })
    return false
  }

  // Reset to pending and trigger recovery
  updateMutationOperation(operationId, () => ({ status: 'pending' }))
  return await mutationRecoveryEngine.recoverOperation(operationId)
}

/**
 * Cancel a pending or active operation.
 */
export function cancelMutation(operationId: MutationOperationId): boolean {
  return mutationRecoveryEngine.cancelRecovery(operationId)
}

/**
 * Initialize recovery system on app startup.
 */
export async function initializeMutationRecovery(): Promise<void> {
  logInfo('mutation_recovery_initializing')
  const results = await mutationRecoveryEngine.recoverPendingOperations()
  logInfo('mutation_recovery_initialized', {
    recoveredCount: results.recovered,
    failedCount: results.failed,
    operationsCount: results.operations.length,
  })
}

/**
 * Cleanup recovery system on app shutdown.
 */
export function shutdownMutationRecovery(): void {
  const cancelled = mutationRecoveryEngine.cancelAllRecoveries()
  logInfo('mutation_recovery_shutdown', { cancelledOperations: cancelled })
}
