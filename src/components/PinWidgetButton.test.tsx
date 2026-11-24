import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PinWidgetButton } from './PinWidgetButton'

describe('PinWidgetButton', () => {
  const defaultProps = {
    slug: 'test-widget',
    widgetTitle: 'Test widget',
    isPinned: false,
    onToggle: vi.fn(),
  }

  it('renders a button', () => {
    render(<PinWidgetButton {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('includes the widget title in its accessible name when not pinned', () => {
    render(<PinWidgetButton {...defaultProps} isPinned={false} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Pin Test widget')
  })

  it('includes the widget title in its accessible name when pinned', () => {
    render(<PinWidgetButton {...defaultProps} isPinned={true} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Unpin Test widget')
  })

  it('sets aria-pressed to false when not pinned', () => {
    render(<PinWidgetButton {...defaultProps} isPinned={false} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('sets aria-pressed to true when pinned', () => {
    render(<PinWidgetButton {...defaultProps} isPinned={true} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onToggle with the slug on click', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<PinWidgetButton {...defaultProps} onToggle={onToggle} />)
    await user.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledWith('test-widget')
  })
})
