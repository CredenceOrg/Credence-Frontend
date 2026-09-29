import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { updateSettings } from '../api/settings'
import { useSettingsMutation } from './useSettingsMutation'

vi.mock('../api/settings', () => ({ updateSettings: vi.fn() }))

const settings = {
  themeMode: 'system' as const,
  network: 'public',
  addressDisplay: 'short',
  toastsEnabled: true,
  autoDismiss: '5s',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}

describe('useSettingsMutation', () => {
  it('passes the complete settings payload to the API mutation', async () => {
    vi.mocked(updateSettings).mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useSettingsMutation())

    await act(async () => {
      await result.current.mutateAsync(settings)
    })

    expect(updateSettings).toHaveBeenCalledWith(settings)
    expect(result.current.isSuccess).toBe(true)
  })
})
