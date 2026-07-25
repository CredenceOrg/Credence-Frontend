import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useWidgetCache, WidgetCacheProvider, __TESTING__ } from './WidgetCache'

function flushPromises() {
  // Resolve any pending microtasks/promises without waiting on real timers.
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function renderWithProvider(children: ReactNode) {
  return render(<WidgetCacheProvider>{children}</WidgetCacheProvider>)
}

beforeEach(() => {
  __TESTING__.store.resetAll()
  vi.useRealTimers()
})

afterEach(() => {
  __TESTING__.store.resetAll()
})

describe('useWidgetCache', () => {
  it('fetches on mount and exposes the resolved data', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])

    function Probe() {
      const widget = useWidgetCache<{ id: number }[]>('probe:list', fetcher)
      return (
        <div>
          <span data-testid="status">{widget.status}</span>
          <span data-testid="count">{widget.data?.length ?? -1}</span>
          <button type="button" onClick={widget.refresh}>
            refresh
          </button>
        </div>
      )
    }

    renderWithProvider(<Probe />)

    // Initial render: idle, no fetch yet beyond the synchronous
    // render path; the effect fires and status → loading.
    expect(fetcher).toHaveBeenCalledTimes(1)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'))
    expect(screen.getByTestId('count')).toHaveTextContent('2')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refresh() for one widget does not invalidate other widgets (key isolation)', async () => {
    const aFetcher = vi.fn().mockResolvedValue(['a1'])
    const bFetcher = vi.fn().mockResolvedValue(['b1'])

    function ProbeA() {
      const a = useWidgetCache<string[]>('probe:a', aFetcher)
      return (
        <div>
          <span data-testid="a-status">{a.status}</span>
          <span data-testid="a-data">{a.data?.join(',') ?? ''}</span>
          <button type="button" onClick={a.refresh} data-testid="a-refresh">
            refresh a
          </button>
        </div>
      )
    }
    function ProbeB() {
      const b = useWidgetCache<string[]>('probe:b', bFetcher)
      return (
        <div>
          <span data-testid="b-status">{b.status}</span>
          <span data-testid="b-data">{b.data?.join(',') ?? ''}</span>
        </div>
      )
    }

    renderWithProvider(
      <>
        <ProbeA />
        <ProbeB />
      </>
    )

    await waitFor(() => expect(screen.getByTestId('a-status')).toHaveTextContent('success'))
    await waitFor(() => expect(screen.getByTestId('b-status')).toHaveTextContent('success'))

    expect(aFetcher).toHaveBeenCalledTimes(1)
    expect(bFetcher).toHaveBeenCalledTimes(1)

    await userEvent.setup().click(screen.getByTestId('a-refresh'))

    await waitFor(() => expect(aFetcher).toHaveBeenCalledTimes(2))
    // Key isolation — widget B should NOT have been re-fetched.
    expect(bFetcher).toHaveBeenCalledTimes(1)

    const bEntry = __TESTING__.store.get<string[]>('probe:b')
    expect(bEntry.status).toBe('success')
    expect(bEntry.data).toEqual(['b1'])
  })

  it('surfaces fetcher errors via entry.error and keeps previous data', async () => {
    const successPayload = ['ok']
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(successPayload)
      .mockRejectedValueOnce(new Error('boom'))

    function Probe() {
      const widget = useWidgetCache<string[]>('probe:err', fetcher)
      return (
        <div>
          <span data-testid="status">{widget.status}</span>
          <span data-testid="data">{widget.data?.join(',') ?? ''}</span>
          <span data-testid="error">{widget.error?.message ?? ''}</span>
          <button type="button" onClick={widget.refresh}>
            refresh
          </button>
        </div>
      )
    }

    renderWithProvider(<Probe />)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'))
    expect(screen.getByTestId('data')).toHaveTextContent('ok')

    await userEvent.setup().click(screen.getByRole('button', { name: 'refresh' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
    expect(screen.getByTestId('error')).toHaveTextContent('boom')
    // Previous data must be preserved while erroring.
    expect(screen.getByTestId('data')).toHaveTextContent('ok')
  })

  it('skips the initial fetch when enabled: false', async () => {
    const fetcher = vi.fn().mockResolvedValue(['x'])

    function Probe() {
      const widget = useWidgetCache<string[]>('probe:disabled', fetcher, { enabled: false })
      return (
        <div>
          <span data-testid="status">{widget.status}</span>
          <button type="button" onClick={widget.refresh}>
            refresh
          </button>
        </div>
      )
    }

    renderWithProvider(<Probe />)
    await act(async () => {
      await flushPromises()
    })

    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.getByTestId('status')).toHaveTextContent('idle')

    // A manual refresh should still trigger the fetcher.
    await userEvent.setup().click(screen.getByRole('button', { name: 'refresh' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'))
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('caches by key — multiple components sharing the same widget key share data', async () => {
    const fetcher = vi.fn().mockResolvedValue(['shared'])

    function Probe({ id }: { id: string }) {
      const widget = useWidgetCache<string[]>('probe:shared', fetcher)
      return (
        <div>
          <span data-testid={`status-${id}`}>{widget.status}</span>
          <span data-testid={`data-${id}`}>{widget.data?.join(',') ?? ''}</span>
        </div>
      )
    }

    renderWithProvider(
      <>
        <Probe id="1" />
        <Probe id="2" />
      </>
    )

    await waitFor(() => expect(screen.getByTestId('status-1')).toHaveTextContent('success'))
    await waitFor(() => expect(screen.getByTestId('status-2')).toHaveTextContent('success'))

    expect(screen.getByTestId('data-1')).toHaveTextContent('shared')
    expect(screen.getByTestId('data-2')).toHaveTextContent('shared')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
