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

import { apiFetch, ApiError, ApiRateLimitError } from '../api/client'
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
import { validateBondAmount, validateTrustScoreAddress } from './mutationGuard'
import { logInfo, logWarn, logError } from './log'

// ═══════════════════════════════════════════════════════════════════════════
// Injectable Executor Interface
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Injectable bond executor — allows tests to inject failures at the exact
 * network/wallet boundary without mocking the entire module.
 *
 * The production default uses the real `submitCreateBond` /
 * `submitWithdrawBond` implementations. Tests swap in fakes via
 * `setBondExecutors()`.
 */
export interface BondExecutors {
  createBond: (params: { amountUsdc: number }) => Promise<{ hash: string }>
  withdrawBond: (params: { bondId: number; amountUsdc: number }) => Promise<{ hash: string }>
}

/**
 * Injectable trust-score executor — separates the apiFetch call from the
 * recovery engine so failures can be injected at the HTTP boundary.
 */
export type TrustScoreExecutor = (
  address: string,
  signal: AbortSignal
) => Promise<Record<string, unknown>>

let _bondExecutors: BondExecutors = {
  createBond: submitCreateBond,
  withdrawBond: submitWithdrawBond,
}

let _trustScoreExecutor: TrustScoreExecutor = async (address, signal) => {
  const result = await apiFetch(`/trust-score/${encodeURIComponent(address)}`, { signal })
  return result as Record<string, unknown>
}

/**
 * Replaces the live bond executors with test doubles.
 * Returns the previous executors so tests can restore them.
 *
 * @example
 * ```ts
 * const original = setBondExecutors({ createBond: fakeFn, withdrawBond: fakeFn })
 * try { ... } finally { setBondExecutors(original) }
 * ```
 */
export function setBondExecutors(executors: BondExecutors): BondExecutors {
  const previous = _bondExecutors
  _bondExecutors = executors
  return previous
}

/**
 * Replaces the live trust-score executor with a test double.
 * Returns the previous executor so tests can restore it.
 */
export function setTrustScoreExecutor(executor: TrustScoreExecutor): TrustScoreExecutor {
  const previous = _trustScoreExecutor
  _trustScoreExecutor = executor
  return previous
}

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

/** Coerce a payload's `retryAfterMs` to a positive finite number, else undefined. */
function safeNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function apiErrorToMutationError(apiError: ApiError): MutationError {
  let type: MutationError['type'] = 'generic'
  let retryable = true

  // Check for wallet rejection patterns
  if (
    apiError.message.toLowerCase().includes('user rejected') ||
    apiError.message.toLowerCase().includes('cancelled') ||
    apiError.message.toLowerCase().includes('denied')
  ) {
    type = 'wallet_rejected'
    retryable = false
  } else if (apiError.status === 429) {
    type = 'rate_limit'
    retryable = false
  } else if (apiError.status === 0) {
    type = 'network'
  } else if (apiError.status >= 400 && apiError.status < 500) {
    type = 'validation'
    retryable = false
  } else if (apiError.status >= 500) {
    type = 'backend'
  }

  const retryAfterMs =
    apiError.payload && typeof apiError.payload === 'object' && 'retryAfterMs' in apiError.payload
      ? safeNumber(apiError.payload.retryAfterMs)
      : apiError instanceof ApiRateLimitError
        ? apiError.retryAfterMs
        : undefined

  const mutationError = createMutationError(type, apiError.message, retryable, apiError.status)
  if (retryAfterMs !== undefined) {
    mutationError.retryAfterMs = retryAfterMs
  }
  return mutationError
}

