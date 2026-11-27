import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useActionToast } from './useActionToast'
import { ACTION_TOASTS, type ToastAction } from '../config/toastMessages'

const mockAddToast = vi.fn()

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useActionToast', () => {
  beforeEach(() => {
    mockAddToast.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds a success toast and returns the result when the promise resolves', async () => {
    const { result } = renderHook(() => useActionToast())

    let value
    await act(async () => {
      value = await result.current.withToast('sign', Promise.resolve('Success Data'))
    })

    expect(value).toBe('Success Data')
    expect(mockAddToast).toHaveBeenCalledWith('success', ACTION_TOASTS.sign.success)
    expect(mockAddToast).toHaveBeenCalledTimes(1)
  })

  it('adds a danger toast and rethrows the original rejection', async () => {
    const { result } = renderHook(() => useActionToast())
    const error = new Error('Test Error')

    let rejection: unknown
    await act(async () => {
      try {
        await result.current.withToast('delete', Promise.reject(error))
      } catch (caught) {
        rejection = caught
      }
    })

    expect(rejection).toBe(error)
    expect(mockAddToast).toHaveBeenCalledWith('danger', ACTION_TOASTS.delete.error)
    expect(mockAddToast).toHaveBeenCalledTimes(1)
  })

  it('invokes an async thunk lazily and exactly once', async () => {
    const { result } = renderHook(() => useActionToast())
    const thunk = vi.fn(async () => 'Thunk Result')

    expect(thunk).not.toHaveBeenCalled()

    let value
    await act(async () => {
      value = await result.current.withToast('approve', thunk)
    })

    expect(value).toBe('Thunk Result')
    expect(thunk).toHaveBeenCalledTimes(1)
    expect(mockAddToast).toHaveBeenCalledWith('success', ACTION_TOASTS.approve.success)
  })

  it('uses the configured message contract for every supported action', async () => {
    const { result } = renderHook(() => useActionToast())
    const actions: ToastAction[] = ['sign', 'send', 'approve', 'delete']

    await act(async () => {
      for (const action of actions) {
        await result.current.withToast(action, Promise.resolve(action))
      }
    })

    expect(mockAddToast).toHaveBeenCalledTimes(actions.length)
    actions.forEach((action, index) => {
      expect(mockAddToast).toHaveBeenNthCalledWith(index + 1, 'success', ACTION_TOASTS[action].success)
    })
  })

  it('preserves falsy and empty resolved values without treating them as failures', async () => {
    const { result } = renderHook(() => useActionToast())
    const boundaryValues = [undefined, null, false, 0, ''] as const
    const returned: unknown[] = []

    await act(async () => {
      for (const value of boundaryValues) {
        returned.push(await result.current.withToast('send', Promise.resolve(value)))
      }
    })

    expect(returned).toEqual(boundaryValues)
    expect(mockAddToast).toHaveBeenCalledTimes(boundaryValues.length)
    expect(mockAddToast).toHaveBeenCalledWith('success', ACTION_TOASTS.send.success)
  })

  it('rejects an unsupported runtime action before invoking an irreversible thunk', async () => {
    const { result } = renderHook(() => useActionToast())
    const thunk = vi.fn(async () => 'must not run')

    await act(async () => {
      await expect(
        result.current.withToast('archive' as ToastAction, thunk)
      ).rejects.toThrow('Unsupported action toast type.')
    })

    expect(thunk).not.toHaveBeenCalled()
    expect(mockAddToast).not.toHaveBeenCalled()
  })

  it('converts a synchronous thunk throw into the normal failure contract', async () => {
    const { result } = renderHook(() => useActionToast())
    const error = new Error('Synchronous failure')
    const thunk = vi.fn(() => {
      throw error
    })

    let rejection: unknown
    await act(async () => {
      try {
        await result.current.withToast('sign', thunk)
      } catch (caught) {
        rejection = caught
      }
    })

    expect(rejection).toBe(error)
    expect(thunk).toHaveBeenCalledTimes(1)
    expect(mockAddToast).toHaveBeenCalledWith('danger', ACTION_TOASTS.sign.error)
  })

  it('recovers cleanly when a caller retries after a failed attempt', async () => {
    const { result } = renderHook(() => useActionToast())
    const firstError = new Error('Temporary failure')
    let attempt = 0
    const thunk = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw firstError
      return 'Recovered result'
    })

    await act(async () => {
      await expect(result.current.withToast('approve', thunk)).rejects.toBe(firstError)
    })

    let recovered
    await act(async () => {
      recovered = await result.current.withToast('approve', thunk)
    })

    expect(recovered).toBe('Recovered result')
    expect(thunk).toHaveBeenCalledTimes(2)
    expect(mockAddToast).toHaveBeenNthCalledWith(1, 'danger', ACTION_TOASTS.approve.error)
    expect(mockAddToast).toHaveBeenNthCalledWith(2, 'success', ACTION_TOASTS.approve.success)
  })

  it('handles concurrent success and failure independently without stale cross-talk', async () => {
    const { result } = renderHook(() => useActionToast())
    const successful = deferred<string>()
    const failing = deferred<string>()
    const error = new Error('Concurrent failure')
    let outcomes: PromiseSettledResult<string>[] = []

    await act(async () => {
      const calls = [
        result.current.withToast('send', successful.promise),
        result.current.withToast('delete', failing.promise),
      ]

      failing.reject(error)
      successful.resolve('Concurrent success')
      outcomes = await Promise.allSettled(calls)
    })

    expect(outcomes[0]).toEqual({ status: 'fulfilled', value: 'Concurrent success' })
    expect(outcomes[1]).toEqual({ status: 'rejected', reason: error })
    expect(mockAddToast).toHaveBeenCalledTimes(2)
    expect(mockAddToast).toHaveBeenCalledWith('success', ACTION_TOASTS.send.success)
    expect(mockAddToast).toHaveBeenCalledWith('danger', ACTION_TOASTS.delete.error)
  })

  it('treats duplicate invocations as isolated calls and emits exactly one toast per call', async () => {
    const { result } = renderHook(() => useActionToast())
    const sharedPromise = Promise.resolve('Shared result')

    let values: string[] = []
    await act(async () => {
      values = await Promise.all([
        result.current.withToast('send', sharedPromise),
        result.current.withToast('send', sharedPromise),
      ])
    })

    expect(values).toEqual(['Shared result', 'Shared result'])
    expect(mockAddToast).toHaveBeenCalledTimes(2)
    expect(mockAddToast).toHaveBeenNthCalledWith(1, 'success', ACTION_TOASTS.send.success)
    expect(mockAddToast).toHaveBeenNthCalledWith(2, 'success', ACTION_TOASTS.send.success)
  })
})
