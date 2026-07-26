import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import AsyncSelect from './AsyncSelect'

describe('AsyncSelect', () => {
  it('shows loading state initially and populates options after load', async () => {
    const mockOptions = [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2' },
    ]
    const loadOptions = vi.fn().mockResolvedValue(mockOptions)
    const onChange = vi.fn()

    render(
      <AsyncSelect
        value="1"
        onChange={onChange}
        loadOptions={loadOptions}
        ariaLabel="Async Select"
      />
    )

    // Should have loading class initially
    expect(screen.getByRole('combobox')).toHaveClass('control-select', 'control-select')
    expect(screen.getByRole('combobox')).toBeDisabled()

    await waitFor(() => {
      expect(loadOptions).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByRole('combobox')).not.toBeDisabled()
    })

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('Option 1')
  })

  it('handles load errors by displaying error message', async () => {
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
      expect(screen.getByRole('combobox')).toHaveClass('control-select--error')
    })
  })
})
