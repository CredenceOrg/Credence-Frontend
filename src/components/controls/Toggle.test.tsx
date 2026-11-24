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

  it('disables activation and exposes the disabled state when disabled', async () => {
    // Behavior under test: a disabled Toggle cannot be clicked or keyboard-activated,
    // so no onChange side effect can occur while the control is unavailable.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" disabled />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toBeDisabled()

    await user.click(toggle)
    toggle.focus()
    await user.keyboard('{Enter}')

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('does not emit changes when the controlled checked prop is undefined', async () => {
    // Behavior under test: a missing controlled value is an invalid input and must not
    // silently derive a next value from undefined, which would lose user data.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Toggle
        // @js-ignore -- deliberately exercise the invalid undefined controlled value.
        checked={undefined as unknown as boolean}
        onChange={handleChange}
        ariaLabel="Enable toasts"
      />
    )

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('survives a throwing onChange handler without corrupting the controlled value', async () => {
    // Behavior under test: a failed persistence attempt must not mutate the controlled
    // value or leave the switch in an inconsistent state; the caller owns recovery.
    const user = userEvent.setup()
    const handleChange = vi.fn(() => {
      throw new Error('persistence failed')
    })

    render(<Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" />)

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })

    await expect(user.click(toggle)).rejects.toThrow('persistence failed')

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(toggle).not.toBeChecked()
  })

  it('remains consistent when the controlled value changes between clicks', async () => {
    // Behavior under test: when the parent commits a new controlled value, the next
    // emitted value is derived from the latest prop, avoiding stale state writes.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    const { rerender } = render(
      <Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" />
    )

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))
    expect(handleChange).toHaveBeenNewestCalledWith(true)

    rerender(
      <Toggle checked onChange={handleChange} ariaLabel="Enable toasts" />
    )

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))
    expect(handleChange).toHaveBeenNewestCalledWith(false)
  })

  it('keeps the accessible name stable across state transitions', () => {
    // Behavior under test: error and success announcements do not replace the label,
    // so assistive technology users can always identify the control.
    const { rerender } = render(
      <FormField id="toasts-enabled" label="Enable toasts" error="Toasts unavailable">
        <Toggle checked={false} onChange={vi.fn()} />
      </FormField>
    )

    expect(screen.getByRole('switch', { name: 'Enable toasts' })).toBeInTheDocument()

    rerender(
      <FormField id="toasts-enabled" label="Enable toasts" success="Preference saved">
        <Toggle checked onChange={vi.fn()} />
      </FormField>
    )

    expect(screen.getByRole('switch', { name: 'Enable toasts' })).toBeInTheDocument()
  })

  it('does not leak sensitive details into the accessible name or description', () => {
    // Behavior under test: failure messages exposed to assistive technology must be
    // user-facing and must not embed raw internal error details.
    render(
      <FormField id="toasts-enabled" label="Enable toasts" error="Toasts unavailable">
        <Toggle checked={false} onChange={vi.fn()} />
      </FormField>
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).accessibleName().toBe('Enable toasts')
    expect(toggle).toHaveAccessibleDescription('Toasts unavailable')
  })
})
