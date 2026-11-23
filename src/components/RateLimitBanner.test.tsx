import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RateLimitBanner from './RateLimitBanner'
import { apiFetch } from '../api/client'

async function triggerRateLimit(retryAfterSeconds: number) {
  const fetchMock = vi.fn().mockResolvedValueOnce(
    new Response('', {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    })
  )
  vi.stubGlobal('fetch', fetchMock)
  await act(async () => {
    await apiFetch('/limited').catch(() => undefined)
  })
}

describe('RateLimitBanner', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    cleanup()
  })

  it('renders nothing while no rate-limit window is active', () => {
    render(<RateLimitBanner />)
    expect(screen.queryByText(/too many requests/i)).toBeNull()
  })

  it('shows the retry countdown from the server Retry-After value', async () => {
    render(<RateLimitBanner />)
    await triggerRateLimit(5)

    expect(screen.getByText('Too many requests, retry in 5 s')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: /information banner/i })).toBeInTheDocument()
  })

  it('counts down each second and disappears at zero', async () => {
    vi.useFakeTimers()
    render(<RateLimitBanner />)
    await triggerRateLimit(2)

    expect(screen.getByText('Too many requests, retry in 2 s')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('Too many requests, retry in 1 s')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText(/too many requests/i)).toBeNull()
  })

  it('can be dismissed and re-opens on a new rate-limit notice', async () => {
    const user = userEvent.setup()
    render(<RateLimitBanner />)
    await triggerRateLimit(5)

    await user.click(screen.getByRole('button', { name: /dismiss banner/i }))
    expect(screen.queryByText(/too many requests/i)).toBeNull()

    await triggerRateLimit(3)
    expect(screen.getByText('Too many requests, retry in 3 s')).toBeInTheDocument()
  })

  it('clears its countdown timer on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const { unmount } = render(<RateLimitBanner />)
    await triggerRateLimit(5)

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
