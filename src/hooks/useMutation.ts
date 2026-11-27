/**
 * @file useMutation.ts
 * @description React hook for concurrent, race-safe mutations.
 *
 * Provides a high-level interface to MutationManager for use in React components.
 * Handles lifecycle management, AbortSignal cleanup, and proper dependency tracking.
 *
 * Key features:
 * - Automatic deduplication of concurrent identical mutations
 * - Automatic retry with exponential backoff on transient failures
 * - Versioning to prevent stale results from overwriting newer ones
 * - Idempotent retries via idempotency keys
 * - Full TypeScript support for request/response types
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import {
  MutationManager,
  createIdempotencyKey,
  type IdempotencyKey,
  type RetryConfig,
  DEFAULT_RETRY_CONFIG,
  type MutationResult,
} from '../lib/mutationManager'

/**
 * Options for configuring a mutation.
 */
export interface UseMutationOptions<T> {
  /** Override default retry configuration. */
  retryConfig?: RetryConfig
  /** Called when mutation starts. */
  onStart?: () => void
  /** Called when mutation succeeds. */
  onSuccess?: (data: T) => void
  /** Called when mutation fails. */
  onError?: (error: Error, category: string) => void
  /** Called when mutation completes (success or failure). */
  onSettled?: (data: T | null, error: Error | null) => void
}

/**
 * State returned by useMutation hook.
 */
export interface UseMutationState<T> {
  /** The mutated data, or null if not yet successful. */
  data: T | null
  /** Loading state — true while mutation is in-flight. */
  isLoading: boolean
  /** Latest error, or null if successful or not yet executed. */
  error: Error | null
  /** Categorized error type (for UI routing). */
  errorCategory: string | null
  /** Total attempts made including retries. */
  attempts: number
  /** Whether this is a retry attempt. */
  isRetry: boolean
}

/**
 * Result of mutate() call — carries mutation state plus metadata.
 */
export interface UseMutationResult<T> extends UseMutationState<T> {
  /** Call to execute the mutation. */
  mutate: (mutationFn: (signal: AbortSignal) => Promise<T>) => Promise<MutationResult<T>>
  /** Reset state to initial values. */
  reset: () => void
  /** Idempotency key for the current or last mutation. */
  idempotencyKey: IdempotencyKey | null
}

/**
 * Process-wide mutation manager instance.
 * Shared across all useMutation hooks in the application to provide
 * app-level deduplication and concurrency safety.
 */
let globalMutationManager: MutationManager<unknown> | null = null

function getGlobalMutationManager(): MutationManager<unknown> {
  if (!globalMutationManager) {
    globalMutationManager = new MutationManager(DEFAULT_RETRY_CONFIG)
  }
  return globalMutationManager
}

/**
 * Reset the global mutation manager. Useful for testing.
 */
export function resetGlobalMutationManager(): void {
  if (globalMutationManager) {
    globalMutationManager.cancelAll()
    globalMutationManager.clear()
  }
  globalMutationManager = null
}

/**
 * React hook for executing concurrent, race-safe mutations.
 *
 * **Basic Usage**:
 * ```tsx
 * const { mutate, data, isLoading, error } = useMutation<Bond>({
 *   retryConfig: { maxRetries: 3, initialDelayMs: 500, maxDelayMs: 10000 },
 *   onSuccess: (bond) => console.log('Created:', bond),
 *   onError: (err) => console.error('Failed:', err),
 * })
 *
 * const handleCreateBond = async () => {
 *   await mutate(async (signal) => {
 *     return await apiFetch<Bond>('/bonds', {
 *       method: 'POST',
 *       body: { amount: 1000, duration: 30 },
 *       signal,
 *     })
 *   })
 * }
 * ```
 *
 * **Idempotent Retries**:
 * Provide an idempotency key to enable safe retries:
 * ```tsx
 * const { mutate } = useMutation<Bond>()
 *
 * const handleCreateBond = async (amount: number) => {
 *   const key = createIdempotencyKey('/bonds', 'POST', { amount })
 *   const result = await mutate(
 *     async (signal) => {
 *       return await apiFetch<Bond>('/bonds', { method: 'POST', body: { amount }, signal })
 *     },
 *     { idempotencyKey: key }
 *   )
 * }
 * ```
 *
 * **Lifecycle Callbacks**:
 * ```tsx
 * const { mutate } = useMutation<Bond>({
 *   onStart: () => setIsSubmitting(true),
 *   onSuccess: (bond) => navigate(`/bonds/${bond.id}`),
 *   onError: (err) => showErrorBanner(err.message),
 *   onSettled: () => setIsSubmitting(false),
 * })
 * ```
 *
 * @template T The type of data produced by the mutation.
 * @param options Hook configuration.
 * @returns Mutation state, mutate function, and reset function.
 */
