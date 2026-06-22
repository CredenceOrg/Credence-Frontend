import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FormField } from '../forms/FormField'
import Select from './Select'
import Toggle from './Toggle'

const NETWORK_OPTIONS = [
  { value: 'public', label: 'Public (Mainnet)' },
  { value: 'test', label: 'Test (Testnet)' },
]

function ControlledSelect() {
  const [value, setValue] = useState('public')

  return (
    <>
      <Select ariaLabel="Network" value={value} onChange={setValue} options={NETWORK_OPTIONS} />
      <output aria-label="Selected network">{value}</output>
    </>
  )
}

function ControlledToggle() {
  const [checked, setChecked] = useState(false)

  return (
    <>
      <Toggle ariaLabel="Enable toasts" checked={checked} onChange={setChecked} />
      <output aria-label="Toggle state">{checked ? 'enabled' : 'disabled'}</output>
    </>
  )
}

describe('Select', () => {
  it('renders every option and reflects the selected value', () => {
    render(<Select ariaLabel="Network" value="test" onChange={vi.fn()} options={NETWORK_OPTIONS} />)

    const select = screen.getByRole('combobox', { name: 'Network' })
    expect(select).toHaveValue('test')
    expect(within(select).getAllByRole('option')).toHaveLength(2)
    expect(within(select).getByRole('option', { name: 'Public (Mainnet)' })).toHaveValue('public')
    expect(within(select).getByRole('option', { name: 'Test (Testnet)' })).toHaveValue('test')
  })

  it('calls onChange with the newly selected value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Select ariaLabel="Network" value="public" onChange={onChange} options={NETWORK_OPTIONS} />
    )

    await user.selectOptions(screen.getByRole('combobox', { name: 'Network' }), 'test')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('test')
  })

  it('stays value-bound when the parent updates state', async () => {
    const user = userEvent.setup()
    render(<ControlledSelect />)

    const select = screen.getByRole('combobox', { name: 'Network' })
    expect(select).toHaveValue('public')

    await user.selectOptions(select, 'test')

    expect(select).toHaveValue('test')
    expect(screen.getByRole('status', { name: 'Selected network' })).toHaveTextContent('test')
  })

  it('uses aria-label as its accessible name when no FormField label is present', () => {
    render(<Select ariaLabel="Auto-dismiss duration" value="" onChange={vi.fn()} options={[]} />)

    expect(screen.getByRole('combobox', { name: 'Auto-dismiss duration' })).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('receives id and accessible label wiring from FormField', () => {
    render(
      <FormField id="network-select" label="Stellar Network">
        <Select value="public" onChange={vi.fn()} options={NETWORK_OPTIONS} />
      </FormField>
    )

    const select = screen.getByRole('combobox', { name: 'Stellar Network' })
    expect(select).toHaveAttribute('id', 'network-select')
    expect(screen.getByText('Stellar Network')).toHaveAttribute('for', 'network-select')
  })
})

describe('Toggle', () => {
  it('reflects the checked and unchecked state from props', () => {
    const { rerender } = render(
      <Toggle ariaLabel="Enable toasts" checked={false} onChange={vi.fn()} />
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).toHaveTextContent('Off')

    rerender(<Toggle ariaLabel="Enable toasts" checked={true} onChange={vi.fn()} />)

    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).toHaveTextContent('On')
  })

  it('calls onChange with the negated checked value on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <Toggle ariaLabel="Enable toasts" checked={false} onChange={onChange} />
    )

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))
    expect(onChange).toHaveBeenLastCalledWith(true)

    rerender(<Toggle ariaLabel="Enable toasts" checked={true} onChange={onChange} />)

    await user.click(screen.getByRole('switch', { name: 'Enable toasts' }))
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('uses ariaLabel as its accessible name', () => {
    render(<Toggle ariaLabel="Enable notifications" checked={false} onChange={vi.fn()} />)

    expect(screen.getByRole('switch', { name: 'Enable notifications' })).toBeInTheDocument()
  })

  it('is keyboard operable through the underlying button semantics', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <Toggle ariaLabel="Enable toasts" checked={false} onChange={onChange} />
    )

    screen.getByRole('switch', { name: 'Enable toasts' }).focus()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(true)

    rerender(<Toggle ariaLabel="Enable toasts" checked={true} onChange={onChange} />)

    screen.getByRole('switch', { name: 'Enable toasts' }).focus()
    await user.keyboard(' ')
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('stays checked-bound when the parent updates state quickly', async () => {
    const user = userEvent.setup()
    render(<ControlledToggle />)

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('status', { name: 'Toggle state' })).toHaveTextContent('enabled')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('status', { name: 'Toggle state' })).toHaveTextContent('disabled')
  })

  it('receives id wiring from FormField while ariaLabel provides the switch name', () => {
    render(
      <FormField id="toasts-enabled" label="Enable toasts">
        <Toggle ariaLabel="Enable toasts" checked={false} onChange={vi.fn()} />
      </FormField>
    )

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toHaveAttribute('id', 'toasts-enabled')
    expect(screen.getByText('Enable toasts')).toHaveAttribute('for', 'toasts-enabled')
  })
})
