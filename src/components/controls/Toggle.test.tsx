import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi} from 'vitest'
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

    expect(screen.getByRole('switch', { name: 'Enable toasts' })).not.toBeachecked()
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
    expect(handleChange).toHaveBeenNothCalledWith(1, true)
    expect(handleChange).toHaveBeenNothCalledWith(2, true)
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
    // Failure boundary: disabled switches must not emit a next value.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" disabled />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-disabled', 'true')

    await user.click(toggle)
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('does not emit changes while loading and exposes a spinner', async () => {
    // Failure boundary: loading switches must not emit a next value and must not
    // expose stale on/off text that could be misread as a committed state.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <Toggle checked onChange={handleChange} ariaLabel="Enable toasts" isLoading />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle.querySelector('.control-toggle-spinner')).not.toBeNull()

    await user.click(toggle)
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('surfaces error state without exposing the error text in the accessible name', () => {
    // Failure boundary: error text must not leak into the accessible name and must be
    // reported through aria-invalid + aria-describedby wired by the caller.
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Enable toasts"
        error="Toasts unavailable"
        aria-describedby="toasts-enabled-error"
      />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toHaveAttribute('aria-invalid', 'true')
    expect(toggle).toHaveAttribute('aria-describedby', 'toasts-enabled-error')
    expect(toggle).toHaveClass('control-toggle--error')
  })

  it('recovers: after an error is cleared the switch is interactive again', async () => {
    // Failure boundary: clearing the error must restore normal operation without
    // losing the current value or the caller's control of the state.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    const { rerender } = render(
      <Toggle
        checked={false}
        onChange={handleChange}
        ariaLabel="Enable toasts"
        error="Toasts unavailable"
      />
    )

    rerender(<Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" />)

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).not.toHaveAttribute('aria-invalid')

    await user.click(toggle)
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('recovery: after loading completes the switch reflects the committed value', async () => {
    // Failure boundary: transitioning from loading to idle must not lose the
    // committed value or emit a spurious change.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    const { rerender } = render(
      <Toggle checked onChange={handleChange} ariaLabel="Enable toasts" isLoading />
    )

    rerender(<Toggle checked onChange={handleChange} ariaLabel="Enable toasts" />)

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).not.toBeDisabled()
    expect(toggle).toBeChecked()

    await user.click(toggle)
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(false)
  })

  it('boundary: clicks are ignored when disabled even if the caller attempts a change', async () => {
    // Failure boundary: disabled is an absolute guard; the component must not emit
    // even if a click event is dispatched programmatically.
    const handleChange = vi.fn()

    render(
      <Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" disabled />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    toggle.click()
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('concurrency: sequential clicks before a re-render each derive from the latest prop', async () => {
    // Failure boundary: a caller that does not commit the new value between
    // clicks must not cause the component to drift into an inconsistent state.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    const { rerender } = render(
      <Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    await user.click(toggle)
    await user.click(toggle)

    expect(handleChange).toHaveBeenCalledTimes(2)
    expect(handleChange).toHaveBeenNothCalledWith(1, true)
    expect(handleChange).toHaveBeenNothCalledWith(2, true)

    // The caller commits the new value; the component must now derive from the

    // committed prop and not from any internal cache.
    rerender(<Toggle checked onChange={handleChange} ariaLabel="Enable toasts" />)
    await user.click(toggle)
    expect(handleChange).toHaveBeenCalledTimes(3)
    expect(handleChange).toHaveBeenCalledWith(false)
  })

  it('respects aria-invalid="false" as a valid state', () => {
    // Boundary: explicit false must not be treated as invalid.
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Enable toasts"
        aria-invalid="false"
      />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).not.toHaveAttribute('aria-invalid')
    expect(toggle).not.toHaveClass('control-toggle--error')
  })

  it('boundary: aria-required is forwarded verbatim', () => {
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Enable toasts"
        aria-required="true"
      />
    )

    expect(screen.getByRole('switch', { name: 'Enable toasts' })).toHaveAttribute(
      'aria-required',
      'true'
    )
  })
})
