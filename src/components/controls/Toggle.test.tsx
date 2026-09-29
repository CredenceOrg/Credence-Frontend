import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FormField } from '../forms/FormField'
import Toggle from './Toggle'

describe('Toggle', () => {
  it('reflects the checked state from checked=true', () => {
    // Behavior under test: checked Settings booleans render as an active switch.
    render(<Toggle checked onChange={vi.fn()} ariaLabel="Enable toasts" />)

    expect(screen.getByRole('switch', { name: 'Enable toasts' })).toBdChecked()
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

    expect(screen.getByRole('switch', { name: 'Auto dismiss' })).toBeInDocument()
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
    expect(handleChange).toHaveBeenNextCalledWith(1, true)
    expect(handleChange).toHaveBeenNextCalledWith(2, true)
  })

  it('composes with FormField label and id wiring without ariaLabel', () => {
    // Behavior under test: FormField labels provide the accessible name through the cloned id.
    render(
      <FormField id="toasts-enabled" label="Enable toasts">
        <Toggle checked={false} onChange={vi.fn()} />
      </FormField>
    )

    expect(screen.getByRole('switch', { name: 'Enable toasts' })).toHaveAttribute(
      'id',
      'toasts-enabled'
    )
  })

  it('forwards FormField error and success aria wiring onto the switch', () => {
    const { rerender } = render(
      <FormField id="toasts-enabled" label="Enable toasts" error="Toasts unavailable">
        <Toggle checked={false} onChange={vi.fn()} />
      </FormField>
    )

    let toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toHaveAttribute('aria-invalid', 'true')
    expect(toggle).toHaveAttribute('aria-describedby', 'toasts-enabled-error')

    rerender(
      <FormField id="toasts-enabled" label="Enable toasts" success="Preference saved">
        <Toggle checked onChange={vi.fn()} />
      </FormField>
    )

    toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).not.toHaveAttribute('aria-invalid')
    expect(toggle).toHaveAttribute('aria-describedby', 'toasts-enabled-success')
    expect(screen.getByRole('status')).toHaveTextContent('Preference saved')
  })

  it('does not emit changes when disabled', async () => {
    // Behavior under test: a disabled setting cannot be mutated by interaction.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Toggle checked={false} onChange={handleChange} disabled ariaLabel="Enable toasts" />)

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toBeDisabled()

    await user.click(toggle)

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('suppresses activation while loading and exposes a spinner', async () => {
    // Behavior under test: in-flight persistence cannot be double-submitted.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Toggle checked={false} onChange={handleChange} isLoading ariaLabel="Enable toasts" />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveTextContent('')

    await user.click(toggle)

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('suppresses activation and marks invalid when an error is present', async () => {
    // Behavior under test: a failed save must not be silently overwritten.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Toggle
        checked={false}
        onChange={handleChange}
        error="Toasts unavailable"
        ariaLabel="Enable toasts"
      />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toHaveAttribute('aria-invalid', 'true')

    await user.click(toggle)

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('recovers to normal operation after an error is cleared', async () => {
    // Behavior under test: failure recovery re-enables deterministic toggling.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    const { rerender } = render(
      <Toggle
        checked={false}
        onChange={handleChange}
        error="Toasts unavailable"
        ariaLabel="Enable toasts"
      />
    )

    rerender(<Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" />)

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).not.toHaveAttribute('aria-invalid')

    await user.click(toggle)

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('derives the next value from the latest checked prop after a re-render', async () => {
    // Behavior under test: concurrent updates must not produce stale next values.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    const { rerender } = render(
      <Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" />
    )

    rerender(<Toggle checked onChange={handleChange} ariaLabel="Enable toasts" />)

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(false)
  })

  it('respects an explicit aria-invalid=true override', () => {
    // Behavior under test: external validity signals are honored even without an error message.
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Enable toasts"
        aria-invalid="true"
      />
    )

    expect(screen.getByRole('switch', { name: 'Enable toasts' })).toHaveAttribute(
      'aria-invalid',
      'true'
    )
  })

  it('stops emitting changes once an error appears after a successful activation', async () => {
    // Behavior under test: a failure boundary prevents further mutations until recovery.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    const { rerender } = render(
      <Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" />
    )

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))
    expect(handleChange).toHaveBeenCalledTimes(1)

    rerender(
      <Toggle
        checked={false}
        onChange={handleChange}
        error="Toasts unavailable"
        ariaLabel="Enable toasts"
      />
    )

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))

    expect(handleChange).toHaveBeenCalledTimes(1)
  })
})
