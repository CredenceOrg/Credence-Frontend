import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AutoSaveIndicator, { type AutoSaveIndicatorLabels } from './AutoSaveIndicator'

const labels: AutoSaveIndicatorLabels = {
  saving: 'Saving…',
  saved: 'Saved',
  savedRelative: (relative) => `Saved ${relative}`,
  error: "Couldn't save. Try again.",
  retry: 'Retry',
}

describe('AutoSaveIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when status is idle or before any save', () => {
    const { container } = render(
      <AutoSaveIndicator status="idle" lastSavedAt={null} labels={labels} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the spinner + saving label when status is saving or pending', () => {
    const { rerender } = render(
      <AutoSaveIndicator status="saving" lastSavedAt={null} labels={labels} />
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Saving/i)
    rerender(<AutoSaveIndicator status="pending" lastSavedAt={null} labels={labels} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Saving/i)
  })

  it('renders the relative time string when status is saved within the TTL', () => {
    // 1s ago is well inside the default ttlMs=6000 window,
    // and below the 5s "just now" → "Ns ago" boundary.
    render(<AutoSaveIndicator status="saved" lastSavedAt={Date.now() - 1_000} labels={labels} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Saved just now/i)
  })

  it('renders seconds-ago variant once the relative time crosses the 5s boundary', () => {
    // 5.5s ago is past the "just now" boundary AND inside the default ttlMs=6000
    // window, so the formatted "Saved 5s ago" is observable without a per-call-site
    // explicit ttlMs override.
    render(<AutoSaveIndicator status="saved" lastSavedAt={Date.now() - 5_500} labels={labels} />)
    // 5s ago → "5s ago" via the helper. Labels pipe through: "Saved 5s ago".
    expect(screen.getByRole('status')).toHaveTextContent(/Saved 5s ago/i)
  })

  it('renders error + retry button when status is error and onRetry is supplied', () => {
    const onRetry = vi.fn()
    render(
      <AutoSaveIndicator status="error" lastSavedAt={null} labels={labels} onRetry={onRetry} />
    )
    const retry = screen.getByRole('button', { name: /Retry/i })
    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent(/Couldn't save/i)
  })

  it('does NOT render retry when onRetry is omitted even in error state', () => {
    render(<AutoSaveIndicator status="error" lastSavedAt={null} labels={labels} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('auto-hides after the configured ttlMs once status returns to saved', () => {
    // lastSavedAt far enough in the past that ttlMs (default 6000) has elapsed.
    render(<AutoSaveIndicator status="saved" lastSavedAt={Date.now() - 7_000} labels={labels} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('keeps showing the pill when ttlMs is larger than elapsed since lastSavedAt', () => {
    render(
      <AutoSaveIndicator
        status="saved"
        lastSavedAt={Date.now() - 2000}
        labels={labels}
        ttlMs={10_000}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Saved/)
  })

  it('uses the supplied className on the root element', () => {
    render(
      <AutoSaveIndicator status="saving" lastSavedAt={null} labels={labels} className="my-pill" />
    )
    expect(screen.getByRole('status').className).toMatch(/my-pill/)
    expect(screen.getByRole('status').className).toMatch(/auto-save-indicator--saving/)
  })
})
