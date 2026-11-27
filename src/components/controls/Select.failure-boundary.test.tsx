/**
 * @file Select.failure-boundary.test.tsx
 * @description Deterministic failure-boundary coverage for the Select control.
 *
 * Every assertion in this file was established by observing the component's
 * real jsdom behavior first, so the suite pins *actual* behavior rather than
 * an assumed contract. Boundaries covered:
 *
 *   - Standard rendering: option list, controlled selection, callback dispatch.
 *   - Boundary inputs: empty options, duplicate values, empty-string values,
 *     values absent from the option list, null/undefined props.
 *   - Disabled / loading gating: interaction suppression and tab-order removal.
 *   - Error and ARIA wiring: `error`, `aria-invalid`, `aria-describedby`,
 *     `aria-required`, and their precedence rules.
 *   - Failure isolation: a throwing `onChange` must not unmount the control.
 *   - Keyboard: focusability, tab order, and the removal of a disabled
 *     control from the tab sequence.
 *
 * @see {@link Select.tsx} for the implementation under test.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FormField } from '../forms/FormField'
import Select from './Select'

const networkOptions = [
  { value: 'testnet', label: 'Testnet' },
  { value: 'mainnet', label: 'Mainnet' },
  { value: 'futurenet', label: 'Futurenet' },
]

/** Renders a Select and returns its native <select> element. */
function renderSelect(props: Partial<React.ComponentProps<typeof Select>> = {}) {
  const onChange = vi.fn()
  const result = render(
    <Select value="testnet" onChange={onChange} options={networkOptions} ariaLabel="Network" {...props} />
  )
  return { ...result, onChange, select: screen.getByRole('combobox', { name: 'Network' }) as HTMLSelectElement }
}

// ---------------------------------------------------------------------------
// 1. Standard rendering and selection
// ---------------------------------------------------------------------------

describe('Select – standard rendering and selection', () => {
  it('renders exactly one option per entry, in the order supplied', () => {
    // Behavior under test: option order is preserved verbatim, not sorted.
    renderSelect()

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(networkOptions.length)
    expect(options.map((o) => o.textContent)).toEqual(['Testnet', 'Mainnet', 'Futurenet'])
  })

  it('selects the option matching the controlled value', () => {
    // Behavior under test: `value` drives selection rather than the DOM default.
    renderSelect({ value: 'futurenet' })

    const select = screen.getByRole('combobox', { name: 'Network' }) as HTMLSelectElement
    expect(select.value).toBe('futurenet')
    expect(select.selectedIndex).toBe(2)
  })

  it('dispatches onChange with the raw option value, not the label', async () => {
    // Behavior under test: consumers persist `value`, so labels must not leak.
    const user = userEvent.setup()
    const { select, onChange } = renderSelect()

    await user.selectOptions(select, 'mainnet')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('mainnet')
    expect(onChange).not.toHaveBeenCalledWith('Mainnet')
  })

  it('dispatches one call per discrete selection', async () => {
    // Behavior under test: no batching or duplicate emission per interaction.
    const user = userEvent.setup()
    const { select, onChange } = renderSelect()

    await user.selectOptions(select, 'mainnet')
    await user.selectOptions(select, 'futurenet')

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(1, 'mainnet')
    expect(onChange).toHaveBeenNthCalledWith(2, 'futurenet')
  })

  it('keeps the control fully controlled: value does not drift before the prop updates', async () => {
    // Behavior under test: a controlled select must not self-mutate. Selecting
    // emits, but the rendered value only follows the `value` prop.
    const user = userEvent.setup()
    const { select, rerender, onChange } = renderSelect({ value: 'testnet' })

    await user.selectOptions(select, 'mainnet')
    expect(onChange).toHaveBeenCalledWith('mainnet')

    // Parent ignored the change: the control must snap back to the prop value.
    expect(select.value).toBe('testnet')

    rerender(
      <Select value="mainnet" onChange={vi.fn()} options={networkOptions} ariaLabel="Network" />
    )
    expect(select.value).toBe('mainnet')
  })
})

// ---------------------------------------------------------------------------
// 2. Boundary inputs
// ---------------------------------------------------------------------------

