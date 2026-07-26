import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useApiMutation } from './useApiMutation'

describe('useApiMutation', () => {
  it('applies optimistic updates and rolls back on error', async () => {
    const mutationFn = vi.fn().mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() =>
      useApiMutation<string[], string, { previousData: string[] | undefined }>({
        mutationFn: async (variables) => {
          await Promise.resolve()
          return mutationFn(variables)
        },
        onMutate: (variables, helpers) => {
          helpers.setData((current) => [...(current ?? []), variables])
          return { previousData: undefined }
        },
      })
    )

    await act(async () => {
      await expect(result.current.mutateAsync('optimistic')).rejects.toThrow('boom')
    })

    expect(result.current.isPending).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.data).toBeUndefined()
  })
})
