import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerSW, type RegisterSWOptions } from 'virtual:pwa-register'
import { usePwaUpdate } from './usePwaUpdate'
import {
  createIdempotencyKey,
} from '../lib/mutationManager'
import {
  getGlobalMutationManagerInstance,
  resetGlobalMutationManager,
} from './useMutation'

describe('usePwaUpdate', () => {
  let registerOptions: RegisterSWOptions | undefined
  const updateSW = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    resetGlobalMutationManager()
    registerOptions = undefined
    updateSW.mockClear()
    vi.mocked(registerSW).mockImplementation((options) => {
      registerOptions = options
      return updateSW
    })
  })

  it('shows the update prompt and applies the update when requested', async () => {
    const { result } = renderHook(() => usePwaUpdate())

    act(() => registerOptions?.onNeedRefresh?.())
    expect(result.current.needRefresh).toBe(true)

    await act(async () => result.current.applyUpdate())
    expect(updateSW).toHaveBeenCalledWith(true)
  })

  it('defers a requested update until the active mutation completes', async () => {
    let finishMutation!: () => void
    const mutationManager = getGlobalMutationManagerInstance()
    const mutation = mutationManager.mutate(
      () =>
        new Promise<void>((resolve) => {
          finishMutation = resolve
        }),
      { key: createIdempotencyKey('/pwa-update-test') }
    )
    const { result } = renderHook(() => usePwaUpdate())

    act(() => registerOptions?.onNeedRefresh?.())
    await act(async () => result.current.applyUpdate())

    expect(result.current.isUpdateDeferred).toBe(true)
    expect(updateSW).not.toHaveBeenCalled()

    await act(async () => {
      finishMutation()
      await mutation
    })

    await waitFor(() => expect(updateSW).toHaveBeenCalledWith(true))
  })
})

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(),
}))