function parseUnknownError(error: unknown): MutationError {
  if (error instanceof ApiError) {
    return apiErrorToMutationError(error)
  }
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()
  if (
    lower.includes('user rejected') ||
    lower.includes('rejected') ||
    lower.includes('cancelled') ||
    lower.includes('denied')
  ) {
    return createMutationError('wallet_rejected', message, false)
  }
  return createMutationError('generic', message, true)
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
  const amount = validateBondAmount(params?.amountUsdc)
  if (!amount.ok) {
    // Bounded input: reject adversarial/burst sizes before any expensive work.
    return {
      success: false,
      error: createMutationError('validation', amount.message, false),
    }
  }

  try {
    // Use the injectable executor so tests can inject failures at this boundary.
    const result = await _bondExecutors.createBond({ amountUsdc: amount.value })
    return {
      success: true,
      txHash: result.hash,
      response: { hash: result.hash, amountUsdc: amount.value },
    }
  } catch (error) {
    const mutationError = parseUnknownError(error)
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
  const amount = validateBondAmount(params?.amountUsdc)
  if (!amount.ok) {
    return {
      success: false,
      error: createMutationError('validation', amount.message, false),
    }
  }
  if (!Number.isSafeInteger(params?.bondId) || (params?.bondId ?? 0) <= 0) {
    return {
      success: false,
      error: createMutationError('validation', 'Bond id must be a positive integer.', false),
    }
  }

  try {
    // Use the injectable executor so tests can inject failures at this boundary.
    const result = await _bondExecutors.withdrawBond({
      bondId: params.bondId,
      amountUsdc: amount.value,
    })
    return {
      success: true,
      txHash: result.hash,
      response: { hash: result.hash, bondId: params.bondId, amountUsdc: amount.value },
    }
  } catch (error) {
    const mutationError = parseUnknownError(error)
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
  const address = validateTrustScoreAddress(params?.address)
  if (!address.ok) {
    // Bounded input: reject unbounded/empty addresses before the lookup path.
    return {
      success: false,
      error: createMutationError('validation', address.message, false),
    }
  }

  try {
    // Use the injectable executor so tests can inject failures at the HTTP boundary.
    const result = await _trustScoreExecutor(address.value, context.signal)
    return {
      success: true,
      response: result,
    }
  } catch (error) {
    // Preserve the full ApiError rather than re-parsing from a plain Error,
    // which previously discarded status/payload and made error categorisation
    // non-deterministic.
    const mutationError =
      error instanceof ApiError
        ? apiErrorToMutationError(error)
        : parseUnknownError(error)

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
      } else if (
        operation.status === 'pending' ||
        operation.status === 'error' ||
        operation.status === 'idle'
      ) {
        // Resume execution from where it left off
        return await this.resumeOperation(operationId, controller.signal, operation)
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
   *
   * Additional invariant: if the last attempt has `status:'committed'` it
   * means the network call returned a tx hash but the final `status:'success'`
   * write did not complete (e.g. process killed between the two writes). We
   * treat that as confirmed rather than re-submitting, preventing
   * double-submission.
   */
  private async recoverSubmittingOperation(
    operationId: MutationOperationId,
    signal: AbortSignal
  ): Promise<boolean> {
    const operation = getMutationOperation(operationId)
    if (!operation) return false

    const lastAttempt = operation.attempts[operation.attempts.length - 1]
    if (!lastAttempt) return false

    // ── Committed-state detection ────────────────────────────────────────
    // A 'committed' attempt means the tx hash was persisted but the operation
    // status was not yet set to 'success'. Promote directly — do not retry.
    if ((lastAttempt.status as string) === 'committed' && lastAttempt.txHash) {
      updateMutationOperation(operationId, (op) => ({
        status: 'success',
        finalTxHash: lastAttempt.txHash,
        completedAt: new Date().toISOString(),
        attempts: op.attempts.map((a) =>
          a.attemptId === lastAttempt.attemptId ? { ...a, status: 'success' as const } : a
        ),
      }))
      logInfo('mutation_recovery_committed_promoted', {
        operationId,
        txHash: lastAttempt.txHash,
      })
      return true
    }

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
          status: 'error' as const,
          error: createMutationError('timeout', 'Operation timed out during recovery', true),
        },
      ],
    }))

    // Retry if we haven't exceeded max attempts
    if (operation.attempts.length < operation.maxAttempts) {
      return await this.resumeOperation(operationId, signal, operation)
    }

    return false
  }

  /**
   * Resumes execution of a pending operation.
   */
  private async resumeOperation(
    operationId: MutationOperationId,
    signal: AbortSignal,
    opParam?: MutationOperation
  ): Promise<boolean> {
    if (signal.aborted) return false
    const operation = getMutationOperation(operationId) || opParam
    if (!operation || operation.status === 'cancelled') return false

    if (operation.attempts.length >= operation.maxAttempts) {
      logWarn('mutation_recovery_max_attempts_exceeded', { operationId })
      return false
    }

    // Calculate retry delay based on previous attempts
    const retryDelay = calculateRetryDelay(operation.attempts.length + 1, this.retryPolicy)
    if (retryDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }

    if (signal.aborted) return false

    return await this.executeOperationAttempt(operationId, signal, operation)
  }

  /**
   * Executes a single operation attempt with proper state management.
   *
   * Atomic-rollback invariants enforced here:
   *
   * 1. **Committed-state guard** — as soon as the network/wallet call returns
   *    a tx hash the attempt is immediately written with `status:'committed'`
   *    and the `txHash` persisted. Only *after* that write succeeds is the
   *    operation promoted to `status:'success'`. On recovery, an attempt whose
   *    `status` is `'committed'` is treated as confirmed rather than retried,
   *    preventing double-submission.
   *
   * 2. **Fresh attempt-count** — the retry-eligibility check reads the
   *    operation back from storage after the attempt record has been written
   *    so the count includes the just-completed attempt. The stale closure
   *    value `operation.attempts.length` could have been one-behind, allowing
   *    one extra retry past `maxAttempts`.
   */
  private async executeOperationAttempt(
    operationId: MutationOperationId,
    signal: AbortSignal,
    opParam?: MutationOperation
  ): Promise<boolean> {
    if (signal.aborted) return false
    const operation = getMutationOperation(operationId) || opParam
    if (!operation || operation.status === 'cancelled') return false

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
          status: 'submitting' as const,
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
        // ── Committed-state guard (fix #2) ──────────────────────────────
        // Write the tx hash and mark the attempt as 'committed' BEFORE
        // setting the operation status to 'success'. If the process dies
        // between these two writes, recovery will find a 'committed' attempt
        // with a tx hash and treat it as confirmed rather than retrying.
        updateMutationOperation(operationId, (op) => ({
          attempts: op.attempts.map((attempt) =>
            attempt.attemptId === attemptId
              ? {
                  ...attempt,
                  status: 'committed' as unknown as typeof attempt.status,
                  txHash: result.txHash,
                  response: result.response,
                }
              : attempt
          ),
        }))

        // Now safe to mark the operation itself as success.
        updateMutationOperation(operationId, (op) => ({
          status: 'success',
          finalTxHash: result.txHash,
          finalResponse: result.response,
          completedAt: new Date().toISOString(),
          attempts: op.attempts.map((attempt) =>
            attempt.attemptId === attemptId
              ? { ...attempt, status: 'success' as const }
              : attempt
          ),
        }))

        logInfo('mutation_recovery_success', { operationId, txHash: result.txHash })
        return true
      } else {
        // Update failed attempt and read FRESH attempt count from storage
        // (fix #3) so the retry guard uses the post-write count.
        updateMutationOperation(operationId, (op) => ({
          attempts: op.attempts.map((attempt) =>
            attempt.attemptId === attemptId
              ? { ...attempt, status: 'error' as const, error: result.error }
              : attempt
          ),
        }))

        // Read back the operation to get the authoritative attempt count.
        const freshOp = getMutationOperation(operationId)
        const freshAttemptCount = freshOp?.attempts.length ?? operation.attempts.length + 1
        const canRetry =
          result.shouldRetry === true && freshAttemptCount < (freshOp?.maxAttempts ?? operation.maxAttempts)

        updateMutationOperation(operationId, () => ({
          status: canRetry ? 'pending' : 'error',
        }))

        if (canRetry) {
          logInfo('mutation_recovery_retry_scheduled', {
            operationId,
            attemptNumber: freshAttemptCount,
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
            ? { ...attempt, status: 'error' as const, error: executionError }
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