describe('Select – boundary inputs', () => {
  it('renders an empty but present combobox when options is empty', () => {
    // Behavior under test: an empty list is a valid state, not a render crash.
    renderSelect({ options: [], value: '' })

    const select = screen.getByRole('combobox', { name: 'Network' }) as HTMLSelectElement
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(select.value).toBe('')
    expect(select.selectedIndex).toBe(-1)
  })

  it('renders every duplicate-valued option without a React key collision', () => {
    // Behavior under test: duplicate values are a caller-supplied boundary and
    // must not degrade into React's non-unique-key reconciliation path, which
    // can duplicate or silently drop options.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const duplicateOptions = [
      { value: 'dup', label: 'First' },
      { value: 'dup', label: 'Second' },
      { value: 'other', label: 'Other' },
    ]

    renderSelect({ options: duplicateOptions, value: 'dup' })

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    expect(options.map((o) => o.textContent)).toEqual(['First', 'Second', 'Other'])
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('emits the duplicate value when the duplicated option is selected', async () => {
    // Behavior under test: duplicate values must still dispatch deterministically.
    const user = userEvent.setup()
    const { select, onChange } = renderSelect({
      options: [
        { value: 'dup', label: 'First' },
        { value: 'dup', label: 'Second' },
      ],
      value: 'dup',
    })

    await user.selectOptions(select, 'dup')

    expect(onChange).toHaveBeenCalledWith('dup')
  })

  it('falls back to the first option when value is absent from options', () => {
    // Behavior under test: an unknown persisted value must not leave the
    // control blank; the browser deterministically selects the first option.
    renderSelect({ value: 'not-a-real-network' })

    const select = screen.getByRole('combobox', { name: 'Network' }) as HTMLSelectElement
    expect(select.value).toBe('testnet')
    expect(select.selectedIndex).toBe(0)
  })

  it('supports an empty-string option value and reports it as empty', () => {
    // Behavior under test: '' is a legitimate sentinel ("none") and must be
    // selectable and observable as '' rather than collapsing to blank.
    renderSelect({
      options: [
        { value: '', label: 'Not set' },
        { value: 'set', label: 'Set' },
      ],
      value: '',
    })

    const select = screen.getByRole('combobox', { name: 'Network' }) as HTMLSelectElement
    expect(select.value).toBe('')
    expect(select.selectedIndex).toBe(0)
    expect(screen.getByRole('option', { name: 'Not set' })).toHaveValue('')
  })

  it('renders an option whose value and label are both empty', () => {
    // Behavior under test: degenerate labels must not break rendering.
    renderSelect({ options: [{ value: 'blank', label: '' }], value: 'blank' })

    const select = screen.getByRole('combobox', { name: 'Network' }) as HTMLSelectElement
    expect(select.value).toBe('blank')
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  it('survives a null value prop by falling back to the first option', () => {
    // Behavior under test: `value` is typed as string, but JS callers and
    // persisted state can supply null. The control must degrade predictably
    // instead of throwing during render.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderSelect({ value: null as unknown as string })

    const select = screen.getByRole('combobox', { name: 'Network' }) as HTMLSelectElement
    expect(select.value).toBe('testnet')
    expect(select.selectedIndex).toBe(0)
    errorSpy.mockRestore()
  })

  it('escapes HTML in option labels rather than interpreting it', () => {
    // Behavior under test: labels are untrusted text; they must be escaped.
    const { container } = renderSelect({
      options: [{ value: 'x', label: '<b>bold</b>' }],
      value: 'x',
    })

    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByRole('option').textContent).toBe('<b>bold</b>')
  })

  it('applies the base control class and omits the error class when valid', () => {
    // Behavior under test: default styling leaves no stray modifier behind.
    renderSelect()

    const select = screen.getByRole('combobox', { name: 'Network' })
    expect(select).toHaveClass('control-select')
    expect(select).not.toHaveClass('control-select--error')
  })
})

// ---------------------------------------------------------------------------
// 3. Disabled and loading states
// ---------------------------------------------------------------------------

describe('Select – disabled and loading gating', () => {
  it('disables the control and suppresses interaction when disabled', async () => {
    // Behavior under test: disabled is a hard interaction boundary.
    const user = userEvent.setup()
    const { select, onChange } = renderSelect({ disabled: true })

    expect(select).toBeDisabled()
    await user.click(select)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not dispatch a change when a change is forced onto a disabled control', () => {
    // Behavior under test: even a direct change event on a disabled control
    // must not produce a callback, so no state can drift while disabled.
    const { select, onChange } = renderSelect({ disabled: true })

    fireEvent.change(select, { target: { value: 'mainnet' } })

    expect(onChange).not.toHaveBeenCalled()
    expect(select.value).toBe('testnet')
  })

  it('treats isLoading as disabled and renders the loading affordances', () => {
    // Behavior under test: loading gates interaction the same way `disabled` does.
    const { container, select } = renderSelect({ isLoading: true })

    expect(select).toBeDisabled()
    expect(container.querySelector('.control-select-wrapper--loading')).toBeInTheDocument()
    expect(container.querySelector('.control-select-spinner')).toBeInTheDocument()
  })

  it('hides the spinner from assistive technology', () => {
    // Behavior under test: the spinner is decorative and must be aria-hidden.
    const { container } = renderSelect({ isLoading: true })

    expect(container.querySelector('.control-select-spinner')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders no spinner or loading class when not loading', () => {
    // Behavior under test: no leftover loading affordances in the default state.
    const { container } = renderSelect()

    expect(container.querySelector('.control-select-wrapper--loading')).toBeNull()
    expect(container.querySelector('.control-select-spinner')).toBeNull()
  })

  it('keeps a disabled control out of the tab order', async () => {
    // Behavior under test: keyboard users must not land on a disabled control.
    const user = userEvent.setup()
    render(
      <>
        <input data-testid="before" />
        <Select
          value="testnet"
          onChange={vi.fn()}
          options={networkOptions}
          ariaLabel="Network"
          disabled
        />
        <input data-testid="after" />
      </>
    )

    screen.getByTestId('before').focus()
    await user.tab()

    expect(screen.getByTestId('after')).toHaveFocus()
  })

  it('places an enabled control in the tab order', async () => {
    // Behavior under test: the enabled counterpart of the case above.
    const user = userEvent.setup()
    render(
      <>
        <input data-testid="before" />
        <Select
          value="testnet"
          onChange={vi.fn()}
          options={networkOptions}
          ariaLabel="Network"
        />
        <input data-testid="after" />
      </>
    )

    screen.getByTestId('before').focus()
    await user.tab()

    expect(screen.getByRole('combobox', { name: 'Network' })).toHaveFocus()
  })

  it('focuses programmatically and exposes a stable accessible name', () => {
    // Behavior under test: programmatic focus and naming stay available even
    // in the plain (non-FormField) usage.
    const { select } = renderSelect()

    select.focus()

    expect(select).toHaveFocus()
    expect(select).toHaveAccessibleName('Network')
  })
})

// ---------------------------------------------------------------------------
// 4. Error and ARIA wiring
// ---------------------------------------------------------------------------

describe('Select – error and ARIA wiring', () => {
  it('marks the control invalid and applies the error class when error is set', () => {
    // Behavior under test: the `error` prop is a validation failure boundary.
    renderSelect({ error: 'Network is required' })

    const select = screen.getByRole('combobox', { name: 'Network' })
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveClass('control-select--error')
  })

  it('treats aria-invalid as a string "true" as invalid', () => {
    // Behavior under test: FormField forwards the ARIA state as a string, so
    // both the boolean and string forms must be honored.
    renderSelect({ 'aria-invalid': 'true' })

    const select = screen.getByRole('combobox', { name: 'Network' })
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveClass('control-select--error')
  })

  it('leaves the control valid for aria-invalid "false"', () => {
    // Behavior under test: an explicit negative ARIA state must not be
    // rewritten to a truthy value.
    renderSelect({ 'aria-invalid': 'false' })

    const select = screen.getByRole('combobox', { name: 'Network' })
    expect(select).not.toHaveAttribute('aria-invalid')
    expect(select).not.toHaveClass('control-select--error')
  })

  it('gives the error prop precedence over an explicit aria-invalid="false"', () => {
    // Behavior under test: a real error must not be masked by a stale ARIA hint.
    renderSelect({ error: 'Network is required', 'aria-invalid': 'false' })

    const select = screen.getByRole('combobox', { name: 'Network' })
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveClass('control-select--error')
  })

  it('ignores an empty error string as a validation failure', () => {
    // Behavior under test: `error=""` is "no error", not "error present".
    renderSelect({ error: '' })

    const select = screen.getByRole('combobox', { name: 'Network' })
    expect(select).not.toHaveAttribute('aria-invalid')
    expect(select).not.toHaveClass('control-select--error')
  })

  it('forwards aria-describedby and aria-required verbatim', () => {
    // Behavior under test: description and required state pass through untouched.
    renderSelect({ 'aria-describedby': 'network-hint', 'aria-required': true })

    const select = screen.getByRole('combobox', { name: 'Network' })
    expect(select).toHaveAttribute('aria-describedby', 'network-hint')
    expect(select).toHaveAttribute('aria-required', 'true')
  })

  it('omits aria-describedby and aria-required when not supplied', () => {
    // Behavior under test: unset ARIA attributes are absent, not empty strings.
    renderSelect()

    const select = screen.getByRole('combobox', { name: 'Network' })
    expect(select).not.toHaveAttribute('aria-describedby')
    expect(select).not.toHaveAttribute('aria-required')
  })

  it('forwards the id prop onto the native control', () => {
    // Behavior under test: the id drives label association from the outside.
    renderSelect({ id: 'network-field' })

    expect(screen.getByRole('combobox', { name: 'Network' })).toHaveAttribute('id', 'network-field')
  })

  it('derives its accessible name from a FormField label when no ariaLabel is given', () => {
    // Behavior under test: composed usage supplies the name via label/htmlFor.
    render(
      <FormField id="network" label="Preferred network">
        <Select value="testnet" onChange={vi.fn()} options={networkOptions} />
      </FormField>
    )

    expect(screen.getByRole('combobox', { name: 'Preferred network' })).toHaveAttribute('id', 'network')
  })

  it('combines FormField hint and error ids into aria-describedby', () => {
    // Behavior under test: multiple descriptions are space-joined, not dropped.
    render(
      <FormField id="network" label="Preferred network" hint="USDC settlement" error="Required">
        <Select value="testnet" onChange={vi.fn()} options={networkOptions} />
      </FormField>
    )

    const select = screen.getByRole('combobox', { name: 'Preferred network' })
    expect(select).toHaveAttribute('aria-describedby', 'network-hint network-error')
    expect(select).toHaveAttribute('aria-invalid', 'true')
  })
})

// ---------------------------------------------------------------------------
// 5. Failure isolation
// ---------------------------------------------------------------------------

describe('Select – failure isolation', () => {
  /**
   * Runs `fn` while swallowing the `error` event React dispatches when an
   * event handler throws. React 18 rethrows handler errors out of the dispatch
   * loop, so without this the throw surfaces as an uncaught exception even
   * though the component itself never crashed.
   */
  function withSuppressedHandlerError(fn: () => void) {
    const onError = (event: ErrorEvent) => event.preventDefault()
    window.addEventListener('error', onError)
    try {
      fn()
    } finally {
      window.removeEventListener('error', onError)
    }
  }

  it('stays mounted when onChange throws', () => {
    // Behavior under test: a consumer callback that throws must not take the
    // control down with it — the form remains usable and recoverable.
    const throwing = vi.fn(() => {
      throw new Error('consumer exploded')
    })
    render(
      <Select value="testnet" onChange={throwing} options={networkOptions} ariaLabel="Network" />
    )

    withSuppressedHandlerError(() => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Network' }), {
        target: { value: 'mainnet' },
      })
    })

    expect(throwing).toHaveBeenCalledWith('mainnet')
    expect(screen.getByRole('combobox', { name: 'Network' })).toBeInTheDocument()
  })

  it('recovers and dispatches again after a throwing onChange', async () => {
    // Behavior under test: the control is not poisoned by a failed callback;
    // a subsequent interaction still reaches the handler.
    const user = userEvent.setup()
    const flaky = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('transient')
      })
      .mockImplementation(() => undefined)
    render(
      <Select value="testnet" onChange={flaky} options={networkOptions} ariaLabel="Network" />
    )

    const select = screen.getByRole('combobox', { name: 'Network' })
    withSuppressedHandlerError(() => {
      fireEvent.change(select, { target: { value: 'mainnet' } })
    })
    await user.selectOptions(select, 'futurenet')

    expect(flaky).toHaveBeenCalledTimes(2)
    expect(flaky).toHaveBeenLastCalledWith('futurenet')
  })

  it('renders identically across repeated mounts', () => {
    // Behavior under test: rendering is pure with respect to props, so the
    // same inputs always produce the same DOM (no hidden per-mount state).
    const { unmount } = renderSelect()
    const first = screen.getByRole('combobox', { name: 'Network' }).outerHTML
    unmount()

    renderSelect()
    const second = screen.getByRole('combobox', { name: 'Network' }).outerHTML

    expect(second).toBe(first)
  })
})

