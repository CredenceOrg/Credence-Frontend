/**
 * NOTE: Regex gap found in AddressInput.tsx.
 * The regex /^G[A-Z0-9]{54}$/ matches 55 characters (G + 54), not 56.
 * A correct Stellar public key is 56 characters, so the regex should be /^G[A-Z0-9]{55}$/.
 * Tests below document the ACTUAL behaviour of the current regex (accepts 55-char keys).
 * Update VALID_KEY and the length-boundary tests once the source bug is fixed.
 */
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AddressInput from './AddressInput'

// The current regex /^G[A-Z0-9]{54}$/ accepts exactly 55 chars (G + 54 uppercase alphanum).
// This is one char short of the true Stellar spec (56) — see regex-gap note above.
const VALID_KEY = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN' // 55 chars

// --- isValidStellarAddress (observed via onValidationChange) ---
describe('isValidStellarAddress', () => {
  it('passes a valid key accepted by the current regex', () => {
    const onV = vi.fn()
    render(<AddressInput id="addr" value={VALID_KEY} onChange={vi.fn()} onValidationChange={onV} />)
    expect(onV).toHaveBeenCalledWith(true)
  })

  it('rejects empty string', () => {
    const onV = vi.fn()
    render(<AddressInput id="addr" value="" onChange={vi.fn()} onValidationChange={onV} />)
    expect(onV).toHaveBeenCalledWith(false)
  })

  it('rejects a key one char shorter than VALID_KEY (54 chars)', () => {
    const onV = vi.fn()
    render(<AddressInput id="addr" value={VALID_KEY.slice(0, 54)} onChange={vi.fn()} onValidationChange={onV} />)
    expect(onV).toHaveBeenCalledWith(false)
  })

  it('rejects a key one char longer than VALID_KEY (56 chars)', () => {
    const onV = vi.fn()
    render(<AddressInput id="addr" value={VALID_KEY + 'A'} onChange={vi.fn()} onValidationChange={onV} />)
    expect(onV).toHaveBeenCalledWith(false)
  })

  it('rejects lowercase characters', () => {
    const onV = vi.fn()
    render(<AddressInput id="addr" value={VALID_KEY.toLowerCase()} onChange={vi.fn()} onValidationChange={onV} />)
    expect(onV).toHaveBeenCalledWith(false)
  })

  it('rejects non-G prefix', () => {
    const onV = vi.fn()
    render(<AddressInput id="addr" value={'A' + VALID_KEY.slice(1)} onChange={vi.fn()} onValidationChange={onV} />)
    expect(onV).toHaveBeenCalledWith(false)
  })
})

// --- onValidationChange fires on typing ---
describe('onValidationChange on typing', () => {
  it('fires false for partial input then true once a valid key is provided', async () => {
    const user = userEvent.setup()
    const onV = vi.fn()
    let val = ''
    const onChange = (v: string) => { val = v }
    const { rerender } = render(
      <AddressInput id="addr" value={val} onChange={onChange} onValidationChange={onV} />,
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
    expect(code?.textContent).toBe(`${VALID_KEY.substring(0, 12)}...${VALID_KEY.substring(VALID_KEY.length - 8)}`)
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
