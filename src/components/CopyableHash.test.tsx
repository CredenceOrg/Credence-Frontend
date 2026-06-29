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
      setThemeMode: vi.fn(),
      setNetwork: vi.fn(),
      setAddressDisplay: vi.fn(),
      setToastsEnabled: vi.fn(),
      setAutoDismiss: vi.fn(),
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
    
    // First 6 chars: "0x93a1", Last 4 chars: "22f4"
    expect(screen.getByText('0x93a1…22f4')).toBeInTheDocument()
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
})
