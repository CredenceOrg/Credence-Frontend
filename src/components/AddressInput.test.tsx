import { useState } from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AddressInput from './AddressInput'

// A valid 56-character Stellar public key (passes CRC-16 XMODEM checksum)
const VALID_KEY = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H' // 56 chars
// A 56-char G-prefixed uppercase alphanumeric key that fails the CRC-16 checksum
const INVALID_CHECKSUM_KEY = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'

// --- useDebouncedValue mocking ---

function mockDebouncedValue<T>(value: T, _delayMs?: number): T {
  return value
}

vi.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: mockDebouncedValue,
}))

// --- QRScannerDialog mocking ---

vi.mock('./QRScannerDialog', () => ({
  default: ({
    open,
    onScan,
    onClose,
  }: {
    open: boolean
    onScan: (value: string) => void
    onClose: () => void
  }) =>
    open ? (
      <div data-testid="qr-scanner-modal">
        <button data-testid="mock-scan" onClick={() => onScan(VALID_KEY)}>
          Mock Scan
        </button>
        <button data-testid="mock-close" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}))

// --- useSettings mocking ---
// Default mock: returns 'short' (matches previous hard-coded behaviour).
// Individual tests can override addressDisplay via mockReturnValue.

import type { AddressDisplayOption } from '@/context/SettingsContext'

let mockAddressDisplay: AddressDisplayOption = 'short'

vi.mock('@/context/SettingsContext', () => ({
  useSettings: () => ({ addressDisplay: mockAddressDisplay }),
}))

beforeEach(() => {
  mockAddressDisplay = 'short'
})

// --- Clipboard mocking helper ---

let clipboardReadTextMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  clipboardReadTextMock = vi.fn()
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    configurable: true,
    value: { readText: clipboardReadTextMock },
  })
})

// --- Validation tests ---

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

  it('shows checksum error after blur with format-valid but bad-checksum address', async () => {
    const user = userEvent.setup()
    render(<AddressInput id="addr" value={INVALID_CHECKSUM_KEY} onChange={vi.fn()} />)
    await user.click(screen.getByRole('textbox'))
    await user.tab()
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('checksum')
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
    expect(code?.textContent).toBe(
      `${VALID_KEY.substring(0, 12)}...${VALID_KEY.substring(VALID_KEY.length - 8)}`
    )
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

  it('associates success confirmation via aria-describedby without aria-invalid', async () => {
    const user = userEvent.setup()
    render(<AddressInput id="test-addr" value={VALID_KEY} onChange={vi.fn()} />)
    const input = screen.getByRole('textbox')

    await user.click(input)
    await user.tab()

    const success = screen.getByRole('status')
    expect(success).toHaveTextContent('Valid Stellar address')
    expect(input.getAttribute('aria-describedby')).toContain('test-addr-success')
    expect(input).not.toHaveAttribute('aria-invalid')
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
  it('reads clipboard, trims whitespace, and calls onChange', async () => {
    clipboardReadTextMock.mockResolvedValue(`  ${VALID_KEY}  `)
    const onChange = vi.fn()
    render(<AddressInput id="addr" value="" onChange={onChange} />)

    // Use fireEvent to click the button so userEvent doesn't intercept clipboard
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /paste address from clipboard/i }))
    })

    expect(clipboardReadTextMock).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(VALID_KEY)
  })

  it('focuses input as fallback when clipboard access throws', async () => {
    clipboardReadTextMock.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    render(<AddressInput id="addr" value="" onChange={vi.fn()} />)

    const input = screen.getByRole('textbox')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /paste address from clipboard/i }))
    })

    expect(document.activeElement).toBe(input)
  })

  it('strips stellar: prefix and warns on suspicious characters', async () => {
    const user = userEvent.setup()

    function TestComponent() {
      const [val, setVal] = useState('')
      return <AddressInput id="addr" value={val} onChange={setVal} />
    }

    render(<TestComponent />)
    const input = screen.getByRole('textbox')

    await user.click(input)
    // Paste with stellar: prefix and a suspicious non-ASCII character
    await user.paste('stellar:GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H\u200B')

    // The value should be updated without "stellar:"
    expect(input).toHaveValue('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H\u200B')

    // And it should show a warning
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/suspicious characters/i)
  })
})

// --- Echo display format (addressDisplay setting) ---
describe('echo display respects addressDisplay setting', () => {
  async function renderAndTriggerEcho(addressDisplay: AddressDisplayOption) {
    mockAddressDisplay = addressDisplay
    const user = userEvent.setup()
    render(<AddressInput id="addr" value={VALID_KEY} onChange={vi.fn()} />)
    // Trigger attempted=true via blur so the echo appears
    await user.click(screen.getByRole('textbox'))
    await user.tab()
    expect(screen.getByText('Recognized:')).toBeInTheDocument()
    const code = screen.getByText('Recognized:').closest('div')?.querySelector('code')
    return code?.textContent ?? ''
  }

  it('shows full address when addressDisplay is "full"', async () => {
    const text = await renderAndTriggerEcho('full')
    expect(text).toBe(VALID_KEY)
  })

  it('shows truncated address when addressDisplay is "short"', async () => {
    const text = await renderAndTriggerEcho('short')
    // truncateAddress: first 12 + "..." + last 8
    expect(text).toBe(
      `${VALID_KEY.substring(0, 12)}...${VALID_KEY.substring(VALID_KEY.length - 8)}`
    )
  })

  it('shows friendly address when addressDisplay is "friendly"', async () => {
    const text = await renderAndTriggerEcho('friendly')
    // formatAddressForDisplay friendly: first 6 + "…" + last 4
    expect(text).toBe(
      `${VALID_KEY.substring(0, 6)}\u2026${VALID_KEY.substring(VALID_KEY.length - 4)}`
    )
  })

  it('re-renders echo when addressDisplay setting changes', async () => {
    const user = userEvent.setup()
    mockAddressDisplay = 'full'

    const { rerender } = render(<AddressInput id="addr" value={VALID_KEY} onChange={vi.fn()} />)
    await user.click(screen.getByRole('textbox'))
    await user.tab()

    // Full mode: shows entire key
    let code = screen.getByText('Recognized:').closest('div')?.querySelector('code')
    expect(code?.textContent).toBe(VALID_KEY)

    // Switch setting to 'short' and re-render
    mockAddressDisplay = 'short'
    rerender(<AddressInput id="addr" value={VALID_KEY} onChange={vi.fn()} />)

    code = screen.getByText('Recognized:').closest('div')?.querySelector('code')
    expect(code?.textContent).toBe(
      `${VALID_KEY.substring(0, 12)}...${VALID_KEY.substring(VALID_KEY.length - 8)}`
    )
  })
})
