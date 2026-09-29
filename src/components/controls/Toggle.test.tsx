import { render, screen, waitFor } from '@testing-library/react'
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

  it('does not emit when disabled', async () => {
    // Behavior under test: disabled toggles must not call onChange.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" disabled />)

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('does not emit when loading', async () => {
    // Behavior under test: loading toggles are busy and non-interactive.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Toggle checked={false} onChange={handleChange} ariaLabel="Enable toasts" isLoading />)

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))

    expect(handleChange).not.toHaveBeenCalled()
  })

  it('marks the switch invalid when an error is provided', () => {
    // Behavior under test: error prop forces aria-invalid and the error class.
    render(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Enable toasts" error="Broken" />)

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toHaveAttribute('aria-invalid', 'true')
    expect(toggle).toHaveClass('control-toggle--error')
  })

  it('disables and marks busy while an async change is in flight', async () => {
    // Behavior under test: async submissions block concurrent interactions.
    const user = userEvent.setup()
    let resolve!: () => void
    const onChangeAsync = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolve = res
        })
    )

    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        onChangeAsync={onChangeAsync}
        ariaLabel="Enable toasts"
      />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    await user.click(toggle)

    expect(onChangeAsync).toHaveBeenCalledTimes(1)
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-busy', 'true')

    // Rapid clicks while in flight must not double-submit.
    await user.click(toggle)
    expect(onChangeAsync).toHaveBeenCalledTimes(1)

    resolve()
    await waitFor(() => expect(toggle).not.toBeDisabled())
    expect(toggle).not.toHaveAttribute('aria-busy')
  })

  it('reports async failures and remains retryable', async () => {
    // Behavior under test: failed async changes surface an error and leave the control usable.
    const user = userEvent.setup()
    const failure = new Error('network')
    const onChangeAsync = vi.fn().mockRejected(failure)
    const onChangeError = vi.fn()

    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        onChangeAsync={onChangeAsync}
        onChangeError={onChangeError}
        ariaLabel="Enable toasts"
      />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    await user.click(toggle)

    await waitFor(() => expect(onChangeError).toHaveBeenCalledWith(failure))
    expect(toggle).not.toBeDisabled()
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('allows retry after a failure', async () => {
    // Behavior under test: a failed async change can be retried successfully.
    const user = userEvent.setup()
    const onChangeAsync = vi
      .fn()
      .mockRejectedOnce(new Error('network'))
      .mockResolvedOnce(undefined)
    const onChangeError = vi.fn()

    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        onChangeAsync={onChangeAsync}
        onChangeError={onChangeError}
        ariaLabel="Enable toasts"
      />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    await user.click(toggle)
    await waitFor(() => expect(onChangeError).toHaveBeenCalled())

    await user.click(toggle)
    await waitFor(() => expect(onChangeAsync).toHaveBeenCalledTimes(2))
    expect(onChangeError).toHaveBeenCalledTimes(1)
  })

  it('ignores additional clicks while a request is in flight', async () => {
    // Behavior under test: concurrent clicks are coalesced into a single submit.
    const user = userEvent.setup()
    let resolve!: () => void
    const onChangeAsync = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolve = res
        })
    )

    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        onChangeAsync={onChangeAsync}
        ariaLabel="Enable toasts"
      />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    await user.click(toggle)
    await user.click(toggle)
    await user.click(toggle)

    expect(onChangeAsync).toHaveBeenCalledTimes(1)

    resolve()
    await waitFor(() => expect(toggle).not.toBeDisabled())
  })

  it('supports aria-required and aria-describedby passthrough', () => {
    // Behavior under test: external aria wiring is preserved for form integrations.
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Enable toasts"
        aria-required="true"
        aria-describedby="help-text"
      />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toHaveAttribute('aria-required', 'true')
    expect(toggle).toHaveAttribute('aria-describedby', 'help-text')
  })

  it('prefers onChangeAsync over onChange when both are provided', async () => {
    // Behavior under test: async handler is the single source of truth when present.
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onChangeAsync = vi.fn().mockResolved(undefined)

    render(
      <Toggle
        checked={false}
        onChange={onChange}
        onChangeAsync={onChangeAsync}
        ariaLabel="Enable toasts"
      />
    )

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))

    expect(onChangeAsync).toHaveBeenCalledWith(true)
    expect(onChange).not.toHaveBeenCalled()
  })
})
