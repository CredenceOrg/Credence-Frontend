import { useState } from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import AddressInput, {
  isValidStellarAddress,
  truncateAddress,
  formatAddressForDisplay,
} from './AddressInput'
import type { AddressDisplayOption } from '../context/SettingsContext'

// Valid 56-character Stellar public key (passes CRC-16 checksum)
const VALID_KEY = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
// 56-char key with valid format but invalid CRC-16 checksum
const INVALID_CHECKSUM_KEY = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'

const ZERO_WIDTH_SPACE = '\u200B'

let mockAddressDisplay: AddressDisplayOption = 'short'

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({ addressDisplay: mockAddressDisplay }),
}))

let clipboardReadTextMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockAddressDisplay = 'short'
  clipboardReadTextMock = vi.fn()
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    configurable: true,
    value: { readText: clipboardReadTextMock },
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. Helper function boundary tests
// ─────────────────────────────────────────────────────────────────────────────
describe('AddressInput – helper functions boundaries', () => {
  describe('isValidStellarAddress', () => {
    it('returns true for valid 56-character Stellar keys', () => {
      expect(isValidStellarAddress(VALID_KEY)).toBe(true)
    })

    it('returns false for null, undefined, and empty string', () => {
      expect(isValidStellarAddress('')).toBe(false)
      expect(isValidStellarAddress(null as unknown as string)).toBe(false)
      expect(isValidStellarAddress(undefined as unknown as string)).toBe(false)
    })

    it('returns false for keys that fail CRC-16 checksum', () => {
      expect(isValidStellarAddress(INVALID_CHECKSUM_KEY)).toBe(false)
    })

    it('returns false for boundary lengths (55, 57 chars)', () => {
      expect(isValidStellarAddress(VALID_KEY.slice(0, 55))).toBe(false)
      expect(isValidStellarAddress(VALID_KEY + 'A')).toBe(false)
    })

    it('returns false for non-G prefixes', () => {
      expect(isValidStellarAddress('S' + VALID_KEY.slice(1))).toBe(false)
      expect(isValidStellarAddress('M' + VALID_KEY.slice(1))).toBe(false)
      expect(isValidStellarAddress('0' + VALID_KEY.slice(1))).toBe(false)
      expect(isValidStellarAddress('g' + VALID_KEY.slice(1))).toBe(false)
    })

    it('returns false for lowercase letters in body', () => {
      expect(isValidStellarAddress(VALID_KEY.toLowerCase())).toBe(false)
    })

    it('returns false for keys with spaces, special chars, or zero-width chars', () => {
      expect(isValidStellarAddress(` ${VALID_KEY}`)).toBe(false)
      expect(isValidStellarAddress(`${VALID_KEY} `)).toBe(false)
      expect(isValidStellarAddress(VALID_KEY + ZERO_WIDTH_SPACE)).toBe(false)
      expect(isValidStellarAddress(VALID_KEY.replace('A', '$'))).toBe(false)
    })
  })

  describe('truncateAddress', () => {
    it('returns empty string for empty / null / undefined values', () => {
      expect(truncateAddress('')).toBe('')
      expect(truncateAddress(null)).toBe('')
      expect(truncateAddress(undefined)).toBe('')
      expect(truncateAddress('   ')).toBe('')
    })

    it('leaves short addresses (<= 20 chars) untouched', () => {
      expect(truncateAddress('GABC')).toBe('GABC')
      expect(truncateAddress('12345678901234567890')).toBe('12345678901234567890')
    })

    it('middle-truncates addresses longer than 20 chars (first 12 + ... + last 8)', () => {
      expect(truncateAddress(VALID_KEY)).toBe('GBRPYHIL2CI3...7QC7OX2H')
      expect(truncateAddress('123456789012345678901')).toBe('123456789012...45678901')
    })
  })

  describe('formatAddressForDisplay', () => {
    it('formats full mode correctly', () => {
      expect(formatAddressForDisplay(VALID_KEY, 'full')).toBe(VALID_KEY)
    })

    it('formats short mode correctly', () => {
      expect(formatAddressForDisplay(VALID_KEY, 'short')).toBe('GBRPYHIL2CI3...7QC7OX2H')
    })

    it('formats friendly mode correctly with ellipsis', () => {
      expect(formatAddressForDisplay(VALID_KEY, 'friendly')).toBe('GBRPYH\u2026OX2H')
    })

    it('falls back safely for unknown modes and handles empty input', () => {
      expect(
        formatAddressForDisplay(VALID_KEY, 'unknown_mode' as unknown as AddressDisplayOption)
      ).toBe('GBRPYHIL2CI3...7QC7OX2H')
      expect(formatAddressForDisplay('', 'full')).toBe('')
      expect(formatAddressForDisplay(null, 'short')).toBe('')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Input sanitization & boundary input handling
// ─────────────────────────────────────────────────────────────────────────────
describe('AddressInput – boundary inputs and sanitization', () => {
  it('strips "stellar:" prefix automatically when typing/pasting', async () => {
    const user = userEvent.setup()
    let value = ''
    const onChange = vi.fn((v: string) => {
      value = v
    })

    const { rerender } = render(<AddressInput id="addr" value={value} onChange={onChange} />)
    const input = screen.getByRole('textbox')

    await user.click(input)
    await user.paste(`stellar:${VALID_KEY}`)

    rerender(<AddressInput id="addr" value={value} onChange={onChange} />)
    expect(onChange).toHaveBeenCalledWith(VALID_KEY)
    expect(input).toHaveValue(VALID_KEY)
  })

  it('detects and warns on suspicious zero-width / non-ASCII characters without losing data', async () => {
    const user = userEvent.setup()
    let value = ''
    const onChange = vi.fn((v: string) => {
      value = v
    })

    const { rerender } = render(<AddressInput id="addr" value={value} onChange={onChange} />)
    const input = screen.getByRole('textbox')

    await user.click(input)
    const tainted = `${VALID_KEY}${ZERO_WIDTH_SPACE}`
    await user.paste(tainted)

    rerender(<AddressInput id="addr" value={value} onChange={onChange} />)

    expect(onChange).toHaveBeenCalledWith(tainted)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/suspicious characters/i)
    // Recognized echo is suppressed when warning is present
    expect(screen.queryByText('Recognized:')).toBeNull()
  })

  it('recovers from suspicious character warning when valid value is typed', async () => {
    const user = userEvent.setup()

    function TestComponent() {
      const [val, setVal] = useState('')
      return <AddressInput id="addr" value={val} onChange={setVal} />
    }

    render(<TestComponent />)
    const input = screen.getByRole('textbox')

    await user.click(input)
    await user.paste(`stellar:${VALID_KEY}${ZERO_WIDTH_SPACE}`)
    expect(screen.getByRole('alert')).toHaveTextContent(/suspicious characters/i)

    // Clear and enter clean valid key
    await user.clear(input)
    await user.paste(VALID_KEY)
    await user.tab()

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Recognized:')).toBeInTheDocument()
  })

  it('handles extremely long input (10,000 chars) without crashing', async () => {
    const user = userEvent.setup()
    let value = ''
    const onChange = vi.fn((v: string) => {
      value = v
    })

    const longString = 'G' + 'A'.repeat(9999)
    const { rerender } = render(<AddressInput id="addr" value={value} onChange={onChange} />)
    const input = screen.getByRole('textbox')

    await user.click(input)
    await user.paste(longString)
    rerender(<AddressInput id="addr" value={value} onChange={onChange} />)

    expect(onChange).toHaveBeenCalledWith(longString)
    expect(document.querySelector('.address-input-count')).toHaveTextContent(
      '10000 / 56 characters'
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Clipboard failure, permission denial, and recovery
// ─────────────────────────────────────────────────────────────────────────────
describe('AddressInput – clipboard failures and recovery', () => {
  it('handles clipboard permission rejection gracefully and triggers onPasteError', async () => {
    const onPasteError = vi.fn()
    const error = new DOMException('Permission denied', 'NotAllowedError')
    clipboardReadTextMock.mockRejectedValue(error)

    render(<AddressInput id="addr" value="" onChange={vi.fn()} onPasteError={onPasteError} />)

    const pasteButton = screen.getByRole('button', { name: /paste address from clipboard/i })
    const input = screen.getByRole('textbox')

    await act(async () => {
      fireEvent.click(pasteButton)
    })

    expect(onPasteError).toHaveBeenCalledWith(error)
    expect(document.activeElement).toBe(input)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to read clipboard. Please paste manually.'
    )
  })

  it('clears paste failure diagnostic when user edits input manually', async () => {
    const user = userEvent.setup()
    clipboardReadTextMock.mockRejectedValue(new Error('Read failed'))

    function TestWrapper() {
      const [val, setVal] = useState('')
      return <AddressInput id="addr" value={val} onChange={setVal} />
    }

    render(<TestWrapper />)
    const pasteButton = screen.getByRole('button', { name: /paste address from clipboard/i })
    const input = screen.getByRole('textbox')

    await act(async () => {
      fireEvent.click(pasteButton)
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to read clipboard')

    // User types manually -> paste failure error clears
    await user.type(input, 'G')
    expect(screen.queryByText('Unable to read clipboard. Please paste manually.')).toBeNull()
  })

  it('sets suspicious warning when clipboard button pastes address with suspicious characters', async () => {
    clipboardReadTextMock.mockResolvedValue(`${VALID_KEY}${ZERO_WIDTH_SPACE}`)

    function TestWrapper() {
      const [val, setVal] = useState('')
      return <AddressInput id="addr" value={val} onChange={setVal} />
    }

    render(<TestWrapper />)
    const pasteButton = screen.getByRole('button', { name: /paste address from clipboard/i })

    await act(async () => {
      fireEvent.click(pasteButton)
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/suspicious characters/i)
  })

  it('does not overwrite existing value when clipboard contains empty or whitespace string', async () => {
    const onChange = vi.fn()
    const onPasteError = vi.fn()
    clipboardReadTextMock.mockResolvedValue('   \t\n  ')

    render(
      <AddressInput id="addr" value={VALID_KEY} onChange={onChange} onPasteError={onPasteError} />
    )

    const pasteButton = screen.getByRole('button', { name: /paste address from clipboard/i })

    await act(async () => {
      fireEvent.click(pasteButton)
    })

    // onChange must not be called, preserving the existing valid value
    expect(onChange).not.toHaveBeenCalled()
    expect(onPasteError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('recovers from failed paste after permission is granted on second attempt', async () => {
    const onChange = vi.fn()
    clipboardReadTextMock
      .mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
      .mockResolvedValueOnce(VALID_KEY)

    render(<AddressInput id="addr" value="" onChange={onChange} />)
    const pasteButton = screen.getByRole('button', { name: /paste address from clipboard/i })

    // First attempt fails
    await act(async () => {
      fireEvent.click(pasteButton)
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to read clipboard')

    // Second attempt succeeds
    await act(async () => {
      fireEvent.click(pasteButton)
    })
    expect(onChange).toHaveBeenCalledWith(VALID_KEY)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. External error precedence, recovery, and echo suppression
// ─────────────────────────────────────────────────────────────────────────────
describe('AddressInput – error precedence and recovery', () => {
  it('external error suppresses format error and success echo', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AddressInput
        id="addr"
        value={VALID_KEY}
        onChange={vi.fn()}
        error="Server validation: account not funded"
      />
    )

    await user.click(screen.getByRole('textbox'))
    await user.tab()

    expect(screen.getByRole('alert')).toHaveTextContent('Server validation: account not funded')
    expect(screen.queryByText('Recognized:')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()

    // External error cleared -> recovers to success state
    rerender(<AddressInput id="addr" value={VALID_KEY} onChange={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Recognized:')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Valid Stellar address')
  })

  it('distinguishes format error from checksum error', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AddressInput id="addr" value="INVALID_FORMAT" onChange={vi.fn()} />
    )

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.tab()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Stellar public keys are 56 characters starting with G'
    )

    // Change to format-valid (56 uppercase chars starting with G) but invalid checksum
    rerender(<AddressInput id="addr" value={INVALID_CHECKSUM_KEY} onChange={vi.fn()} />)
    await user.click(input)
    await user.tab()

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid address checksum')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Validation state transitions (onValidationChange)
// ─────────────────────────────────────────────────────────────────────────────
describe('AddressInput – onValidationChange callback consistency', () => {
  it('maintains deterministic validation state transitions across rapid changes', () => {
    const onValidationChange = vi.fn()
    const { rerender } = render(
      <AddressInput id="addr" value="" onChange={vi.fn()} onValidationChange={onValidationChange} />
    )

    expect(onValidationChange).toHaveBeenLastCalledWith(false)

    // Transition: empty -> partial (false)
    rerender(
      <AddressInput
        id="addr"
        value="GBRPY"
        onChange={vi.fn()}
        onValidationChange={onValidationChange}
      />
    )
    expect(onValidationChange).toHaveBeenLastCalledWith(false)

    // Transition: partial -> valid (true)
    rerender(
      <AddressInput
        id="addr"
        value={VALID_KEY}
        onChange={vi.fn()}
        onValidationChange={onValidationChange}
      />
    )
    expect(onValidationChange).toHaveBeenLastCalledWith(true)

    // Transition: valid -> invalid checksum (false)
    rerender(
      <AddressInput
        id="addr"
        value={INVALID_CHECKSUM_KEY}
        onChange={vi.fn()}
        onValidationChange={onValidationChange}
      />
    )
    expect(onValidationChange).toHaveBeenLastCalledWith(false)

    // Transition: invalid -> valid key (true)
    rerender(
      <AddressInput
        id="addr"
        value={VALID_KEY}
        onChange={vi.fn()}
        onValidationChange={onValidationChange}
      />
    )
    expect(onValidationChange).toHaveBeenLastCalledWith(true)
  })

  it('handles inline onValidationChange callback without infinite re-render loop', () => {
    let callCount = 0
    function Wrapper() {
      const [val] = useState(VALID_KEY)
      return (
        <AddressInput
          id="addr"
          value={val}
          onChange={vi.fn()}
          onValidationChange={() => {
            callCount += 1
          }}
        />
      )
    }

    render(<Wrapper />)
    expect(callCount).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Disabled state and interactive invariants
// ─────────────────────────────────────────────────────────────────────────────
describe('AddressInput – disabled state and interactive invariants', () => {
  it('disables input field and paste button when disabled prop is true', () => {
    render(<AddressInput id="addr" value={VALID_KEY} onChange={vi.fn()} disabled={true} />)

    const input = screen.getByRole('textbox')
    const pasteButton = screen.getByRole('button', { name: /paste address from clipboard/i })

    expect(input).toBeDisabled()
    expect(pasteButton).toBeDisabled()
  })

  it('prevents paste handler execution when disabled', async () => {
    const onChange = vi.fn()
    clipboardReadTextMock.mockResolvedValue(VALID_KEY)

    render(<AddressInput id="addr" value="" onChange={onChange} disabled={true} />)
    const pasteButton = screen.getByRole('button', { name: /paste address from clipboard/i })

    await act(async () => {
      fireEvent.click(pasteButton)
    })

    expect(clipboardReadTextMock).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies custom className to the wrapper element', () => {
    render(<AddressInput id="addr" value="" onChange={vi.fn()} className="custom-form-class" />)

    const wrapper = document.querySelector('.address-input-wrapper')
    expect(wrapper).toHaveClass('custom-form-class')
  })
})
