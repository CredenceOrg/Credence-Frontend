import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AddressInput from './AddressInput'
import { truncateAddress } from '@/lib/stellar'

// A valid 56-character Stellar public key
const VALID_KEY = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA' // 56 chars

// --- truncateAddress ---
describe('truncateAddress', () => {
  it('returns short addresses unchanged', () => {
    expect(truncateAddress('GABC')).toBe('GABC')
    expect(truncateAddress('G'.repeat(20))).toBe('G'.repeat(20))
  })

  it('truncates long addresses correctly', () => {
    const truncated = truncateAddress(VALID_KEY)
    expect(truncated).toBe(
      `${VALID_KEY.substring(0, 12)}...${VALID_KEY.substring(VALID_KEY.length - 8)}`
    )
  })
})

// --- isValidStellarAddress (observed via onValidationChange) ---
describe('isValidStellarAddress', () => {
  it('passes a valid 56-character key', () => {
    const onV = vi.fn()
    render(<AddressInput id="addr" value={VALID_KEY} onChange={vi.fn()} onValidationChange={onV} />)
    expect(onV).toHaveBeenCalledWith(true)
  })

  it('rejects empty string', () => {
    const onV = vi.fn()
    render(<AddressInput id="addr" value="" onChange={vi.fn()} onValidationChange={onV} />)
    expect(onV).toHaveBeenCalledWith(false)
  })

  it('rejects a key one char shorter than VALID_KEY (55 chars)', () => {
    const onV = vi.fn()
    render(
      <AddressInput
        id="addr"
        value={VALID_KEY.slice(0, 55)}
        onChange={vi.fn()}
        onValidationChange={onV}
      />
    )
    expect(onV).toHaveBeenCalledWith(false)
  })

  it('rejects a key one char longer than VALID_KEY (57 chars)', () => {
    const onV = vi.fn()
    render(
      <AddressInput id="addr" value={VALID_KEY + 'A'} onChange={vi.fn()} onValidationChange={onV} />
    )
    expect(onV).toHaveBeenCalledWith(false)
  })

  it('rejects lowercase characters', () => {
    const onV = vi.fn()
    render(
      <AddressInput
        id="addr"
        value={VALID_KEY.toLowerCase()}
        onChange={vi.fn()}
        onValidationChange={onV}
      />
    )
    expect(onV).toHaveBeenCalledWith(false)
  })

  it('rejects non-G prefix', () => {
    const onV = vi.fn()
    render(
      <AddressInput
        id="addr"
        value={'A' + VALID_KEY.slice(1)}
        onChange={vi.fn()}
        onValidationChange={onV}
      />
    )
    expect(onV).toHaveBeenCalledWith(false)
  })
})

// --- onValidationChange fires on typing ---
describe('onValidationChange on typing', () => {
  it('fires false for partial input then true once a valid key is provided', async () => {
    const user = userEvent.setup()
    const onV = vi.fn()
    let val = ''
    const onChange = (v: string) => {
      val = v
    }
    const { rerender } = render(
      <AddressInput id="addr" value={val} onChange={onChange} onValidationChange={onV} />
    )

    // Type one char — not yet valid
    await user.type(screen.getByRole('textbox'), 'G')
    rerender(<AddressInput id="addr" value={val} onChange={onChange} onValidationChange={onV} />)
    expect(onV).toHaveBeenCalledWith(false)

    // Rerender with a full valid key
    val = VALID_KEY
    onV.mockClear()
    rerender(<AddressInput id="addr" value={val} onChange={onChange} onValidationChange={onV} />)
    expect(onV).toHaveBeenCalledWith(true)
  })
})

