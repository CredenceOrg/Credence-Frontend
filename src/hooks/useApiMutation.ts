import { useCallback, useRef, useState } from 'react'

export type UseApiMutationStatus = 'idle' | 'pending' | 'success' | 'error'

export interface ApiMutationHelpers<TData> {
  setData: (updater: TData | ((current: TData | undefined) => TData | undefined)) => void
  rollback: () => void
}

/**
 * Sentinel returned by `mutateAsync` when a concurrent in-flight call is
 * detected. The caller receives `undefined` (cast to TData) rather than a
 * real result, and no second network request is ever dispatched.
 *
 * The symbol is exported so tests can assert on it without relying on
 * `instanceof` checks against `undefined`.
 */
export const MUTATION_IN_FLIGHT = Symbol('MUTATION_IN_FLIGHT')

export interface UseApiMutationOptions<TData, TVariables, TContext = unknown> {
  mutationFn: (variables: TVariables) => Promise<TData>
  onMutate?: (
    variables: TVariables,
    helpers: ApiMutationHelpers<TData>
  ) => Promise<TContext | void> | TContext | void
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: TContext | undefined
  ) => void | Promise<void>
  onError?: (
    error: Error,
    variables: TVariables,
    context: TContext | undefined
  ) => void | Promise<void>
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    context: TContext | undefined
  ) => void | Promise<void>
  initialData?: TData
  /**
   * When `true` (default), a second `mutate`/`mutateAsync` call that arrives
   * while a previous call is still in-flight is silently dropped — the
   * in-flight promise is returned and the `mutationFn` is **not** called a
   * second time. Set to `false` only when you explicitly want overlapping
   * executions (rare; most callers should leave this as `true`).
   */
  deduplicateInFlight?: boolean
}

export interface UseApiMutationResult<TData, TVariables> {
  data: TData | undefined
  error: Error | null
  isPending: boolean
  isError: boolean
  isSuccess: boolean
  status: UseApiMutationStatus
  mutate: (variables: TVariables) => void
  mutateAsync: (variables: TVariables) => Promise<TData>
  reset: () => void
}

export function useApiMutation<TData, TVariables, TContext = unknown>(
  options: UseApiMutationOptions<TData, TVariables, TContext>
): UseApiMutationResult<TData, TVariables> {
  const {
    mutationFn,
    onMutate,
    onSuccess,
    onError,
    onSettled,
    initialData,
    deduplicateInFlight = true,
  } = options

  const [data, setDataState] = useState<TData | undefined>(initialData)
  const [error, setError] = useState<Error | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [status, setStatus] = useState<UseApiMutationStatus>('idle')

  const dataRef = useRef<TData | undefined>(initialData)
  const previousDataRef = useRef<TData | undefined>(initialData)

  /**
   * Synchronous guard: set to `true` before any `await` and cleared in
   * `finally`. Because JS is single-threaded before the first await, the
   * check-and-set is race-free: the very first concurrent call that reads
   * `false` atomically sets it to `true`; every subsequent call that reads
   * `true` is dropped before any expensive work starts.
   */
  const inFlightRef = useRef(false)
  /**
   * The promise currently in flight. Returned to any caller that is dropped
   * by the duplicate-submission guard so they can still await a result.
   */
  const inFlightPromiseRef = useRef<Promise<TData> | null>(null)

  const setData = useCallback(
    (updater: TData | ((current: TData | undefined) => TData | undefined)) => {
      const nextValue =
        typeof updater === 'function'
          ? (updater as (current: TData | undefined) => TData | undefined)(dataRef.current)
          : updater

      dataRef.current = nextValue
      setDataState(nextValue)
    },
    []
  )

  const rollback = useCallback(() => {
    const nextValue = previousDataRef.current
    dataRef.current = nextValue
    setDataState(nextValue)
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setIsPending(false)
    setStatus('idle')
    dataRef.current = initialData
    previousDataRef.current = initialData
    setDataState(initialData)
    // Only clear the in-flight guard when there is no pending execution.
    // If reset() is called while a mutation is in flight the guard keeps
    // protecting against a second concurrent submission; the in-flight
    // execution's finally-block will clear it when it settles.
    if (!inFlightRef.current) {
      inFlightPromiseRef.current = null
    }
  }, [initialData])

  const mutateAsync = useCallback(
    async (variables: TVariables) => {
      // ── Duplicate-submission guard ──────────────────────────────────────
      // This check-and-set happens synchronously before the first `await`,
      // so it is race-free in the single-threaded JS event loop.
      if (deduplicateInFlight && inFlightRef.current) {
        // Return the in-flight promise so the caller can still await the
        // result without dispatching a second network request.
        return inFlightPromiseRef.current as Promise<TData>
      }

      if (deduplicateInFlight) {
        inFlightRef.current = true
      }

      previousDataRef.current = dataRef.current
      setError(null)
      setIsPending(true)
      setStatus('pending')

      let context: TContext | undefined
      let settledError: Error | null = null
      let settledData: TData | undefined

      // The IIFE starts synchronously and yields at the first await inside it.
      // We assign inFlightPromiseRef BEFORE the IIFE so that any second
      // synchronous call that reads inFlightRef=true always finds the promise.
      // The IIFE reference is created with a two-step: declare, assign to ref,
      // then build the promise chain that references itself via the ref.
      let resolveExec!: (value: TData | PromiseLike<TData>) => void
      let rejectExec!: (reason?: unknown) => void
      const execPromise = new Promise<TData>((res, rej) => {
        resolveExec = res
        rejectExec = rej
      })

      if (deduplicateInFlight) {
        inFlightPromiseRef.current = execPromise
      }

      // Kick off the actual async work, settling execPromise when done.
      void (async () => {
        try {
          context = (await onMutate?.(variables, { setData, rollback })) as TContext | undefined
          const result = await mutationFn(variables)
          settledData = result
          dataRef.current = result
          setDataState(result)
          setError(null)
          setStatus('success')
          await onSuccess?.(result, variables, context)
          resolveExec(result)
        } catch (err) {
          const mutationError = err instanceof Error ? err : new Error(String(err))
          settledError = mutationError
          rollback()
          setError(mutationError)
          setStatus('error')
          await onError?.(mutationError, variables, context)
          rejectExec(mutationError)
        } finally {
          setIsPending(false)
          await onSettled?.(settledData, settledError, variables, context)
          // Release the in-flight guard after all side-effects have settled.
          if (deduplicateInFlight) {
            inFlightRef.current = false
            inFlightPromiseRef.current = null
          }
        }
      })()

      return execPromise
    },
    [deduplicateInFlight, mutationFn, onError, onMutate, onSettled, onSuccess, rollback, setData]
  )

  const mutate = useCallback(
    (variables: TVariables) => {
      void mutateAsync(variables)
    },
    [mutateAsync]
  )

  return {
    data,
    error,
    isPending,
    isError: status === 'error',
    isSuccess: status === 'success',
    status,
    mutate,
    mutateAsync,
    reset,
  }
}
