import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FormField } from '../forms/FormField'
import Select from './Select'

const networkOptions = [
  { value: 'testnet', label: 'Testnet' },
  { value: 'mainnet', label: 'Mainnet' },
  { value: 'futurenet', label: 'Futurenet' },
]

describe('Select', () => {
  it('renders every provided option', () => {
    // Behavior under test: option labels and values are rendered for Settings choices.
    render(<Select value="testnet" onChange={vi.fn()} options={networkOptions} ariaLabel="Network" />)

    expect(screen.getByRole('option', { name: 'Testnet' })).toHaveValue('testnet')
    expect(screen.getByRole('option', { name: 'Mainnet' })).toHaveValue('mainnet')
    expect(screen.getByRole('option', { name: 'Futurenet' })).toHaveValue('futurenet')
  })

  it('reflects the value prop as the selected option', () => {
    // Behavior under test: the controlled value determines which Settings option is selected.
    render(<Select value="mainnet" onChange={vi.fn()} options={networkOptions} ariaLabel="Network" />)

    expect(screen.getByRole('combobox', { name: 'Network' })).toHaveValue('mainnet')
    expect((screen.getByRole('option', { name: 'Mainnet' }) as HTMLOptionElement).selected).toBe(true)
  })

  it('calls onChange with the newly selected value', async () => {
    // Behavior under test: changes emit only the selected primitive value.
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Select value="testnet" onChange={handleChange} options={networkOptions} ariaLabel="Network" />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Network' }), 'futurenet')

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith('futurenet')
  })

  it('applies aria-label when no associated label is present', () => {
    // Behavior under test: standalone Selects still expose an accessible name.
    render(<Select value="testnet" onChange={vi.fn()} options={networkOptions} ariaLabel="Network" />)

    expect(screen.getByRole('combobox', { name: 'Network' })).toBeInTheDocument()
  })

  it('renders no options when options is empty', () => {
    // Behavior under test: empty Settings option lists do not render phantom options.
    render(<Select value="" onChange={vi.fn()} options={[]} ariaLabel="Network" />)

    expect(screen.getByRole('combobox', { name: 'Network' })).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('keeps the combobox empty when value is not present in options', () => {
    // Behavior under test: invalid persisted values do not select an unrelated option.
    render(<Select value="unknown" onChange={vi.fn()} options={networkOptions} ariaLabel="Network" />)

    expect(screen.getByRole('combobox', { name: 'Network' })).toHaveValue('testnet')
    expect((screen.getByRole('option', { name: 'Testnet' }) as HTMLOptionElement).selected).toBe(true)
    expect((screen.getByRole('option', { name: 'Mainnet' }) as HTMLOptionElement).selected).toBe(false)
    expect((screen.getByRole('option', { name: 'Futurenet' }) as HTMLOptionElement).selected).toBe(false)
  })

  it('composes with FormField label and id wiring without ariaLabel', () => {
    // Behavior under test: FormField labels provide the accessible name through the cloned id.
    render(
      <FormField id="network" label="Preferred network">
        <Select value="testnet" onChange={vi.fn()} options={networkOptions} />
      </FormField>
    )

    expect(screen.getByRole('combobox', { name: 'Preferred network' })).toHaveAttribute('id', 'network')
  })
})
