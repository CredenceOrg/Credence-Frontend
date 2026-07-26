import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSession } from './useSession'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Flush the microtask queue so async void callbacks resolve. */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
  })
}

/** Dispatch a genuine window `focus` event (same path as a real alt-tab). */
function dispatchWindowFocus() {
  window.dispatchEvent(new FocusEvent('focus'))
}

/**
 * Simulate the browser switching the active tab to *this* tab.
 * This fires `visibilitychange` (document.visibilityState → 'visible') but
 * does NOT fire a window `focus` event.
 */
function dispatchTabVisible() {
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/**
 * Simulate the browser switching the active tab *away* from this tab.
 * Fires `visibilitychange` (document.visibilityState → 'hidden').
 */
function dispatchTabHidden() {
  Object.defineProperty(document, 'visibilityState', {
    value: 'hidden',
    configurable: true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('useSession', () => {
  afterEach(() => {
    vi.clearAllMocks()
    // Restore visibility state to default after every test
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
  })

  // ── initial fetch ──────────────────────────────────────────────────────────

  it('calls onRefetch once on mount when enabled', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useSession({ onRefetch }))

    await flushMicrotasks()

    expect(onRefetch).toHaveBeenCalledTimes(1)
  })

  it('does_not_call_onRefetch_on_mount_when_disabled', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useSession({ onRefetch, enabled: false }))

    await flushMicrotasks()

    expect(onRefetch).not.toHaveBeenCalled()
  })

  // ── window focus (happy path) ──────────────────────────────────────────────

  it('calls_onRefetch_when_window_receives_focus_event', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    onRefetch.mockClear()

    dispatchWindowFocus()
    await flushMicrotasks()

    expect(onRefetch).toHaveBeenCalledTimes(1)
  })

  it('calls_onRefetch_on_every_subsequent_window_focus_event', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    onRefetch.mockClear()

    dispatchWindowFocus()
    dispatchWindowFocus()
    dispatchWindowFocus()
    await flushMicrotasks()

    expect(onRefetch).toHaveBeenCalledTimes(3)
  })

  // ── tab switch (sad path / boundary) ──────────────────────────────────────

  it('does_not_call_onRefetch_when_tab_becomes_visible_via_visibilitychange', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    onRefetch.mockClear()

    // Tab-switch to visible — must NOT trigger a refetch
    dispatchTabVisible()
    await flushMicrotasks()

    expect(onRefetch).not.toHaveBeenCalled()
  })

  it('does_not_call_onRefetch_when_tab_becomes_hidden_via_visibilitychange', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    onRefetch.mockClear()

    dispatchTabHidden()
    await flushMicrotasks()

    expect(onRefetch).not.toHaveBeenCalled()
  })

  it('does_not_call_onRefetch_for_repeated_tab_switches_without_window_focus', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    onRefetch.mockClear()

    // Multiple tab switch cycles — none should trigger a refetch
    dispatchTabHidden()
    dispatchTabVisible()
    dispatchTabHidden()
    dispatchTabVisible()
    await flushMicrotasks()

    expect(onRefetch).not.toHaveBeenCalled()
  })

  // ── enabled flag ──────────────────────────────────────────────────────────

  it('does_not_respond_to_window_focus_when_disabled', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useSession({ onRefetch, enabled: false }))
    await flushMicrotasks()

    dispatchWindowFocus()
    await flushMicrotasks()

    expect(onRefetch).not.toHaveBeenCalled()
  })

  it('begins_refetching_when_enabled_transitions_from_false_to_true', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSession({ onRefetch, enabled }),
      { initialProps: { enabled: false } },
    )
    await flushMicrotasks()

    expect(onRefetch).not.toHaveBeenCalled()

    rerender({ enabled: true })
    await flushMicrotasks()

    // Should fire the initial fetch now that it is enabled
    expect(onRefetch).toHaveBeenCalledTimes(1)

    onRefetch.mockClear()

    // And should also respond to focus events from now on
    dispatchWindowFocus()
    await flushMicrotasks()

    expect(onRefetch).toHaveBeenCalledTimes(1)
  })

  it('stops_refetching_when_enabled_transitions_from_true_to_false', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSession({ onRefetch, enabled }),
      { initialProps: { enabled: true } },
    )
    await flushMicrotasks()

    onRefetch.mockClear()

    // Disable — listener should be removed
    rerender({ enabled: false })
    await flushMicrotasks()

    dispatchWindowFocus()
    await flushMicrotasks()

    expect(onRefetch).not.toHaveBeenCalled()
  })

  // ── cleanup / unmount ──────────────────────────────────────────────────────

  it('does_not_call_onRefetch_after_unmount', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    const { unmount } = renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    onRefetch.mockClear()

    unmount()

    dispatchWindowFocus()
    await flushMicrotasks()

    expect(onRefetch).not.toHaveBeenCalled()
  })

  it('removes_focus_listener_on_unmount_so_it_does_not_accumulate_across_remounts', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)

    const { unmount: unmount1 } = renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()
    unmount1()

    const { unmount: unmount2 } = renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    onRefetch.mockClear()

    dispatchWindowFocus()
    await flushMicrotasks()

    // Only the second mounted instance should respond — exactly once
    expect(onRefetch).toHaveBeenCalledTimes(1)

    unmount2()
  })

  // ── callback stability ─────────────────────────────────────────────────────

  it('uses_the_latest_onRefetch_without_reregistering_the_listener', async () => {
    const onRefetch1 = vi.fn().mockResolvedValue(undefined)
    const onRefetch2 = vi.fn().mockResolvedValue(undefined)

    const { rerender } = renderHook(
      ({ onRefetch }: { onRefetch: () => Promise<void> }) => useSession({ onRefetch }),
      { initialProps: { onRefetch: onRefetch1 } },
    )
    await flushMicrotasks()
    onRefetch1.mockClear()

    // Update to a new callback identity
    rerender({ onRefetch: onRefetch2 })
    await flushMicrotasks()

    // The re-render itself must not trigger an extra refetch
    expect(onRefetch2).not.toHaveBeenCalled()

    dispatchWindowFocus()
    await flushMicrotasks()

    expect(onRefetch1).not.toHaveBeenCalled()
    expect(onRefetch2).toHaveBeenCalledTimes(1)
  })

  // ── synchronous onRefetch ──────────────────────────────────────────────────

  it('works_correctly_when_onRefetch_is_synchronous', async () => {
    const onRefetch = vi.fn().mockReturnValue(undefined) // sync, no promise
    renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    expect(onRefetch).toHaveBeenCalledTimes(1)

    onRefetch.mockClear()
    dispatchWindowFocus()
    await flushMicrotasks()

    expect(onRefetch).toHaveBeenCalledTimes(1)
  })

  // ── interaction: window focus + tab switch in the same session ─────────────

  it('refetches_on_window_focus_but_not_when_tab_switches_are_interspersed', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    onRefetch.mockClear()

    // A typical "tab away, come back" cycle — tab switch only
    dispatchTabHidden()
    dispatchTabVisible()
    await flushMicrotasks()

    expect(onRefetch).not.toHaveBeenCalled()

    // Now the user truly alt-tabs back to the browser window
    dispatchWindowFocus()
    await flushMicrotasks()

    expect(onRefetch).toHaveBeenCalledTimes(1)
  })

  // ── SSR guard ─────────────────────────────────────────────────────────────

  it('does_not_throw_when_window_is_undefined_ssr_guard', async () => {
    // jsdom always has window, but we verify the hook mounts and unmounts
    // cleanly — if the SSR guard (`typeof window === 'undefined'`) were missing,
    // addEventListener calls during SSR would throw ReferenceErrors.
    const onRefetch = vi.fn().mockResolvedValue(undefined)

    expect(() => {
      renderHook(() => useSession({ onRefetch, enabled: true }))
    }).not.toThrow()

    // Ensure the hook can be rendered and cleaned up without error
    const { unmount } = renderHook(() => useSession({ onRefetch, enabled: true }))
    expect(() => unmount()).not.toThrow()
  })

  // ── enabled defaults to true ───────────────────────────────────────────────

  it('enabled_defaults_to_true_and_fetches_on_mount', async () => {
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    // No `enabled` prop passed — should default to true
    renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    expect(onRefetch).toHaveBeenCalledTimes(1)
  })

  // ── onRefetch rejection is handled gracefully ──────────────────────────────

  it('does_not_throw_when_onRefetch_rejects', async () => {
    const onRefetch = vi.fn().mockRejectedValue(new Error('network error'))

    // The hook should mount without throwing even though onRefetch rejects
    renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    // Should have been called once on mount (the rejection is swallowed by `void`)
    expect(onRefetch).toHaveBeenCalledTimes(1)

    // Focus events on a rejecting fetcher should also not crash
    dispatchWindowFocus()
    await flushMicrotasks()

    expect(onRefetch).toHaveBeenCalledTimes(2)
  })

  // ── async onRefetch: focus while a previous fetch is in flight ────────────

  it('calls_onRefetch_again_on_focus_even_if_previous_call_is_still_in_flight', async () => {
    // Arrange: first call resolves immediately, second is delayed
    const onRefetch = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useSession({ onRefetch }))
    await flushMicrotasks()

    // onRefetch was called once on mount
    expect(onRefetch).toHaveBeenCalledTimes(1)

    // Two rapid focus events — the hook does not gate on the previous promise
    dispatchWindowFocus()
    dispatchWindowFocus()
    await flushMicrotasks()

    expect(onRefetch).toHaveBeenCalledTimes(3) // 1 mount + 2 focus
  })
})