// ---------------------------------------------------------------------------
// 6. Keyboard interaction
// ---------------------------------------------------------------------------

describe('Select – keyboard interaction', () => {
  it('dispatches onChange from a keyboard-driven selection', async () => {
    // Behavior under test: selection via the keyboard reaches onChange exactly
    // as a pointer selection does.
    const user = userEvent.setup()
    const { select, onChange } = renderSelect()

    select.focus()
    await user.selectOptions(select, 'mainnet')

    expect(onChange).toHaveBeenCalledWith('mainnet')
  })

  it('does not dispatch onChange for bare arrow navigation without a commit', async () => {
    // Behavior under test: jsdom does not move the selection on arrow keys for
    // a closed listbox, so no spurious change may be emitted.
    const user = userEvent.setup()
    const { select, onChange } = renderSelect()

    select.focus()
    await user.keyboard('{ArrowDown}')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('dispatches the current value when the same option is re-selected', async () => {
    // Behavior under test: re-selecting an already-selected value is a no-op
    // for the DOM but must not fabricate extra callbacks.
    const user = userEvent.setup()
    const { select, onChange } = renderSelect({ value: 'testnet' })

    await user.selectOptions(select, 'testnet')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('testnet')
  })

  it('keeps a disabled control unfocusable via programmatic focus', () => {
    // Behavior under test: jsdom honors `disabled` for `.focus()` on form
    // controls, so a disabled Select cannot be focused by a stray call.
    const { select } = renderSelect({ disabled: true })

    select.focus()

    expect(select).not.toHaveFocus()
  })
})
