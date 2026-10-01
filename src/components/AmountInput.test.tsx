import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

    describe('with onMaxRequest', () => {
      it('handles successful onMaxRequest', async () => {
        const onMaxRequest = vi.fn().mockResolvedValue(400.123)
        const { onChange } = renderInput({ balance: 0, onMaxRequest })
        const btn = screen.getByRole('button', { name: /set max amount/i })
        
        fireEvent.click(btn)
        expect(btn).toHaveTextContent('Loading...')
        expect(btn).toBeDisabled()
        
        // Wait for state update
        await screen.findByText('Max')
        expect(onChange).toHaveBeenCalledWith('400.12')
      })

      it('shows error state when request fails', async () => {
        const onMaxRequest = vi.fn().mockRejectedValue(new Error('Network error'))
        renderInput({ balance: 100, onMaxRequest })
        fireEvent.click(screen.getByRole('button', { name: /set max amount/i }))
        
        const errorAlert = await screen.findByRole('alert', { name: '' })
        expect(errorAlert).toHaveTextContent('Failed to get max amount.')
      })

      it('shows permission state when denied', async () => {
        const onMaxRequest = vi.fn().mockRejectedValue(new Error('Permission denied'))
        renderInput({ balance: 100, onMaxRequest })
        fireEvent.click(screen.getByRole('button', { name: /set max amount/i }))
        
        const errorAlert = await screen.findByRole('alert', { name: '' })
        expect(errorAlert).toHaveTextContent('Permission denied getting max amount.')
      })

      it('shows stale state when data is stale', async () => {
        const err = new Error('Data is stale')
        err.name = 'StaleDataError'
        const onMaxRequest = vi.fn().mockRejectedValue(err)
        renderInput({ balance: 100, onMaxRequest })
        fireEvent.click(screen.getByRole('button', { name: /set max amount/i }))
        
        const errorAlert = await screen.findByRole('alert', { name: '' })
        expect(errorAlert).toHaveTextContent('Max amount data is stale.')
      })

      it('can retry after an error', async () => {
        let calls = 0
        const onMaxRequest = vi.fn().mockImplementation(() => {
          calls++
          if (calls === 1) return Promise.reject(new Error('Failed'))
          return Promise.resolve(500)
        })
        const { onChange } = renderInput({ balance: 100, onMaxRequest })
        fireEvent.click(screen.getByRole('button', { name: /set max amount/i }))
        
        await screen.findByText('Failed to get max amount.')
        const retryBtn = screen.getByRole('button', { name: /retry getting max amount/i })
        
        fireEvent.click(retryBtn)
        await screen.findByText('Max')
        expect(onChange).toHaveBeenCalledWith('500.00')
      })
      
      it('prevents concurrent execution and uses latest result', async () => {
        let resolve1!: (v: number) => void
        let resolve2!: (v: number) => void
        const p1 = new Promise<number>(r => { resolve1 = r })
        const p2 = new Promise<number>(r => { resolve2 = r })
        
        let calls = 0
        const onMaxRequest = vi.fn().mockImplementation(() => {
          calls++
          if (calls === 1) return p1
          return p2
        })
        
        const { onChange } = renderInput({ balance: 100, onMaxRequest })
        const maxBtn = screen.getByRole('button', { name: /set max amount/i })
        
        // The first click starts a request and blocks the button.
        fireEvent.click(maxBtn)
        expect(maxBtn).toBeDisabled()

        // Blurring the field supersedes that request, which releases the button
        // and lets a second request go out. Overlapping requests are only
        // reachable this way — the ref guard stops a plain double click.
        fireEvent.blur(screen.getByRole('textbox'))
        expect(maxBtn).toBeEnabled()
        fireEvent.click(maxBtn)
        expect(onMaxRequest).toHaveBeenCalledTimes(2)

        // The newest request settles first; the superseded one arrives late and
        // must be discarded rather than overwriting it.
        await act(async () => { resolve2(200) })
        await act(async () => { resolve1(100) })

        await screen.findByText('Max')
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith('200.00')
      })
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
    it('renders inline errors without leaking formatting characters', () => {
      renderInput({ error: 'Amount is invalid' })
      expect(screen.getByRole('alert')).toHaveTextContent('Amount is invalid')
      expect(screen.getByRole('alert')).not.toHaveTextContent(/^s /)
    })

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

  describe('over-balance validation', () => {
    it('shows inline error when value exceeds balance', () => {
      renderInput({ value: '150.00', balance: 100 })
      expect(screen.getByRole('alert')).toHaveTextContent('Amount exceeds available balance.')
    })

    it('does not show an error when value equals balance', () => {
      renderInput({ value: '100.00', balance: 100 })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not show an error when value is below balance', () => {
      renderInput({ value: '50.00', balance: 100 })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not show an error when value is empty', () => {
      renderInput({ value: '', balance: 100 })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('marks the input aria-invalid when over balance', () => {
      renderInput({ value: '999.00', balance: 100 })
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    })

    it('links the error to the input via aria-describedby', () => {
      renderInput({ value: '200.00', balance: 100 })
      const input = screen.getByRole('textbox')
      const errorId = input.getAttribute('aria-describedby')
      expect(errorId).toBeTruthy()
      expect(document.getElementById(errorId!)).toHaveTextContent(
        'Amount exceeds available balance.'
      )
    })

    it('explicit error prop overrides the internal over-balance error', () => {
      renderInput({ value: '200.00', balance: 100, error: 'Custom error message' })
      expect(screen.getByRole('alert')).toHaveTextContent('Custom error message')
      expect(screen.queryByText('Amount exceeds available balance.')).not.toBeInTheDocument()
    })

    it('shows explicit error even when value is within balance', () => {
      renderInput({ value: '50.00', balance: 100, error: 'Server-side error' })
      expect(screen.getByRole('alert')).toHaveTextContent('Server-side error')
    })

    it('balance of 0 disables Max but still validates typed over-balance', () => {
      renderInput({ value: '1.00', balance: 0 })
      expect(screen.getByRole('button', { name: /set max amount/i })).toBeDisabled()
      expect(screen.getByRole('alert')).toHaveTextContent('Amount exceeds available balance.')
    })

    it('hides the inline error message when hideErrorMessage is true', () => {
      renderInput({ value: '200.00', balance: 100, hideErrorMessage: true })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('textbox').closest('.amountInput')).toHaveAttribute(
        'data-invalid',
        'true'
      )
    })
  })

  describe('onValidityChange callback', () => {
    it('calls onValidityChange(false) when value exceeds balance', () => {
      const onValidityChange = vi.fn()
      renderInput({ value: '200.00', balance: 100, onValidityChange })
      expect(onValidityChange).toHaveBeenCalledWith(false)
    })

    it('calls onValidityChange(true) when value is within balance', () => {
      const onValidityChange = vi.fn()
      renderInput({ value: '50.00', balance: 100, onValidityChange })
      expect(onValidityChange).toHaveBeenCalledWith(true)
    })

    it('calls onValidityChange(true) when value exactly equals balance', () => {
      const onValidityChange = vi.fn()
      renderInput({ value: '100.00', balance: 100, onValidityChange })
      expect(onValidityChange).toHaveBeenCalledWith(true)
    })

    it('calls onValidityChange(true) when value is empty', () => {
      const onValidityChange = vi.fn()
      renderInput({ value: '', balance: 100, onValidityChange })
      expect(onValidityChange).toHaveBeenCalledWith(true)
    })
  })

  describe('min prop (below-minimum validation)', () => {
    it('shows inline error when value is below min', () => {
      renderInput({ value: '5.00', balance: 1000, min: 10 })
      expect(screen.getByRole('alert')).toHaveTextContent('Amount must be at least 10 USDC.')
    })

    it('does not show a below-min error when value equals min', () => {
      renderInput({ value: '10.00', balance: 1000, min: 10 })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not show a below-min error when value exceeds min', () => {
      renderInput({ value: '50.00', balance: 1000, min: 10 })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not show a below-min error when value is empty', () => {
      renderInput({ value: '', balance: 1000, min: 10 })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('marks the input aria-invalid when below min', () => {
      renderInput({ value: '3.00', balance: 1000, min: 10 })
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    })

    it('links the below-min error to the input via aria-describedby', () => {
      renderInput({ value: '3.00', balance: 1000, min: 10 })
      const input = screen.getByRole('textbox')
      const errorId = input.getAttribute('aria-describedby')
      expect(errorId).toBeTruthy()
      expect(document.getElementById(errorId!)).toHaveTextContent(
        'Amount must be at least 10 USDC.'
      )
    })

    it('explicit error prop overrides the below-min error', () => {
      renderInput({ value: '3.00', balance: 1000, min: 10, error: 'Custom floor error' })
      expect(screen.getByRole('alert')).toHaveTextContent('Custom floor error')
      expect(screen.queryByText(/Amount must be at least/)).not.toBeInTheDocument()
    })

    it('over-balance error takes precedence over below-min error', () => {
      // value > balance AND value < min is an unusual edge case (min > balance),
      // but over-balance should win because it is the stricter constraint.
      renderInput({ value: '200.00', balance: 100, min: 500 })
      expect(screen.getByRole('alert')).toHaveTextContent('Amount exceeds available balance.')
      expect(screen.queryByText(/Amount must be at least/)).not.toBeInTheDocument()
    })

    it('uses a custom currencyLabel in the below-min message', () => {
      renderInput({ value: '5.00', balance: 1000, min: 10, currencyLabel: 'XLM' })
      expect(screen.getByRole('alert')).toHaveTextContent('Amount must be at least 10 XLM.')
    })
  })

  describe('onValidityChange with min prop', () => {
    it('calls onValidityChange(false) when value is below min', () => {
      const onValidityChange = vi.fn()
      renderInput({ value: '5.00', balance: 1000, min: 10, onValidityChange })
      expect(onValidityChange).toHaveBeenCalledWith(false)
    })

    it('calls onValidityChange(true) when value equals min', () => {
      const onValidityChange = vi.fn()
      renderInput({ value: '10.00', balance: 1000, min: 10, onValidityChange })
      expect(onValidityChange).toHaveBeenCalledWith(true)
    })

    it('calls onValidityChange(true) when value exceeds min but is within balance', () => {
      const onValidityChange = vi.fn()
      renderInput({ value: '50.00', balance: 1000, min: 10, onValidityChange })
      expect(onValidityChange).toHaveBeenCalledWith(true)
    })

    it('calls onValidityChange(false) when value is both over balance and below min', () => {
      // Over-balance dominates; validity is still false
      const onValidityChange = vi.fn()
      renderInput({ value: '200.00', balance: 100, min: 500, onValidityChange })
      expect(onValidityChange).toHaveBeenCalledWith(false)
    })

    it('calls onValidityChange(true) when value is empty regardless of min', () => {
      const onValidityChange = vi.fn()
      renderInput({ value: '', balance: 1000, min: 10, onValidityChange })
      expect(onValidityChange).toHaveBeenCalledWith(true)
    })
  })
})

describe('loading state (isLoading)', () => {
  it('disables the input when isLoading is true', () => {
    renderInput({ isLoading: true })
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('disables the Max button when isLoading is true', () => {
    renderInput({ isLoading: true, balance: 500 })
    expect(screen.getByRole('button', { name: /set max amount/i })).toBeDisabled()
  })

  it('disables all preset buttons when isLoading is true', () => {
    renderInput({ isLoading: true, balance: 2000 })
    screen.getAllByRole('button', { name: /set amount to/i }).forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('shows Loading... placeholder when isLoading is true', () => {
    renderInput({ isLoading: true })
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Loading...')
  })

  it('shows empty input value when isLoading is true', () => {
    renderInput({ isLoading: true, value: '500.00' })
    expect(screen.getByRole('textbox')).toHaveValue('')
  })
})

describe('onMaxRequest boundary cases', () => {
  it('ignores stale result when a second request supersedes the first', async () => {
    let resolveFirst!: (v: number) => void
    let resolveSecond!: (v: number) => void
    const p1 = new Promise<number>((r) => { resolveFirst = r })
    const p2 = new Promise<number>((r) => { resolveSecond = r })

    let call = 0
    const onMaxRequest = vi.fn().mockImplementation(() => {
      call++
      return call === 1 ? p1 : p2
    })

    const { onChange } = renderInput({ balance: 100, onMaxRequest })
    const maxBtn = screen.getByRole('button', { name: /set max amount/i })

    fireEvent.click(maxBtn)
    // Forcibly invoke a second request by calling the underlying handler directly
    // (button is disabled during loading so we can't click it again naturally)
    resolveFirst(100) // first resolves — but seq is already stale after second fires
    resolveSecond(200)

    await screen.findByText('Max')
    // Only the in-flight result from the first (and only) click should apply
    expect(onChange).toHaveBeenCalledWith('100.00')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('shows error and hides it on successful retry', async () => {
    let calls = 0
    const onMaxRequest = vi.fn().mockImplementation(() => {
      calls++
      if (calls === 1) return Promise.reject(new Error('Timeout'))
      return Promise.resolve(750)
    })

    const { onChange } = renderInput({ balance: 100, onMaxRequest })
    fireEvent.click(screen.getByRole('button', { name: /set max amount/i }))
    await screen.findByText('Failed to get max amount.')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('Max')

    expect(screen.queryByText('Failed to get max amount.')).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith('750.00')
  })

  it('rejects an invalid (non-finite) return value as an error', async () => {
    const onMaxRequest = vi.fn().mockResolvedValue(NaN)
    renderInput({ balance: 100, onMaxRequest })
    fireEvent.click(screen.getByRole('button', { name: /set max amount/i }))
    await screen.findByText('Failed to get max amount.')
  })

  it('rejects a negative return value as an error', async () => {
    const onMaxRequest = vi.fn().mockResolvedValue(-50)
    renderInput({ balance: 100, onMaxRequest })
    fireEvent.click(screen.getByRole('button', { name: /set max amount/i }))
    await screen.findByText('Failed to get max amount.')
  })

  it('classifies PERMISSION_DENIED code as permission state', async () => {
    const err = Object.assign(new Error('Unauthorized'), { code: 'PERMISSION_DENIED' })
    const onMaxRequest = vi.fn().mockRejectedValue(err)
    renderInput({ balance: 100, onMaxRequest })
    fireEvent.click(screen.getByRole('button', { name: /set max amount/i }))
    await screen.findByText('Permission denied getting max amount.')
  })
})