// --- Error / Success / Echo rendering ---
describe('conditional rendering', () => {
  it('shows no error before any interaction', () => {
    render(<AddressInput id="addr" value="invalid" onChange={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows error after blur with invalid value', async () => {
    const user = userEvent.setup()
    render(<AddressInput id="addr" value="bad" onChange={vi.fn()} />)
    await user.click(screen.getByRole('textbox'))
    await user.tab()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid address')
  })

  it('does not show error when value is empty after blur', async () => {
    const user = userEvent.setup()
    render(<AddressInput id="addr" value="" onChange={vi.fn()} />)
    await user.click(screen.getByRole('textbox'))
    await user.tab()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows truncated echo and no error when valid after interaction', async () => {
    const user = userEvent.setup()
    render(<AddressInput id="addr" value={VALID_KEY} onChange={vi.fn()} />)
    // Trigger attempted=true via blur
    await user.click(screen.getByRole('textbox'))
    await user.tab()

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Recognized:')).toBeInTheDocument()
    // truncateAddress: first 12 + ... + last 8 chars
    const code = screen.getByText('Recognized:').closest('div')?.querySelector('code')
    expect(code?.textContent).toBe(truncateAddress(VALID_KEY))
  })

  it('labels a valid self address as the connected wallet without using the error region', async () => {
    const user = userEvent.setup()
    render(
      <AddressInput
        id="addr"
        value={VALID_KEY}
        selfAddress={VALID_KEY.toLowerCase()}
        onChange={vi.fn()}
      />
    )

    await user.click(screen.getByRole('textbox'))
    await user.tab()

    expect(screen.getByText('This is your connected wallet')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not label invalid or disconnected addresses as self matches', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AddressInput id="addr" value="bad" selfAddress={VALID_KEY} onChange={vi.fn()} />
    )

    await user.click(screen.getByRole('textbox'))
    await user.tab()
    expect(screen.queryByText('This is your connected wallet')).toBeNull()

    rerender(<AddressInput id="addr" value={VALID_KEY} onChange={vi.fn()} />)
    await user.click(screen.getByRole('textbox'))
    await user.tab()
    expect(screen.queryByText('This is your connected wallet')).toBeNull()
  })

  it('shows character count while there is input', () => {
    render(<AddressInput id="addr" value="GABC" onChange={vi.fn()} />)
    // Use querySelector on the specific count element to avoid matching ancestor nodes
    const countEl = document.querySelector('.address-input-count')
    expect(countEl?.textContent?.replace(/\s+/g, ' ').trim()).toBe('4 / 56 characters')
  })

  it('hides character count when input is empty', () => {
    render(<AddressInput id="addr" value="" onChange={vi.fn()} />)
    expect(document.querySelector('.address-input-count')).toBeNull()
  })
})

// --- Accessibility ---
describe('accessibility', () => {
  it('associates error with input via aria-describedby', async () => {
    const user = userEvent.setup()
    render(<AddressInput id="test-addr" value="invalid" onChange={vi.fn()} />)
    const input = screen.getByRole('textbox')

    // Blur to trigger error
    await user.click(input)
    await user.tab()

    const error = screen.getByRole('alert')
    const errorId = error.getAttribute('id')
    expect(input.getAttribute('aria-describedby')).toContain(errorId)
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('ensures no duplicate IDs', () => {
    const { container } = render(<AddressInput id="test-addr" value="" onChange={vi.fn()} />)
    const elementsWithId = container.querySelectorAll('#test-addr')
    expect(elementsWithId.length).toBe(1)
    expect(elementsWithId[0].tagName).toBe('INPUT')
  })
})

// --- Paste button ---
describe('paste button', () => {
  let readTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    readTextMock = vi.fn()
    // Use Object.defineProperty so the component's handlePaste sees our mock
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      configurable: true,
      value: { readText: readTextMock },
    })
  })

  it('reads clipboard, trims whitespace, and calls onChange', async () => {
    readTextMock.mockResolvedValue(`  ${VALID_KEY}  `)
    const onChange = vi.fn()
    render(<AddressInput id="addr" value="" onChange={onChange} />)

    // Use fireEvent to click the button so userEvent doesn't intercept clipboard
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /paste address from clipboard/i }))
    })

    expect(readTextMock).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(VALID_KEY)
  })

  it('focuses input as fallback when clipboard access throws', async () => {
    readTextMock.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    render(<AddressInput id="addr" value="" onChange={vi.fn()} />)

    const input = screen.getByRole('textbox')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /paste address from clipboard/i }))
    })

    expect(document.activeElement).toBe(input)
  })
})