export function useMutation<T = unknown>(
  options: UseMutationOptions<T> = {}
): UseMutationResult<T> {
  const [state, setState] = useState<UseMutationState<T>>({
    data: null,
    isLoading: false,
    error: null,
    errorCategory: null,
    attempts: 0,
    isRetry: false,
  })

  const idempotencyKeyRef = useRef<IdempotencyKey | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)

  const manager = getGlobalMutationManager() as MutationManager<T>

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  const mutate = useCallback(
    async (
      mutationFn: (signal: AbortSignal) => Promise<T>,
      mutationOptions?: { idempotencyKey?: IdempotencyKey }
    ): Promise<MutationResult<T>> => {
      // Create abort signal for this mutation
      const controller = new AbortController()
      abortControllerRef.current = controller

      // Generate or use provided idempotency key
      const key = mutationOptions?.idempotencyKey ?? createIdempotencyKey('', 'MUTATION')
      idempotencyKeyRef.current = key

      // Update to loading state
      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, isLoading: true, error: null, errorCategory: null }))
      }

      options.onStart?.()

      try {
        // Execute mutation through the global manager
        const result = await manager.mutate(
          (signal) => mutationFn(signal),
          {
            key,
            signal: controller.signal,
            retryConfig: options.retryConfig,
          }
        )

        // Update state only if component is still mounted
        if (!isMountedRef.current) {
          return result
        }

        if (result.data !== null) {
          // Success
          setState({
            data: result.data,
            isLoading: false,
            error: null,
            errorCategory: null,
            attempts: result.attempts,
            isRetry: result.isRetry,
          })
          options.onSuccess?.(result.data)
          options.onSettled?.(result.data, null)
        } else {
          // Failure
          const error = result.error ?? new Error('Unknown mutation error')
          setState({
            data: null,
            isLoading: false,
            error,
            errorCategory: result.errorCategory,
            attempts: result.attempts,
            isRetry: result.isRetry,
          })
          options.onError?.(error, result.errorCategory ?? 'unknown')
          options.onSettled?.(null, error)
        }

        return result
      } catch (err) {
        // Should not happen (manager doesn't throw), but handle gracefully
        const error = err instanceof Error ? err : new Error(String(err))
        if (isMountedRef.current) {
          setState({
            data: null,
            isLoading: false,
            error,
            errorCategory: 'unknown',
            attempts: 0,
            isRetry: false,
          })
          options.onError?.(error, 'unknown')
          options.onSettled?.(null, error)
        }
        throw error
      }
    },
    [options, manager]
  )

  const reset = useCallback(() => {
    if (isMountedRef.current) {
      setState({
        data: null,
        isLoading: false,
        error: null,
        errorCategory: null,
        attempts: 0,
        isRetry: false,
      })
    }
  }, [])

  return {
    ...state,
    mutate,
    reset,
    idempotencyKey: idempotencyKeyRef.current,
  }
}

/**
 * Get the global mutation manager instance.
 * Useful for advanced use cases like manual cancellation or state inspection.
 *
 * @returns The global MutationManager instance.
 */
export function getGlobalMutationManagerInstance(): MutationManager<unknown> {
  return getGlobalMutationManager()
}
