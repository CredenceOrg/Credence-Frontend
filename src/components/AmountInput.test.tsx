import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AmountInput from './AmountInput'

function renderInput(overrides: Partial<React.ComponentProps<typeof AmountInput>> = {}) {
  const onChange = vi.fn()
  const props = {
    value: '',
    onChange,
    balance: 1000,
    'aria-label': 'Amount',
    ...overrides,
  }
  const result = render(<AmountInput {...props} />)
  return { ...result, onChange }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AmountInput', () => {
  describe('rendering', () => {
    it('renders the input and currency label', () => {
      renderInput()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByText('USDC')).toBeInTheDocument()
    })

    it('renders a custom currencyLabel', () => {
      renderInput({ currencyLabel: 'XLM' })
      expect(screen.getByText('XLM')).toBeInTheDocument()
    })

    it('renders the Max button', () => {
      renderInput()
      expect(screen.getByRole('button', { name: /set max amount/i })).toBeInTheDocument()
    })

    it('renders default preset buttons', () => {
      renderInput({ balance: 2000 })
      expect(screen.getByRole('button', { name: 'Set amount to 100 USDC' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Set amount to 500 USDC' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Set amount to 1000 USDC' })).toBeInTheDocument()
    })

    it('renders custom presets', () => {
      renderInput({ balance: 5000, presets: [250, 500, 2500] })
      expect(screen.getByRole('button', { name: 'Set amount to 250 USDC' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Set amount to 2500 USDC' })).toBeInTheDocument()
    })

    it('formats the display value when unfocused', () => {
      renderInput({ value: '1234.56' })
      expect(screen.getByRole('textbox')).toHaveValue('1,234.56')
    })

    it('shows raw value while focused', async () => {
      const user = userEvent.setup()
      renderInput({ value: '1234.56' })
      const input = screen.getByRole('textbox')
      await user.click(input)
      expect(input).toHaveValue('1234.56')
    })
  })

  describe('Max button', () => {
    it('calls onChange with the balance formatted to 2dp', () => {
      const { onChange } = renderInput({ balance: 500.5 })
      fireEvent.click(screen.getByRole('button', { name: /set max amount/i }))
      expect(onChange).toHaveBeenCalledWith('500.50')
    })

    it('is disabled when balance is 0', () => {
      renderInput({ balance: 0 })
      expect(screen.getByRole('button', { name: /set max amount/i })).toBeDisabled()
    })

    it('is disabled when balance is negative', () => {
      renderInput({ balance: -10 })
      expect(screen.getByRole('button', { name: /set max amount/i })).toBeDisabled()
    })

    it('is enabled when balance is positive', () => {
      renderInput({ balance: 100 })
      expect(screen.getByRole('button', { name: /set max amount/i })).toBeEnabled()
    })
  })

  describe('preset buttons', () => {
    it('calls onChange with the preset amount formatted to 2dp', () => {
      const { onChange } = renderInput({ balance: 2000 })
      fireEvent.click(screen.getByRole('button', { name: 'Set amount to 100 USDC' }))
      expect(onChange).toHaveBeenCalledWith('100.00')
    })

    it('disables preset buttons that exceed the balance', () => {
      renderInput({ balance: 200 })
      expect(screen.getByRole('button', { name: 'Set amount to 500 USDC' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Set amount to 100 USDC' })).toBeEnabled()
    })
  })

  describe('text input', () => {
    it('calls onChange with the sanitized value on each keystroke', async () => {
      const user = userEvent.setup()
      const { onChange } = renderInput()
      await user.type(screen.getByRole('textbox'), '5')
      expect(onChange).toHaveBeenCalledWith('5')
    })

    it('normalizes value on blur when it differs from raw', () => {
      const { onChange } = renderInput({ value: '100' })
      const input = screen.getByRole('textbox')
      fireEvent.focus(input)
      fireEvent.blur(input)
      expect(onChange).toHaveBeenCalledWith('100.00')
    })

    it('does not call onChange on blur when value is already normalized', () => {
      const { onChange } = renderInput({ value: '100.00' })
      const input = screen.getByRole('textbox')
      fireEvent.focus(input)
      fireEvent.blur(input)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('error state', () => {
    it('sets data-invalid="true" when error prop is provided', () => {
      renderInput({ error: 'Amount exceeds balance' })
      const wrapper = screen.getByRole('textbox').closest('.amountInput')
      expect(wrapper).toHaveAttribute('data-invalid', 'true')
    })

    it('sets data-invalid="false" when no error', () => {
      renderInput()
      const wrapper = screen.getByRole('textbox').closest('.amountInput')
      expect(wrapper).toHaveAttribute('data-invalid', 'false')
    })

    it('sets data-invalid="true" when aria-invalid="true" is passed', () => {
      renderInput({ 'aria-invalid': 'true' })
      const wrapper = screen.getByRole('textbox').closest('.amountInput')
      expect(wrapper).toHaveAttribute('data-invalid', 'true')
    })
  })
})
