import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FormField } from '../forms/FormField'
import AsyncSelect from './AsyncSelect'
import Select from './Select'

/**
 * Boundary and recovery coverage for the presentational Select control.
 *
 * Select is a controlled, stateless wrapper around a native <select>: it owns no
 * data and performs no fetching. Loading, error, permission (disabled) and stale
 * states are all supplied by the caller (see AsyncSelect for the async adapter),
 * so these tests drive every state through prop transitions and assert the
 * invariants that keep the control safe to reuse:
 *
 *   I1 Authorization: `isLoading` or `disabled` implies a disabled native select,
 *      so no user interaction can reach `onChange` while input is not permitted.
 *   I2 No data loss: the control never rewrites `value`. Loading, error, stale or
 *      emptied option lists must not clear or mutate the caller's selection, and
 *      a value that stops matching the options must not be "helpfully" written back.
 *   I3 Single source of truth: `value` is the only selection state; the component
 *      holds no internal copy, so repeated renders with equal props never emit.
 *   I4 Deterministic invalidity: the control is invalid iff `error` is truthy or
 *      `aria-invalid` is `true` / `'true'`. An empty error string is not an error.
 *   I5 Diagnosable but not chatty: `error` only drives the invalid state; the
 *      message itself is rendered (once) by the caller, so screen readers get one
 *      announcement and the raw text is not duplicated into the control.
 */

const networkOptions = [
  { value: 'testnet', label: 'Testnet' },
  { value: 'mainnet', label: 'Mainnet' },
  { value: 'futurenet', label: 'Futurenet' },
]

const wrapperOf = (container: HTMLElement) => container.querySelector('.control-select-wrapper')
const combobox = (name = 'Network') => screen.getByRole('combobox', { name })
const options = () => screen.queryAllByRole('option')

describe('Select — option and value boundaries', () => {
  it('renders a single-option list and selects it when it matches the value', () => {
    // Behavior under test: the smallest non-empty option list is a valid list.
    render(
      <Select
        value="testnet"
        onChange={vi.fn()}
        options={[{ value: 'testnet', label: 'Testnet' }]}
        ariaLabel="Network"
      />
    )

    expect(options()).toHaveLength(1)
    expect(combobox()).toHaveValue('testnet')
  })

  it('renders duplicate option values as distinct entries and keeps the value stable', () => {
    // Behavior under test: a duplicated value (bad upstream data) is rendered, not
    // deduplicated, so the list the user sees matches the data the caller supplied.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <Select
        value="mainnet"
        onChange={vi.fn()}
        options={[
          { value: 'mainnet', label: 'Mainnet' },
          { value: 'mainnet', label: 'Mainnet (stale)' },
        ]}
        ariaLabel="Network"
      />
    )

    expect(options()).toHaveLength(2)
    expect(combobox()).toHaveValue('mainnet')
    expect((screen.getByRole('option', { name: 'Mainnet' }) as HTMLOptionElement).selected).toBe(
      true
    )
    // Duplicate values must not degrade into React's unsupported key reconciliation.
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('matches option values case-sensitively instead of guessing a selection', () => {
    // Behavior under test: 'Mainnet' is not 'mainnet', so the stale value does not
    // silently resolve to a differently-cased option.
    render(
      <Select value="Mainnet" onChange={vi.fn()} options={networkOptions} ariaLabel="Network" />
    )

    expect(combobox()).toHaveValue('testnet')
    expect((screen.getByRole('option', { name: 'Testnet' }) as HTMLOptionElement).selected).toBe(
      true
    )
  })

  it('leaves the control unselected when options is empty but a value is held', () => {
    // Behavior under test: an emptied option list (stale fetch, cleared cache) does
    // not fabricate an option; the select simply has no selection to display.
    render(<Select value="mainnet" onChange={vi.fn()} options={[]} ariaLabel="Network" />)

    expect(options()).toHaveLength(0)
    expect((combobox() as HTMLSelectElement).selectedIndex).toBe(-1)
  })

  it('keeps the browser default selection when the empty value matches no option', () => {
    // Boundary: '' matches nothing, and React leaves the control on the first option
    // instead of clearing it. The caller's value is untouched — no emission.
    const onChange = vi.fn()
    render(<Select value="" onChange={onChange} options={networkOptions} ariaLabel="Network" />)

    expect(combobox()).toHaveValue('testnet')
    expect((combobox() as HTMLSelectElement).selectedIndex).toBe(0)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('selects the empty-string option when the value is empty and such an option exists', () => {
    // Behavior under test: a deliberate placeholder option ('') is honored.
    render(
      <Select
        value=""
        onChange={vi.fn()}
        options={[
          { value: '', label: 'Choose a network' },
          { value: 'mainnet', label: 'Mainnet' },
        ]}
        ariaLabel="Network"
      />
    )

    expect(combobox()).toHaveValue('')
    expect((combobox() as HTMLSelectElement).selectedIndex).toBe(0)
  })

  it('renders option values and labels containing markup-significant characters verbatim', () => {
    // Behavior under test: caller data is text, never markup — no injection sink.
    const hostile = [{ value: '<img src=x onerror="alert(1)">', label: '<b>Bold</b> & "quoted"' }]
    const { container } = render(
      <Select value={hostile[0].value} onChange={vi.fn()} options={hostile} ariaLabel="Network" />
    )

    expect(combobox()).toHaveValue('<img src=x onerror="alert(1)">')
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByRole('option', { name: '<b>Bold</b> & "quoted"' })).toBeInTheDocument()
  })

  it('renders unicode, emoji and whitespace-bearing labels without collapsing them', () => {
    const unicodeOptions = [
      { value: 'ja', label: 'ネットワーク' },
      { value: 'emoji', label: '🪙 Credence' },
      { value: 'padded', label: '  Spaced  ' },
    ]
    render(<Select value="ja" onChange={vi.fn()} options={unicodeOptions} ariaLabel="Network" />)

    expect(screen.getByRole('option', { name: 'ネットワーク' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '🪙 Credence' })).toBeInTheDocument()
    // Accessible names are whitespace-normalized by the a11y layer, but the label
    // text itself must survive verbatim.
    expect(screen.getByRole('option', { name: 'Spaced' }).textContent).toBe('  Spaced  ')
    expect(combobox()).toHaveValue('ja')
  })

  it('renders a large option list completely', () => {
    // Behavior under test: the control does not truncate or virtualize; a long
    // list stays complete so option indexes remain meaningful to the caller.
    const many = Array.from({ length: 500 }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }))

    render(<Select value="v499" onChange={vi.fn()} options={many} ariaLabel="Network" />)

    expect(options()).toHaveLength(500)
    expect(combobox()).toHaveValue('v499')
    expect(within(screen.getByRole('option', { name: 'Option 0' })).queryByText('v0')).toBeNull()
  })
})

