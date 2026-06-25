import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FormField } from '../forms/FormField'
import Toggle from './Toggle'

describe('Toggle', () => {
  it('reflects the checked state from checked=true', () => {
    // Behavior under test: checked Settings booleans render as an active switch.
    render(<Toggle checked onChange={vi.fn()} ariaLabel="Enable toasts" />)

    expect(screen.getByRole('switch', { name: 'Enable toasts' })).toBeChecked()
  })

  it('reflects the unchecked state from checked=false', () => {
    // Behavior under test: unchecked Settings booleans render as an inactive switch.
    render(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Enable toasts" />)

    expect(screen.getByRole('switch', { name: 'Enable toasts' })).not.toBeChecked()
  })

  it('calls onChange with the negated value when clicked', async () => {
    // Behavior under test: toggling emits the next boolean value for persistence.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" />)

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('applies ariaLabel as the accessible name', () => {
    // Behavior under test: standalone Toggles expose the provided accessible name.
    render(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Auto dismiss" />)

    expect(screen.getByRole('switch', { name: 'Auto dismiss' })).toBeInTheDocument()
  })

  it('toggles with keyboard activation', async () => {
    // Behavior under test: keyboard users can activate the switch through native button behavior.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Toggle checked onChange={handleChange} ariaLabel="Enable toasts" />)

    screen.getByRole('switch', { name: 'Enable toasts' }).focus()
    await user.keyboard('{Enter}')

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(false)
  })

  it('emits the same negated value for rapid clicks until checked prop changes', async () => {
    // Behavior under test: the controlled component derives next value from the current prop.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" />)

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    await user.click(toggle)
    await user.click(toggle)

    expect(handleChange).toHaveBeenCalledTimes(2)
    expect(handleChange).toHaveBeenNthCalledWith(1, true)
    expect(handleChange).toHaveBeenNthCalledWith(2, true)
  })

  it('composes with FormField label and id wiring without ariaLabel', () => {
    // Behavior under test: FormField labels provide the accessible name through the cloned id.
    render(
      <FormField id="toasts-enabled" label="Enable toasts">
        <Toggle checked={false} onChange={vi.fn()} />
      </FormField>
    )

    expect(screen.getByRole('switch', { name: 'Enable toasts' })).toHaveAttribute('id', 'toasts-enabled')
  })
})
