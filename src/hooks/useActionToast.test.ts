import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useActionToast } from './useActionToast'
import { ACTION_TOASTS } from '../config/toastMessages'

const mockAddToast = vi.fn()

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}))

describe('useActionToast', () => {
  beforeEach(() => {
    mockAddToast.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds a success toast and returns the result when the promise resolves', async () => {
    const { result } = renderHook(() => useActionToast())

    const promise = Promise.resolve('Success Data')

    let value
    await act(async () => {
      value = await result.current.withToast('sign', promise)
    })

    expect(value).toBe('Success Data')
    expect(mockAddToast).toHaveBeenCalledWith('success', ACTION_TOASTS['sign'].success)
    expect(mockAddToast).toHaveBeenCalledTimes(1)
  })

  it('adds a danger toast and rethrows when the promise rejects', async () => {
    const { result } = renderHook(() => useActionToast())

    const error = new Error('Test Error')
    const promise = Promise.reject(error)

    await act(async () => {
      await expect(result.current.withToast('delete', promise)).rejects.toThrow('Test Error')
    })

    expect(mockAddToast).toHaveBeenCalledWith('danger', ACTION_TOASTS['delete'].error)
    expect(mockAddToast).toHaveBeenCalledTimes(1)
  })

  it('works identically with an async thunk', async () => {
    const { result } = renderHook(() => useActionToast())

    const thunk = async () => 'Thunk Result'

    let value
    await act(async () => {
      value = await result.current.withToast('approve', thunk)
    })

    expect(value).toBe('Thunk Result')
    expect(mockAddToast).toHaveBeenCalledWith('success', ACTION_TOASTS['approve'].success)
  })
})
