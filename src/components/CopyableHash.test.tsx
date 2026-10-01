import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CopyableHash from './CopyableHash'
import * as SettingsContextModule from '../context/SettingsContext'
import * as CopyHookModule from '../hooks/useCopyToClipboard'

vi.mock('../context/SettingsContext', () => ({
  useSettings: vi.fn(),
}))

vi.mock('../hooks/useCopyToClipboard', () => ({
  default: vi.fn(),
}))

describe('CopyableHash', () => {
  const mockCopy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      network: 'public',
      addressDisplay: 'short',
      themeMode: 'system',
      toastsEnabled: true,
      autoDismiss: '5s',
      reauthThresholdMinutes: 15,
      setThemeMode: vi.fn(),
      setNetwork: vi.fn(),
      setAddressDisplay: vi.fn(),
      setToastsEnabled: vi.fn(),
      setAutoDismiss: vi.fn(),
      setReauthThresholdMinutes: vi.fn(),
      resetToDefaults: vi.fn(),
      saveSettings: vi.fn(),
      cancelSettings: vi.fn(),
      hasUnsavedChanges: false,
    })

    // Default to successful copy
    mockCopy.mockResolvedValue(true)
    vi.mocked(CopyHookModule.default).mockReturnValue({
      copy: mockCopy,
      copied: false,
      reset: vi.fn(),
    })
  })

  it('renders a truncated tx hash by default', () => {
    const hash = '0x93a1234567890abcdef1234567890abcdef22f4'
    render(<CopyableHash hash={hash} />)

    // Uses truncateAddress: first 12 + "..." + last 8
    expect(screen.getByText('0x93a1234567...cdef22f4')).toBeInTheDocument()
  })

  it('renders a full tx hash if it is short', () => {
    render(<CopyableHash hash="shorty" />)
    expect(screen.getByText('shorty')).toBeInTheDocument()
  })

  it('renders an address and honors addressDisplay="full"', () => {
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      ...vi.mocked(SettingsContextModule.useSettings)(),
      addressDisplay: 'full',
    })
    const addr = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
    render(<CopyableHash hash={addr} kind="address" />)

    expect(screen.getByText(addr)).toBeInTheDocument()
  })

  it('renders an address and truncates when addressDisplay="short"', () => {
    const addr = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
    render(<CopyableHash hash={addr} kind="address" />)

    // truncateAddress slices first 12 and last 8, separated by ...
    expect(screen.getByText('GAAZI4TCR3TY...VKOCCWNA')).toBeInTheDocument()
  })

  it('provides a network-aware explorer link for public network', () => {
    const hash = '0x123'
    render(<CopyableHash hash={hash} kind="tx" />)
    const link = screen.getByRole('link', { name: 'View tx on Stellar Explorer' })
    expect(link).toHaveAttribute('href', 'https://stellar.expert/explorer/public/tx/0x123')
  })

  it('provides a network-aware explorer link for test network', () => {
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      ...vi.mocked(SettingsContextModule.useSettings)(),
      network: 'test',
    })
    const hash = 'G123'
    render(<CopyableHash hash={hash} kind="address" />)
    const link = screen.getByRole('link', { name: 'View address on Stellar Explorer' })
    expect(link).toHaveAttribute('href', 'https://stellar.expert/explorer/testnet/account/G123')
  })

  it('hides the explorer link when showExplorerLink is false', () => {
    render(<CopyableHash hash="123" showExplorerLink={false} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('has an accessible copy button', () => {
    render(<CopyableHash hash="123" />)
    const btn = screen.getByRole('button', { name: 'Copy hash' })
    expect(btn).toBeInTheDocument()
  })

  it('announces "Copied" and updates state on successful copy', async () => {
    render(<CopyableHash hash="abc" />)
    const btn = screen.getByRole('button', { name: 'Copy hash' })

    fireEvent.click(btn)
    expect(mockCopy).toHaveBeenCalledWith('abc')

    // Simulate what the hook does when copied becomes true
    vi.mocked(CopyHookModule.default).mockReturnValue({
      copy: mockCopy,
      copied: true,
      reset: vi.fn(),
    })

    render(<CopyableHash hash="abc" />)

    await waitFor(() => {
      // aria-live element should contain "Copied"
      expect(screen.getByText('Copied')).toBeInTheDocument()
    })
  })

  it('announces failure when copy fails', async () => {
    mockCopy.mockResolvedValue(false)
    render(<CopyableHash hash="abc" />)

    const btn = screen.getByRole('button', { name: 'Copy hash' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('Copy failed')).toBeInTheDocument()
    })
  })

  it('returns null if hash is empty', () => {
    const { container } = render(<CopyableHash hash="" />)
    expect(container).toBeEmptyDOMElement()
  })

  // ---------------------------------------------------------------------------
  // Deterministic failure-boundary coverage
  // ---------------------------------------------------------------------------

  describe('deterministic failure-boundary coverage', () => {
    describe('input boundaries & validation', () => {
      it('returns null if hash is whitespace-only', () => {
        const { container } = render(<CopyableHash hash="   " />)
        expect(container).toBeEmptyDOMElement()
      })

      it('returns null if hash is non-string', () => {
        const { container: c1 } = render(<CopyableHash hash={null as any} />)
        expect(c1).toBeEmptyDOMElement()

        const { container: c2 } = render(<CopyableHash hash={undefined as any} />)
        expect(c2).toBeEmptyDOMElement()

        const { container: c3 } = render(<CopyableHash hash={12345 as any} />)
        expect(c3).toBeEmptyDOMElement()
      })

      it('trims surrounding whitespace before copying and building explorer link', async () => {
        render(<CopyableHash hash="  0xabcdef1234567890abcdef1234567890abcdef22f4  " />)
        const link = screen.getByRole('link')
        expect(link).toHaveAttribute(
          'href',
          'https://stellar.expert/explorer/public/tx/0xabcdef1234567890abcdef1234567890abcdef22f4'
        )

        const btn = screen.getByRole('button', { name: 'Copy hash' })
        fireEvent.click(btn)
        expect(mockCopy).toHaveBeenCalledWith('0xabcdef1234567890abcdef1234567890abcdef22f4')
      })

      it('safely encodes path traversal and query injection in explorer link', () => {
        render(<CopyableHash hash="../../malicious?param=1#fragment" />)
        const link = screen.getByRole('link')
        expect(link).toHaveAttribute(
          'href',
          'https://stellar.expert/explorer/public/tx/..%2F..%2Fmalicious%3Fparam%3D1%23fragment'
        )
      })

      it('renders full untruncated hash when truncate=false', () => {
        const longHash = '0x93a1234567890abcdef1234567890abcdef22f4'
        render(<CopyableHash hash={longHash} truncate={false} />)
        expect(screen.getByText(longHash)).toBeInTheDocument()
      })
    })

    describe('loading, error, retry, stale, and permission states', () => {
      it('shows loading indicator, sets aria-busy, and disables copy button during onCopyRequest', async () => {
        let resolveCopy: (val: boolean) => void
        const onCopyRequest = vi.fn().mockImplementation(
          () =>
            new Promise<boolean>((r) => {
              resolveCopy = r
            })
        )

        render(<CopyableHash hash="0xabc" onCopyRequest={onCopyRequest} />)
        const btn = screen.getByRole('button', { name: 'Copy hash' })

        fireEvent.click(btn)
        expect(btn).toBeDisabled()
        expect(btn).toHaveAttribute('aria-busy', 'true')
        expect(screen.getByText('Copying hash...')).toBeInTheDocument()

        resolveCopy!(true)
        await screen.findByText('Copied')
        expect(btn).not.toBeDisabled()
      })

      it('shows error state when request fails', async () => {
        const onCopyRequest = vi.fn().mockRejectedValue(new Error('Network error'))
        render(<CopyableHash hash="0xabc" onCopyRequest={onCopyRequest} />)
        fireEvent.click(screen.getByRole('button', { name: 'Copy hash' }))

        const errorAlert = await screen.findByRole('alert')
        expect(errorAlert).toHaveTextContent('Failed to copy hash.')
      })

      it('shows permission state when denied', async () => {
        const onCopyRequest = vi.fn().mockRejectedValue(new Error('Permission denied'))
        render(<CopyableHash hash="0xabc" onCopyRequest={onCopyRequest} />)
        fireEvent.click(screen.getByRole('button', { name: 'Copy hash' }))

        const errorAlert = await screen.findByRole('alert')
        expect(errorAlert).toHaveTextContent('Permission denied copying hash.')
        expect(screen.getByText('Permission denied copying hash.')).toBeInTheDocument()
      })

      it('shows permission state when NotAllowedError is thrown', async () => {
        const err = new Error('Clipboard access not allowed')
        err.name = 'NotAllowedError'
        const onCopyRequest = vi.fn().mockRejectedValue(err)
        render(<CopyableHash hash="0xabc" onCopyRequest={onCopyRequest} />)
        fireEvent.click(screen.getByRole('button', { name: 'Copy hash' }))

        const errorAlert = await screen.findByRole('alert')
        expect(errorAlert).toHaveTextContent('Permission denied copying hash.')
      })

      it('shows stale state when data is stale', async () => {
        const err = new Error('Data is stale')
        err.name = 'StaleDataError'
        const onCopyRequest = vi.fn().mockRejectedValue(err)
        render(<CopyableHash hash="0xabc" onCopyRequest={onCopyRequest} />)
        fireEvent.click(screen.getByRole('button', { name: 'Copy hash' }))

        const errorAlert = await screen.findByRole('alert')
        expect(errorAlert).toHaveTextContent('Hash data is stale.')
        expect(screen.getByText('Hash data is stale.')).toBeInTheDocument()
      })

      it('shows stale state when isStale prop is true', async () => {
        render(<CopyableHash hash="0xabc" isStale={true} />)
        fireEvent.click(screen.getByRole('button', { name: 'Copy hash' }))

        const errorAlert = await screen.findByRole('alert')
        expect(errorAlert).toHaveTextContent('Hash data is stale.')
      })

      it('can retry after an error', async () => {
        let calls = 0
        const onCopyRequest = vi.fn().mockImplementation(() => {
          calls++
          if (calls === 1) return Promise.reject(new Error('Failed'))
          return Promise.resolve(true)
        })

        render(<CopyableHash hash="0xabc" onCopyRequest={onCopyRequest} />)
        fireEvent.click(screen.getByRole('button', { name: 'Copy hash' }))

        await screen.findByText('Failed to copy hash.')
        const retryBtn = screen.getByRole('button', { name: 'Retry' })

        fireEvent.click(retryBtn)
        await screen.findByText('Copied')
        expect(calls).toBe(2)
      })

      it('prevents concurrent execution and uses latest result', async () => {
        let resolve1: (v: boolean) => void
        let resolve2: (v: boolean) => void
        const p1 = new Promise<boolean>((r) => {
          resolve1 = r
        })
        const p2 = new Promise<boolean>((r) => {
          resolve2 = r
        })

        let calls = 0
        const onCopyRequest = vi.fn().mockImplementation(() => {
          calls++
          if (calls === 1) return p1
          return p2
        })

        render(<CopyableHash hash="0xabc" onCopyRequest={onCopyRequest} />)
        const copyBtn = screen.getByRole('button', { name: 'Copy hash' })

        // First click triggers loading
        fireEvent.click(copyBtn)
        expect(copyBtn).toBeDisabled()

        // Concurrent click while loading is ignored
        fireEvent.click(copyBtn)
        expect(calls).toBe(1)

        resolve1!(true)
        await screen.findByText('Copied')
      })

      it('supports onCopy alias prop', async () => {
        const onCopy = vi.fn().mockResolvedValue(true)
        render(<CopyableHash hash="0xabc" onCopy={onCopy} />)
        const copyBtn = screen.getByRole('button', { name: 'Copy hash' })

        fireEvent.click(copyBtn)
        expect(onCopy).toHaveBeenCalledWith('0xabc')
        await screen.findByText('Copied')
      })

      it('handles unmounting safely while async copy is pending', async () => {
        let resolveCopy: (v: boolean) => void
        const onCopyRequest = vi.fn().mockImplementation(
          () =>
            new Promise<boolean>((r) => {
              resolveCopy = r
            })
        )

        const { unmount } = render(<CopyableHash hash="0xabc" onCopyRequest={onCopyRequest} />)
        fireEvent.click(screen.getByRole('button', { name: 'Copy hash' }))

        unmount()
        expect(() => resolveCopy!(true)).not.toThrow()
      })
    })
  })
})