describe('Select — invalid-state boundaries (I4)', () => {
  it.each([
    ['boolean true', true],
    ['string "true"', 'true' as const],
  ])('marks the control invalid for aria-invalid %s', (_label, ariaInvalid) => {
    render(
      <Select
        value="testnet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        aria-invalid={ariaInvalid}
      />
    )

    expect(combobox()).toHaveAttribute('aria-invalid', 'true')
    expect(combobox()).toHaveClass('control-select--error')
  })

  it.each([
    ['boolean false', false],
    ['string "false"', 'false' as const],
    ['undefined', undefined],
  ])('leaves the control valid for aria-invalid %s', (_label, ariaInvalid) => {
    render(
      <Select
        value="testnet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        aria-invalid={ariaInvalid}
      />
    )

    expect(combobox()).not.toHaveAttribute('aria-invalid')
    expect(combobox()).not.toHaveClass('control-select--error')
  })

  it('treats an empty error string as no error at all', () => {
    // Boundary: `error=''` is falsy, so an empty validation message must not paint
    // the control red or announce invalidity.
    render(
      <Select
        value="testnet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        error=""
      />
    )

    expect(combobox()).not.toHaveAttribute('aria-invalid')
    expect(combobox()).not.toHaveClass('control-select--error')
  })

  it('marks the control invalid for a whitespace-only error message', () => {
    // Boundary: a non-empty message of any content is still an error state.
    render(
      <Select
        value="testnet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        error=" "
      />
    )

    expect(combobox()).toHaveAttribute('aria-invalid', 'true')
  })

  it('keeps the control enabled while invalid so the user can correct the choice', async () => {
    // Behavior under test: invalid is not disabled — a rejected value must stay fixable.
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <Select
        value="testnet"
        onChange={onChange}
        options={networkOptions}
        ariaLabel="Network"
        error="Unsupported network"
      />
    )

    expect(combobox()).toBeEnabled()
    await user.selectOptions(combobox(), 'mainnet')
    expect(onChange).toHaveBeenCalledWith('mainnet')
  })

  it('does not render the error message itself, leaving one announcement to the caller (I5)', () => {
    render(
      <Select
        value="testnet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        error="Unsupported network"
      />
    )

    expect(screen.queryByText('Unsupported network')).toBeNull()
  })

  it('announces the error exactly once when composed with FormField', () => {
    render(
      <FormField id="network" label="Preferred network" error="Unsupported network">
        <Select value="testnet" onChange={vi.fn()} options={networkOptions} />
      </FormField>
    )

    expect(screen.getAllByText(/Unsupported network/)).toHaveLength(1)
    expect(combobox('Preferred network')).toHaveAttribute('aria-describedby', 'network-error')
  })

  it('forwards aria-required verbatim and stays valid when required is set', () => {
    render(
      <Select
        value=""
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        aria-required="true"
      />
    )

    expect(combobox()).toHaveAttribute('aria-required', 'true')
    expect(combobox()).not.toHaveAttribute('aria-invalid')
  })
})

