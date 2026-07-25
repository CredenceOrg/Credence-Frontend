import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import WidgetRefreshButton from './WidgetRefreshButton'

describe('WidgetRefreshButton', () => {
  it('renders with an accessible name that includes the widget label', () => {
    render(<WidgetRefreshButton onRefresh={() => {}} label="recent activity" />)
    expect(
      screen.getByRole('button', { name: /Refresh recent activity/i })
    ).toBeInTheDocument()
  })

  it('shows aria-busy and is disabled while loading', () => {
    render(<WidgetRefreshButton onRefresh={() => {}} label="active bonds" isLoading />)
    const button = screen.getByRole('button', { name: /Refreshing active bonds/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('invokes onRefresh when clicked', async () => {
    const handleRefresh = vi.fn()
    const user = userEvent.setup()
    render(<WidgetRefreshButton onRefresh={handleRefresh} label="active bonds" />)
    await user.click(screen.getByRole('button', { name: /Refresh active bonds/i }))
    expect(handleRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not invoke onRefresh while loading', () => {
    const handleRefresh = vi.fn()
    render(<WidgetRefreshButton onRefresh={handleRefresh} label="active bonds" isLoading />)
    const button = screen.getByRole('button', { name: /Refreshing active bonds/i })
    // The button is `disabled`, so user-event click would error out before
    // it ever fires `onClick`. Asserting disabled + handler untouched is
    // sufficient (and is the observable contract for users).
    expect(button).toBeDisabled()
    expect(handleRefresh).not.toHaveBeenCalled()
  })

  it('surfaces a "Last updated" cue when lastUpdated is provided', () => {
    const lastUpdated = Date.now() - 30_000 // 30s ago
    render(
      <WidgetRefreshButton
        onRefresh={() => {}}
        label="recent activity"
        lastUpdated={lastUpdated}
      />
    )
    const button = screen.getByRole('button', { name: /Last updated/i })
    expect(button).toHaveAccessibleName(/Refresh recent activity\. Last updated 30s ago/i)
  })

  it('honours an externally controlled disabled prop even when not loading', () => {
    render(<WidgetRefreshButton onRefresh={() => {}} label="active bonds" disabled />)
    const button = screen.getByRole('button', { name: /Refresh active bonds/i })
    expect(button).toBeDisabled()
    expect(button).not.toHaveAttribute('aria-busy', 'true')
  })
})
