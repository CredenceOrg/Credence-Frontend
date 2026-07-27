import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import AsyncSelect from './AsyncSelect'

describe('AsyncSelect', () => {
  it('renders_loading_state_and_populates_options_on_success', async () => {
    const mockOptions = [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2' },
    ]
    const loadOptions = vi.fn().mockResolvedValue(mockOptions)
    const onChange = vi.fn()

    const { container } = render(
      <AsyncSelect
        value="1"
        onChange={onChange}
        loadOptions={loadOptions}
        ariaLabel="Async Select"
      />
    )

    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(container.querySelector('.control-select-wrapper')).toHaveClass('control-select-wrapper--loading')
    expect(container.querySelector('.control-select-spinner')).toBeInTheDocument()

    await waitFor(() => {
      expect(loadOptions).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByRole('combobox')).not.toBeDisabled()
    })

    expect(container.querySelector('.control-select-wrapper')).not.toHaveClass('control-select-wrapper--loading')
    expect(container.querySelector('.control-select-spinner')).not.toBeInTheDocument()

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('Option 1')
  })

  it('renders_error_state_on_load_failure', async () => {
    const loadOptions = vi.fn().mockRejectedValue(new Error('Failed to load'))
    const onChange = vi.fn()

    render(
      <AsyncSelect
        value=""
        onChange={onChange}
        loadOptions={loadOptions}
        ariaLabel="Error Select"
      />
    )

    await waitFor(() => {
      expect(loadOptions).toHaveBeenCalled()
    })

    await waitFor(() => {
      const combobox = screen.getByRole('combobox')
      expect(combobox).toHaveClass('control-select--error')
      expect(combobox).toHaveAttribute('aria-invalid', 'true')
    })
  })

  it('renders_empty_state_when_no_options_returned', async () => {
    const loadOptions = vi.fn().mockResolvedValue([])
    const onChange = vi.fn()

    render(
      <AsyncSelect
        value=""
        onChange={onChange}
        loadOptions={loadOptions}
        ariaLabel="Empty Select"
      />
    )

    await waitFor(() => {
      expect(loadOptions).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByRole('combobox')).not.toBeDisabled()
    })

    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
