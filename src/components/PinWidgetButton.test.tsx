import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PinWidgetButton } from './PinWidgetButton'

describe('PinWidgetButton', () => {
  const defaultProps = { slug: 'test-widget', isPinned: false, onToggle: vi.fn() }

  it('renders a button', () => {
    render(<PinWidgetButton {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('has accessible name "Pin widget" when not pinned', () => {
    render(<PinWidgetButton {...defaultProps} isPinned={false} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Pin widget')
  })

  it('has accessible name "Unpin widget" when pinned', () => {
    render(<PinWidgetButton {...defaultProps} isPinned={true} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Unpin widget')
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