describe('Select — loading state and recovery (I1, I2)', () => {
  it('disables the control, marks the wrapper and shows a decorative spinner', () => {
    const { container } = render(
      <Select
        value="testnet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        isLoading
      />
    )

    expect(combobox()).toBeDisabled()
    expect(wrapperOf(container)).toHaveClass('control-select-wrapper--loading')
    expect(container.querySelector('.control-select-spinner')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  })

  it('emits no change while loading, even if the DOM is driven directly', async () => {
    // Behavior under test: the loading gate holds for real user input.
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <Select
        value="testnet"
        onChange={onChange}
        options={networkOptions}
        ariaLabel="Network"
        isLoading
      />
    )

    await user.selectOptions(combobox(), 'mainnet')
    await user.click(combobox())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('preserves the held value through loading and re-enables input on recovery', async () => {
    // Recovery: loading resolves -> control becomes usable again with the value intact.
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender, container } = render(
      <Select
        value="mainnet"
        onChange={onChange}
        options={networkOptions}
        ariaLabel="Network"
        isLoading
      />
    )

    expect(combobox()).toBeDisabled()

    rerender(
      <Select value="mainnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )

    expect(combobox()).toBeEnabled()
    expect(combobox()).toHaveValue('mainnet')
    expect(wrapperOf(container)).not.toHaveClass('control-select-wrapper--loading')
    expect(container.querySelector('.control-select-spinner')).toBeNull()

    await user.selectOptions(combobox(), 'futurenet')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('futurenet')
  })

  it('survives repeated load/settle cycles without dropping or duplicating the value', () => {
    // Recovery: flapping loading state must not disturb the held value.
    const view = (isLoading: boolean) => (
      <Select
        value="futurenet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        isLoading={isLoading}
      />
    )
    const { rerender } = render(view(true))

    for (let i = 0; i < 5; i++) {
      rerender(view(false))
      expect(combobox()).toHaveValue('futurenet')
      rerender(view(true))
      expect(combobox()).toHaveValue('futurenet')
    }
  })

  it('keeps the control disabled after loading settles when disabled is also set', () => {
    // I1: recovery of the loading gate must not lift a separate permission gate.
    const { rerender, container } = render(
      <Select
        value="testnet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        disabled
        isLoading
      />
    )

    expect(combobox()).toBeDisabled()

    rerender(
      <Select
        value="testnet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        disabled
      />
    )

    expect(combobox()).toBeDisabled()
    expect(wrapperOf(container)).not.toHaveClass('control-select-wrapper--loading')
    expect(combobox()).toHaveValue('testnet')
  })

  it('applies both loading and error presentation, then recovers fully from either first', () => {
    // Combined state: the select is disabled *and* invalid; value survives recovery.
    const props = {
      value: 'mainnet',
      onChange: vi.fn(),
      options: networkOptions,
      ariaLabel: 'Network',
    }
    const { rerender, container } = render(<Select {...props} isLoading error="Stale options" />)

    expect(combobox()).toBeDisabled()
    expect(combobox()).toHaveAttribute('aria-invalid', 'true')
    expect(wrapperOf(container)).toHaveClass('control-select-wrapper--loading')

    // Retry in flight, error already cleared: still locked and still valid-state.
    rerender(<Select {...props} isLoading />)
    expect(combobox()).toBeDisabled()
    expect(combobox()).not.toHaveAttribute('aria-invalid')

    // Retry succeeded: enabled, valid, value intact.
    rerender(<Select {...props} />)
    expect(combobox()).toBeEnabled()
    expect(combobox()).not.toHaveAttribute('aria-invalid')
    expect(combobox()).toHaveValue('mainnet')
    expect(container.querySelector('.control-select-spinner')).toBeNull()
  })

  it('keeps the value when loading resolves into an empty option list', async () => {
    // Boundary: a fetch that resolves empty is not an error, and the caller's value
    // is still owned by the caller (no phantom selection, no emission).
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <Select value="mainnet" onChange={onChange} options={[]} ariaLabel="Network" isLoading />
    )

    rerender(<Select value="mainnet" onChange={onChange} options={[]} ariaLabel="Network" />)

    expect(combobox()).toBeEnabled()
    expect(options()).toHaveLength(0)
    expect((combobox() as HTMLSelectElement).selectedIndex).toBe(-1)
    await user.click(combobox())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not throw or emit when unmounted mid-load', () => {
    // Recovery teardown: no timers or effects outlive the control, so unmounting
    // while loading is inert.
    const onChange = vi.fn()
    const { unmount } = render(
      <Select
        value="testnet"
        onChange={onChange}
        options={networkOptions}
        ariaLabel="Network"
        isLoading
      />
    )

    expect(() => unmount()).not.toThrow()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Select — error recovery without data loss (I2, I3)', () => {
  it('clears the invalid state once the error resolves and keeps the value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <Select
        value="testnet"
        onChange={onChange}
        options={networkOptions}
        ariaLabel="Network"
        error="Could not verify network"
      />
    )

    expect(combobox()).toHaveAttribute('aria-invalid', 'true')
    expect(combobox()).toHaveClass('control-select--error')

    rerender(
      <Select value="testnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )

    expect(combobox()).not.toHaveAttribute('aria-invalid')
    expect(combobox()).not.toHaveClass('control-select--error')
    expect(combobox()).toHaveValue('testnet')

    await user.selectOptions(combobox(), 'futurenet')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('futurenet')
  })

  it('returns the invalid state to a clean baseline after repeated error cycles', () => {
    const view = (error?: string) => (
      <Select
        value="mainnet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        error={error}
      />
    )
    const { rerender } = render(view('Server unavailable'))

    for (let i = 0; i < 3; i++) {
      rerender(view('Server unavailable'))
      expect(combobox()).toHaveAttribute('aria-invalid', 'true')
      rerender(view(undefined))
      expect(combobox()).not.toHaveAttribute('aria-invalid')
      expect(combobox()).toHaveValue('mainnet')
    }
  })

  it('keeps the value and error state when the error arrives while disabled', () => {
    // Permission failure path: the caller's selection is still retained while locked.
    const { rerender } = render(
      <Select
        value="futurenet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        disabled
      />
    )

    expect(combobox()).toBeDisabled()
    expect(combobox()).toHaveValue('futurenet')

    rerender(
      <Select
        value="futurenet"
        onChange={vi.fn()}
        options={networkOptions}
        ariaLabel="Network"
        disabled
        error="Insufficient permissions"
      />
    )

    expect(combobox()).toBeDisabled()
    expect(combobox()).toHaveAttribute('aria-invalid', 'true')
    expect(combobox()).toHaveValue('futurenet')
  })
})

describe('Select — permission (disabled) boundaries (I1)', () => {
  it('ignores pointer and keyboard interaction while disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <Select
        value="testnet"
        onChange={onChange}
        options={networkOptions}
        ariaLabel="Network"
        disabled
      />
    )

    await user.selectOptions(combobox(), 'mainnet')
    combobox().focus()
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onChange).not.toHaveBeenCalled()
    expect(combobox()).toHaveValue('testnet')
  })

  it('restores interaction when the permission gate is lifted', async () => {
    // Recovery: re-enabling must not require remounting and must not reset the value.
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <Select
        value="testnet"
        onChange={onChange}
        options={networkOptions}
        ariaLabel="Network"
        disabled
      />
    )

    rerender(
      <Select value="testnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )

    await user.selectOptions(combobox(), 'mainnet')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('mainnet')
  })

  it('does not emit when a value change is driven by the caller rather than the user', () => {
    // I3: prop-driven transitions are silent; only user intent reaches onChange.
    const onChange = vi.fn()
    const { rerender } = render(
      <Select value="testnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )

    rerender(
      <Select value="mainnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )
    rerender(
      <Select value="futurenet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )

    expect(combobox()).toHaveValue('futurenet')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Select — stale state and concurrent transitions (I2, I3)', () => {
  it('keeps the selection when the refreshed option list still contains the value', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <Select value="mainnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )

    rerender(
      <Select
        value="mainnet"
        onChange={onChange}
        options={[
          { value: 'mainnet', label: 'Mainnet' },
          { value: 'sandboxnet', label: 'Sandboxnet' },
        ]}
        ariaLabel="Network"
      />
    )

    expect(combobox()).toHaveValue('mainnet')
    expect((screen.getByRole('option', { name: 'Mainnet' }) as HTMLOptionElement).selected).toBe(
      true
    )
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not emit a write-back when a refresh drops the currently held option', () => {
    // I2: the option disappearing is a caller-side reconciliation problem. Silently
    // emitting the fallback option would persist a value the user never chose.
    const onChange = vi.fn()
    const { rerender } = render(
      <Select value="futurenet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )

    rerender(
      <Select
        value="futurenet"
        onChange={onChange}
        options={[
          { value: 'testnet', label: 'Testnet' },
          { value: 'mainnet', label: 'Mainnet' },
        ]}
        ariaLabel="Network"
      />
    )

    expect(combobox()).toHaveValue('testnet')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('restores the held value when the dropped option reappears on a later refresh', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <Select value="mainnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )

    rerender(
      <Select
        value="mainnet"
        onChange={onChange}
        options={[{ value: 'testnet', label: 'Testnet' }]}
        ariaLabel="Network"
      />
    )
    expect(combobox()).toHaveValue('testnet')

    rerender(
      <Select value="mainnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )
    expect(combobox()).toHaveValue('mainnet')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('emits every user selection in order during a rapid sequence', async () => {
    // Concurrency: a fast user is not throttled and no intermediate value is lost.
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <Select value="testnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )

    await user.selectOptions(combobox(), 'mainnet')
    rerender(
      <Select value="mainnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )
    await user.selectOptions(combobox(), 'futurenet')
    rerender(
      <Select value="futurenet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )

    expect(onChange.mock.calls).toEqual([['mainnet'], ['futurenet']])
  })

  it('drops in-flight selections made while a reload gate closes, then accepts new ones after it opens', async () => {
    // Concurrency: a toggle mid-interaction can neither crash nor emit a stale write.
    const user = userEvent.setup()
    const onChange = vi.fn()
    const view = (isLoading: boolean) => (
      <Select
        value="testnet"
        onChange={onChange}
        options={networkOptions}
        ariaLabel="Network"
        isLoading={isLoading}
      />
    )
    const { rerender } = render(view(false))

    rerender(view(true))
    rerender(view(false))
    await user.selectOptions(combobox(), 'mainnet')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('mainnet')
    expect(combobox()).toHaveValue('testnet')
  })

  it('stays on the caller value when the options prop is a new array with equal contents', () => {
    // I3: referential churn in the caller must not reset or re-emit the selection.
    const onChange = vi.fn()
    const { rerender } = render(
      <Select value="mainnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )

    rerender(
      <Select
        value="mainnet"
        onChange={onChange}
        options={networkOptions.map((o) => ({ ...o }))}
        ariaLabel="Network"
      />
    )

    expect(combobox()).toHaveValue('mainnet')
    expect(options()).toHaveLength(3)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores an onChange that fires after the control unmounts', async () => {
    // Concurrency teardown: a handler retained from a previous mount cannot be
    // called by the unmounted control, so no orphaned write reaches the caller.
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { unmount } = render(
      <Select value="testnet" onChange={onChange} options={networkOptions} ariaLabel="Network" />
    )
    const staleSelect = combobox()
    unmount()

    await user.selectOptions(staleSelect, 'mainnet').catch(() => undefined)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Select — async adapter recovery wiring (AsyncSelect contract)', () => {
  it('renders the loading gate before options arrive and hands control back on success', async () => {
    // Behavior under test: the caller's loading/error props are the only channel the
    // control has, so AsyncSelect's resolved state must unblock it cleanly.
    const onChange = vi.fn()
    let resolveOptions: (options: typeof networkOptions) => void = () => {}
    const loadOptions = vi.fn(
      () =>
        new Promise<typeof networkOptions>((resolve) => {
          resolveOptions = resolve
        })
    )
    const { container, findByRole } = render(
      <AsyncSelect
        value="mainnet"
        onChange={onChange}
        loadOptions={loadOptions}
        ariaLabel="Network"
      />
    )

    expect(combobox()).toBeDisabled()
    expect(wrapperOf(container)).toHaveClass('control-select-wrapper--loading')

    resolveOptions(networkOptions)

    await findByRole('option', { name: 'Mainnet' })

    await waitFor(() => expect(combobox()).toBeEnabled())
    expect(combobox()).toHaveValue('mainnet')
    expect(container.querySelector('.control-select-spinner')).toBeNull()
  })
})
