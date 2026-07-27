import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSession } from './useSession'
import { apiFetch } from '../api/client'

vi.mock('../api/client', () => ({
  apiFetch: vi.fn(),
}))

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches session data on mount', async () => {
    const mockSession = { address: 'G123' }
    vi.mocked(apiFetch).mockResolvedValue(mockSession)

    const { result } = renderHook(() => useSession())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(apiFetch).toHaveBeenCalledWith('/session')
    expect(result.current.data).toEqual(mockSession)
  })

  it('refetches session on window focus', async () => {
    const mockSession1 = { address: 'G123' }
    const mockSession2 = { address: 'G456' }

    vi.mocked(apiFetch).mockResolvedValueOnce(mockSession1)

    const { result } = renderHook(() => useSession())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(apiFetch).toHaveBeenCalledTimes(1)

    vi.mocked(apiFetch).mockResolvedValueOnce(mockSession2)

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockSession2)
    })
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })
})
