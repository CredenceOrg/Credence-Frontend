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

  // ---------------------------------------------------------------------------
  // Refetch on invalidate
  // ---------------------------------------------------------------------------

  it('invalidate_resets_status_to_idle_and_notifies_subscribers', async () => {
    // `invalidate()` evicts the cache entry and notifies subscribers.
    // Mounted components re-render with status → idle. A subsequent call to
    // `refresh()` (or a new mount) will kick off the next fetch.
    const fetcher = vi.fn().mockResolvedValueOnce(['v1']).mockResolvedValueOnce(['v2'])

    function Probe() {
      const widget = useWidgetCache<string[]>('probe:invalidate', fetcher)
      return (
        <div>
          <span data-testid="status">{widget.status}</span>
          <span data-testid="data">{widget.data?.join(',') ?? ''}</span>
          <button type="button" onClick={widget.refresh} data-testid="refresh">
            refresh
          </button>
        </div>
      )
    }

    renderWithProvider(<Probe />)

    // Wait for the initial successful fetch.
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'))
    expect(screen.getByTestId('data')).toHaveTextContent('v1')
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Invalidate the key — this deletes the cache entry and notifies listeners.
    // The component re-renders with status → idle (entry is gone).
    act(() => {
      __TESTING__.store.invalidate('probe:invalidate')
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('idle'))
    // The store entry is gone; previous data is no longer shown.
    expect(__TESTING__.store.get('probe:invalidate').status).toBe('idle')

    // Now call refresh() — this is the explicit "refetch after invalidation" path.
    act(() => {
      screen.getByTestId('refresh').click()
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'))
    expect(screen.getByTestId('data')).toHaveTextContent('v2')
    // The fetcher was called a second time for the manual refetch.
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('invalidate_does_not_affect_other_keys', async () => {
    // `invalidate('a')` must leave widget 'b' completely untouched.
    const aFetcher = vi.fn().mockResolvedValue(['a'])
    const bFetcher = vi.fn().mockResolvedValue(['b'])

    function ProbeA() {
      const widget = useWidgetCache<string[]>('probe:inv-a', aFetcher)
      return <span data-testid="a-status">{widget.status}</span>
    }
    function ProbeB() {
      const widget = useWidgetCache<string[]>('probe:inv-b', bFetcher)
      return <span data-testid="b-status">{widget.status}</span>
    }

    renderWithProvider(
      <>
        <ProbeA />
        <ProbeB />
      </>
    )

    await waitFor(() => expect(screen.getByTestId('a-status')).toHaveTextContent('success'))
    await waitFor(() => expect(screen.getByTestId('b-status')).toHaveTextContent('success'))

    // Invalidate only widget A — widget B must be completely unaffected.
    act(() => {
      __TESTING__.store.invalidate('probe:inv-a')
    })

    await waitFor(() => expect(screen.getByTestId('a-status')).toHaveTextContent('idle'))

    // Widget B was never invalidated: its fetcher should still have been called
    // exactly once and its data must still be present.
    expect(bFetcher).toHaveBeenCalledTimes(1)
    const bEntry = __TESTING__.store.get<string[]>('probe:inv-b')
    expect(bEntry.status).toBe('success')
    expect(bEntry.data).toEqual(['b'])
  })

  it('status_transitions_idle_loading_success_on_refresh_after_invalidation', async () => {
    // Full observable state machine: success → idle (via invalidate) →
    // loading → success (via explicit refresh).
    let resolveSecond!: (value: string[]) => void
    const secondFetch = new Promise<string[]>((res) => {
      resolveSecond = res
    })

    const fetcher = vi.fn().mockResolvedValueOnce(['first']).mockReturnValueOnce(secondFetch)

    const capturedStatuses: string[] = []

    function Probe() {
      const widget = useWidgetCache<string[]>('probe:states', fetcher)
      capturedStatuses.push(widget.status)
      return (
        <div>
          <span data-testid="status">{widget.status}</span>
          <button type="button" onClick={widget.refresh} data-testid="refresh">
            refresh
          </button>
        </div>
      )
    }

    renderWithProvider(<Probe />)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'))

    // Invalidate → component sees idle.
    act(() => {
      __TESTING__.store.invalidate('probe:states')
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('idle'))

    // Explicit refresh → loading.
    act(() => {
      screen.getByTestId('refresh').click()
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('loading'))

    // Resolve the second fetch → success.
    act(() => {
      resolveSecond(['second'])
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'))

    // The recorded sequence must include all four states in order.
    expect(capturedStatuses).toContain('idle')
    expect(capturedStatuses).toContain('loading')
    expect(capturedStatuses.at(-1)).toBe('success')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  // ---------------------------------------------------------------------------
  // Dedupe concurrent requests
  // ---------------------------------------------------------------------------

  it('dedupe_concurrent_mounts_with_same_key_issues_only_one_fetch', async () => {
    // Three components mount simultaneously with the same widget key.
    // Only one fetch must be issued regardless of how many subscribers call
    // fetchIfIdle in their useEffect.
    const fetcher = vi.fn().mockResolvedValue(['deduped'])

    function Probe({ id }: { id: string }) {
      const widget = useWidgetCache<string[]>('probe:dedupe', fetcher)
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
        <Probe id="3" />
      </>
    )

    await waitFor(() => expect(screen.getByTestId('status-1')).toHaveTextContent('success'))
    await waitFor(() => expect(screen.getByTestId('status-2')).toHaveTextContent('success'))
    await waitFor(() => expect(screen.getByTestId('status-3')).toHaveTextContent('success'))

    // All three components must show the same data.
    expect(screen.getByTestId('data-1')).toHaveTextContent('deduped')
    expect(screen.getByTestId('data-2')).toHaveTextContent('deduped')
    expect(screen.getByTestId('data-3')).toHaveTextContent('deduped')

    // Critical: only a single network call despite three simultaneous subscribers.
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('fetchIfIdle_does_not_start_a_new_fetch_while_one_is_already_in_flight', async () => {
    let resolveFirst!: (value: string[]) => void
    const firstFetch = new Promise<string[]>((res) => {
      resolveFirst = res
    })
    const fetcher = vi.fn().mockReturnValueOnce(firstFetch)

    // Manually start one fetch to move the key out of idle.
    act(() => {
      __TESTING__.store.fetchIfIdle('store:dedupe', fetcher)
    })

    // The status is now 'loading' — calling fetchIfIdle again must be a no-op.
    act(() => {
      __TESTING__.store.fetchIfIdle('store:dedupe', fetcher)
      __TESTING__.store.fetchIfIdle('store:dedupe', fetcher)
    })

    expect(fetcher).toHaveBeenCalledTimes(1)

    // Clean up: resolve the in-flight fetch.
    act(() => {
      resolveFirst(['done'])
    })

    await act(async () => {
      await flushPromises()
    })

    expect(__TESTING__.store.get('store:dedupe').status).toBe('success')
    // Still exactly one call.
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refresh_supersedes_in_flight_fetch_and_only_last_result_is_applied', async () => {
    // Two rapid refresh() calls: the first is in-flight when the second
    // arrives. The store aborts the first via AbortController so only the
    // second result lands in the cache.
    let resolveFirst!: (value: string[]) => void
    let resolveSecond!: (value: string[]) => void
    const firstFetch = new Promise<string[]>((res) => {
      resolveFirst = res
    })
    const secondFetch = new Promise<string[]>((res) => {
      resolveSecond = res
    })

    const fetcher = vi.fn().mockReturnValueOnce(firstFetch).mockReturnValueOnce(secondFetch)

    function Probe() {
      const widget = useWidgetCache<string[]>('probe:supersede', fetcher)
      return (
        <div>
          <span data-testid="status">{widget.status}</span>
          <span data-testid="data">{widget.data?.join(',') ?? ''}</span>
          <button type="button" onClick={widget.refresh} data-testid="refresh">
            refresh
          </button>
        </div>
      )
    }

    renderWithProvider(<Probe />)

    // Wait for the initial idle → loading state triggered by fetchIfIdle.
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('loading'))

    // Trigger a second refresh while the first is still pending.
    act(() => {
      screen.getByTestId('refresh').click()
    })

    // Resolve the SECOND fetch first (latest-call-wins semantics).
    act(() => {
      resolveSecond(['second'])
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'))
    expect(screen.getByTestId('data')).toHaveTextContent('second')

    // Now resolve the (already-aborted) first fetch — it must be ignored.
    act(() => {
      resolveFirst(['first'])
    })

    await act(async () => {
      await flushPromises()
    })

    // Data must remain from the second (winning) fetch.
    expect(screen.getByTestId('data')).toHaveTextContent('second')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('multiple_subscribers_all_update_when_a_shared_key_is_refreshed', async () => {
    // All components subscribed to the same key must receive the updated data
    // when one of them (or an external caller) triggers a refresh.
    const fetcher = vi.fn().mockResolvedValueOnce(['original']).mockResolvedValueOnce(['refreshed'])

    function Probe({ id, showRefresh = false }: { id: string; showRefresh?: boolean }) {
      const widget = useWidgetCache<string[]>('probe:multi-refresh', fetcher)
      return (
        <div>
          <span data-testid={`data-${id}`}>{widget.data?.join(',') ?? ''}</span>
          {showRefresh && (
            <button type="button" onClick={widget.refresh} data-testid="refresh">
              refresh
            </button>
          )}
        </div>
      )
    }

    renderWithProvider(
      <>
        <Probe id="a" showRefresh />
        <Probe id="b" />
      </>
    )

    await waitFor(() => expect(screen.getByTestId('data-a')).toHaveTextContent('original'))
    expect(screen.getByTestId('data-b')).toHaveTextContent('original')
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Trigger a refresh from subscriber A.
    act(() => {
      screen.getByTestId('refresh').click()
    })

    // Both subscribers must receive the updated data from the single shared fetch.
    await waitFor(() => expect(screen.getByTestId('data-a')).toHaveTextContent('refreshed'))
    expect(screen.getByTestId('data-b')).toHaveTextContent('refreshed')
    // Only one new fetch despite two mounted subscribers.
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  // ---------------------------------------------------------------------------
  // PII scrubbing before storage
  // ---------------------------------------------------------------------------

  it('scrubs_pii_from_fetcher_data_before_it_reaches_the_cache', async () => {
    // This is the negative case that motivated the fix: before scrubbing was
    // wired into `setEntry`, the raw fetcher payload — including PII —
    // landed in the shared cache verbatim and was readable by any widget
    // subscribed to this key.
    const fetcher = vi.fn().mockResolvedValue({
      id: 1,
      trustScore: 92,
      owner: { fullName: 'Dana Lee', email: 'dana@example.com' },
    })

    function Probe() {
      const widget = useWidgetCache<{
        id: number
        trustScore: number
        owner: { fullName: string; email: string }
      }>('probe:pii', fetcher)
      return (
        <div>
          <span data-testid="status">{widget.status}</span>
          <span data-testid="email">{widget.data?.owner.email ?? ''}</span>
          <span data-testid="score">{widget.data?.trustScore ?? ''}</span>
        </div>
      )
    }

    renderWithProvider(<Probe />)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'))

    // PII is redacted...
    expect(screen.getByTestId('email')).toHaveTextContent('[REDACTED]')
    // ...but non-PII data is preserved.
    expect(screen.getByTestId('score')).toHaveTextContent('92')

    const entry = __TESTING__.store.get<{ owner: { fullName: string; email: string } }>('probe:pii')
    expect(entry.data?.owner.email).toBe('[REDACTED]')
    expect(entry.data?.owner.fullName).toBe('[REDACTED]')
  })

  it('surfaces_a_typed_error_and_keeps_previous_data_when_a_payload_cannot_be_scrubbed', async () => {
    // Explicit failure mode: a circular payload can't be safely deep-cloned
    // and scrubbed, so the store must reject it via `entry.error` (typed
    // `PIIScrubError`) rather than caching it raw or crashing the render.
    const circular: Record<string, unknown> = { id: 1 }
    circular.self = circular

    const fetcher = vi.fn().mockResolvedValueOnce(['ok']).mockResolvedValueOnce(circular)

    function Probe() {
      const widget = useWidgetCache<unknown>('probe:pii-error', fetcher)
      return (
        <div>
          <span data-testid="status">{widget.status}</span>
          <span data-testid="error">{widget.error?.name ?? ''}</span>
          <button type="button" onClick={widget.refresh}>
            refresh
          </button>
        </div>
      )
    }

    renderWithProvider(<Probe />)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'))

    await userEvent.setup().click(screen.getByRole('button', { name: 'refresh' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
    expect(screen.getByTestId('error')).toHaveTextContent('PIIScrubError')

    // Previous (already-scrubbed) data is preserved, not overwritten with
    // the raw, un-scrubbable payload.
    const entry = __TESTING__.store.get('probe:pii-error')
    expect(entry.data).toEqual(['ok'])
  })
})
