import { useCallback, useRef, useState } from 'react'

export type UseApiMutationStatus = 'idle' | 'pending' | 'success' | 'error'

export interface ApiMutationHelpers<TData> {
  setData: (updater: TData | ((current: TData | undefined) => TData | undefined)) => void
  rollback: () => void
}

export interface UseApiMutationOptions<TData, TVariables, TContext = unknown> {
  mutationFn: (variables: TVariables) => Promise<TData>
  onMutate?: (
    variables: TVariables,
    helpers: ApiMutationHelpers<TData>,
  ) => Promise<TContext | void> | TContext | void
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void | Promise<void>
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void | Promise<void>
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    context: TContext | undefined,
  ) => void | Promise<void>
  initialData?: TData
}

export interface UseApiMutationResult<TData, TVariables, TContext = unknown> {
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
  options: UseApiMutationOptions<TData, TVariables, TContext>,
): UseApiMutationResult<TData, TVariables, TContext> {
  const {
    mutationFn,
    onMutate,
    onSuccess,
    onError,
    onSettled,
    initialData,
  } = options

  const [data, setDataState] = useState<TData | undefined>(initialData)
  const [error, setError] = useState<Error | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [status, setStatus] = useState<UseApiMutationStatus>('idle')

  const dataRef = useRef<TData | undefined>(initialData)
  const previousDataRef = useRef<TData | undefined>(initialData)

  const setData = useCallback((updater: TData | ((current: TData | undefined) => TData | undefined)) => {
    const nextValue =
      typeof updater === 'function'
        ? (updater as (current: TData | undefined) => TData | undefined)(dataRef.current)
        : updater

    dataRef.current = nextValue
    setDataState(nextValue)
  }, [])

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
  }, [initialData])

  const mutateAsync = useCallback(
    async (variables: TVariables) => {
      previousDataRef.current = dataRef.current
      setError(null)
      setIsPending(true)
      setStatus('pending')

      let context: TContext | undefined
      let settledError: Error | null = null
      let settledData: TData | undefined

      try {
        context = (await onMutate?.(variables, { setData, rollback })) as TContext | undefined
        const result = await mutationFn(variables)
        settledData = result
        dataRef.current = result
        setDataState(result)
        setError(null)
        setStatus('success')
        await onSuccess?.(result, variables, context)
        return result
      } catch (err) {
        const mutationError = err instanceof Error ? err : new Error(String(err))
        settledError = mutationError
        rollback()
        setError(mutationError)
        setStatus('error')
        await onError?.(mutationError, variables, context)
        throw mutationError
      } finally {
        setIsPending(false)
        await onSettled?.(settledData, settledError, variables, context)
      }
    },
    [mutationFn, onError, onMutate, onSettled, onSuccess, rollback, setData],
  )

  const mutate = useCallback((variables: TVariables) => {
    void mutateAsync(variables)
  }, [mutateAsync])

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
