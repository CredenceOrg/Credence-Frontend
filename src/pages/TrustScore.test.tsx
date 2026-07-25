import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TrustScore from './TrustScore'
import type { TrustScore as TrustScoreData } from '../api/types'

const mockConnect = vi.fn()
const mockSetNetwork = vi.fn()
const mockRefetch = vi.fn()
let mockConnected = true
let mockAppNetwork: 'public' | 'test' = 'public'
let mockWalletNetwork: 'public' | 'test' | null = 'public'
const mocks = vi.hoisted(() => ({
  addressDisplay: 'short',
}))
let mockNetworkMismatch = {
  mismatch: false,
  expected: 'Public (Mainnet)',
  actual: '',
}
let mockTrustScoreState: {
  data: TrustScoreData | null
  isLoading: boolean
  error: { message: string; status: number } | null
} = {
  data: null,
  isLoading: false,
  error: null,
}

const mockSetSearchParams = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    isConnected: mockConnected,
    address: mockConnected ? 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' : '',
    connect: mockConnect,
    disconnect: vi.fn(),
    isConnecting: false,
    error: null,
    network: mockWalletNetwork,
  }),
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    network: mockAppNetwork,
    setNetwork: mockSetNetwork,
    addressDisplay: mocks.addressDisplay,
  }),
}))

vi.mock('../hooks/useNetworkMismatch', () => ({
  useNetworkMismatch: () => mockNetworkMismatch,
}))

vi.mock('@/lib/stellar', () => ({
  isValidStellarAddress: vi.fn((addr) => !!addr && addr.startsWith('G') && addr.length === 56),
  truncateAddress: (addr: string) => {
    if (!addr) return ''
    if (addr.length <= 20) return addr
    return `${addr.substring(0, 12)}...${addr.substring(addr.length - 8)}`
  }
}))

vi.mock('../hooks/useTrustScore', () => ({
  useTrustScore: () => ({
    ...mockTrustScoreState,
    refetch: mockRefetch,
  }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  }
})

const VALID_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'

describe('TrustScore', () => {
  beforeEach(() => {
    mockConnect.mockClear()
    mockSetNetwork.mockClear()
    mockRefetch.mockClear()
    mockSetSearchParams.mockClear()
    mockConnected = true
    mockAppNetwork = 'public'
    mockWalletNetwork = 'public'
    mocks.addressDisplay = 'short'
    mockNetworkMismatch = {
      mismatch: false,
      expected: 'Public (Mainnet)',
      actual: '',
    }
    mockSearchParams = new URLSearchParams()
    mockTrustScoreState = {
      data: null,
      isLoading: false,
      error: null,
    }
    localStorage.clear()
  })

  it('renders the tier ladder explainer and empty activity state', () => {
    render(<TrustScore />)

    expect(screen.getByRole('heading', { name: 'Trust Score' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /how trust is earned/i })).toBeInTheDocument()
    // ActivityTimeline renders its own empty state (below the fold, lazy loaded but tests render synchronously)
    expect(screen.getByRole('heading', { name: /no activity yet/i })).toBeInTheDocument()
    expect(
      screen.getByText(/Attestations and events/i)
    ).toBeInTheDocument()
  })

  it('keeps lookup disabled until the address input reports valid input', () => {
    mockConnected = true
    render(<TrustScore />)

    expect(screen.getByRole('button', { name: /look up score/i })).toBeDisabled()
  })

  it('prompts disconnected users to connect before lookup', () => {
    mockConnected = false
    render(<TrustScore />)

    expect(screen.getByRole('button', { name: /connect wallet to continue/i })).toBeInTheDocument()
  })

  it('shows a warning banner and disables lookup when the wallet network differs', () => {
    mockWalletNetwork = 'test'
    mockNetworkMismatch = {
      mismatch: true,
      expected: 'Public (Mainnet)',
      actual: 'Test (Testnet)',
    }
    render(<TrustScore />)

    expect(screen.getByRole('alert', { name: /warning banner/i })).toHaveTextContent(
      /Credence is set to Public \(Mainnet\), but Freighter is on Test \(Testnet\)/i
    )
    expect(screen.getByRole('button', { name: /look up score/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /look up score/i })).toHaveAttribute(
      'aria-describedby',
      'trust-score-network-mismatch'
    )
    expect(screen.getByRole('button', { name: /switch app to test \(testnet\)/i })).toBeInTheDocument()
  })

  it('switches the app network to the connected wallet network from the mismatch banner', async () => {
    const user = userEvent.setup()
    mockWalletNetwork = 'test'
    mockNetworkMismatch = {
      mismatch: true,
      expected: 'Public (Mainnet)',
      actual: 'Test (Testnet)',
    }
    render(<TrustScore />)

    await user.click(screen.getByRole('button', { name: /switch app to test \(testnet\)/i }))
    expect(mockSetNetwork).toHaveBeenCalledWith('test')
  })
})

describe('TrustScore URL sync', () => {
  beforeEach(() => {
    mockConnect.mockClear()
    mockSetNetwork.mockClear()
    mockRefetch.mockClear()
    mockSetSearchParams.mockClear()
    mockConnected = true
    mockAppNetwork = 'public'
    mockWalletNetwork = 'public'
    mocks.addressDisplay = 'short'
    mockNetworkMismatch = {
      mismatch: false,
      expected: 'Public (Mainnet)',
      actual: '',
    }
    mockSearchParams = new URLSearchParams()
    mockTrustScoreState = { data: null, isLoading: false, error: null }
    localStorage.clear()
  })

  it('seeds the address input from a valid ?address= param on mount', () => {
    mockSearchParams = new URLSearchParams({ address: VALID_ADDRESS })
    render(<TrustScore />)
    expect(screen.getByRole('textbox')).toHaveValue(VALID_ADDRESS)
  })

  it('does not seed the address input from an invalid ?address= param', () => {
    mockSearchParams = new URLSearchParams({ address: 'not-a-valid-stellar-address' })
    render(<TrustScore />)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('does not crash when ?address= param is absent', () => {
    render(<TrustScore />)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('enables the lookup button when seeded with a valid address', async () => {
    mockConnected = true
    mockSearchParams = new URLSearchParams({ address: VALID_ADDRESS })
    render(<TrustScore />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /look up score/i })).not.toBeDisabled()
    })
  })

  it('does not enable the lookup button when seeded with an invalid address', () => {
    mockConnected = true
    mockSearchParams = new URLSearchParams({ address: 'bad' })
    render(<TrustScore />)

    expect(screen.getByRole('button', { name: /look up score/i })).toBeDisabled()
  })

  it('commits the address to the URL with replace semantics on a successful lookup', async () => {
    mockConnected = true
    render(<TrustScore />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: VALID_ADDRESS } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /look up score/i })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: /look up score/i }))

    expect(mockSetSearchParams).toHaveBeenCalledOnce()
    const [updater, options] = mockSetSearchParams.mock.calls[0] as [
      (prev: URLSearchParams) => URLSearchParams,
      { replace: boolean },
    ]
    const result = updater(new URLSearchParams())
    expect(result.get('address')).toBe(VALID_ADDRESS)
    expect(options).toEqual({ replace: true })
  })

  it('clears the ?address= param when the address input is cleared', () => {
    mockSearchParams = new URLSearchParams({ address: VALID_ADDRESS })
    render(<TrustScore />)

    mockSetSearchParams.mockClear()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })

    expect(mockSetSearchParams).toHaveBeenCalledOnce()
    const [updater, options] = mockSetSearchParams.mock.calls[0] as [
      (prev: URLSearchParams) => URLSearchParams,
      { replace: boolean },
    ]
    const result = updater(new URLSearchParams({ address: VALID_ADDRESS }))
    expect(result.has('address')).toBe(false)
    expect(options).toEqual({ replace: true })
  })

  it('does not write to the URL on partial keystrokes — only on clear or lookup', () => {
    render(<TrustScore />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'GAAZI4' } })

    expect(mockSetSearchParams).not.toHaveBeenCalled()
  })

  it('does not loop: seeding from URL does not call setSearchParams', () => {
    mockSearchParams = new URLSearchParams({ address: VALID_ADDRESS })
    render(<TrustScore />)

    expect(mockSetSearchParams).not.toHaveBeenCalled()
  })

  describe('TrustScore Lookup History', () => {
    const ADDR1 = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
    const ADDR2 = 'GABC1234567890123456789012345678901234567890123456789012'
    const ADDR3 = 'GDEF1234567890123456789012345678901234567890123456789012'
    const ADDR4 = 'GGHI1234567890123456789012345678901234567890123456789012'
    const ADDR5 = 'GJKL1234567890123456789012345678901234567890123456789012'
    const ADDR6 = 'GMNO1234567890123456789012345678901234567890123456789012'

    it('hides the control when history is empty', () => {
      render(<TrustScore />)
      expect(screen.queryByTestId('recent-lookups')).not.toBeInTheDocument()
    })

    it('appends a validated address on successful lookup, de-duplicates and caps at 5', async () => {
      // Start with empty history
      const { rerender } = render(<TrustScore />)
      expect(screen.queryByTestId('recent-lookups')).not.toBeInTheDocument()

      // Mock success for ADDR1 lookup
      mockTrustScoreState = {
        data: { address: ADDR1, score: 85, tier: 'gold', attestations: 1, updatedAt: '2026-06-29T10:00:00Z' },
        isLoading: false,
        error: null,
      }

      // Simulate a lookup of ADDR1
      fireEvent.change(screen.getByRole('textbox'), { target: { value: ADDR1 } })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /look up score/i })).not.toBeDisabled()
      })
      fireEvent.click(screen.getByRole('button', { name: /look up score/i }))

      // Rerender so TrustScore catches the state changes and runs the hook
      rerender(<TrustScore />)

      // Recent lookups control should be visible now
      expect(screen.getByTestId('recent-lookups')).toBeInTheDocument()

      // The label of the button (short address display format is default)
      // "GAAZI4TCR3TY...VKOCCWNA" -> GAAZI4TCR3TY...VKOCCWNA
      const item1 = screen.getByRole('button', { name: /look up address GAAZI4TCR3TY\.\.\.VKOCCWNA/i })
      expect(item1).toBeInTheDocument()

      // Now lookup ADDR2
      mockTrustScoreState = {
        data: { address: ADDR2, score: 90, tier: 'platinum', attestations: 2, updatedAt: '2026-06-29T10:00:00Z' },
        isLoading: false,
        error: null,
      }
      fireEvent.change(screen.getByRole('textbox'), { target: { value: ADDR2 } })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /look up score/i })).not.toBeDisabled()
      })
      fireEvent.click(screen.getByRole('button', { name: /look up score/i }))

      rerender(<TrustScore />)

      // History should have ADDR2 at the top (most recent first)
      const buttons = screen.getAllByRole('button', { name: /look up address/i })
      expect(buttons).toHaveLength(2)
      // ADDR2: GABC12345678...456789012 -> GABC12345678...56789012
      expect(buttons[0]).toHaveTextContent('GABC12345678...56789012')
      expect(buttons[1]).toHaveTextContent('GAAZI4TCR3TY...VKOCCWNA')

      // Look up ADDR1 again (duplicate). It should move to the top rather than duplicate.
      mockTrustScoreState = {
        data: { address: ADDR1, score: 85, tier: 'gold', attestations: 1, updatedAt: '2026-06-29T10:00:00Z' },
        isLoading: false,
        error: null,
      }
      fireEvent.change(screen.getByRole('textbox'), { target: { value: ADDR1 } })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /look up score/i })).not.toBeDisabled()
      })
      fireEvent.click(screen.getByRole('button', { name: /look up score/i }))

      rerender(<TrustScore />)

      const buttonsAfterDup = screen.getAllByRole('button', { name: /look up address/i })
      expect(buttonsAfterDup).toHaveLength(2)
      expect(buttonsAfterDup[0]).toHaveTextContent('GAAZI4TCR3TY...VKOCCWNA')
      expect(buttonsAfterDup[1]).toHaveTextContent('GABC12345678...56789012')

      // Look up more addresses to test capping at 5
      const newAddresses = [ADDR3, ADDR4, ADDR5, ADDR6]
      for (const addr of newAddresses) {
        mockTrustScoreState = {
          data: { address: addr, score: 50, tier: 'bronze', attestations: 0, updatedAt: '2026-06-29T10:00:00Z' },
          isLoading: false,
          error: null,
        }
        fireEvent.change(screen.getByRole('textbox'), { target: { value: addr } })
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /look up score/i })).not.toBeDisabled()
        })
        fireEvent.click(screen.getByRole('button', { name: /look up score/i }))
        rerender(<TrustScore />)
      }

      const buttonsCapped = screen.getAllByRole('button', { name: /look up address/i })
      expect(buttonsCapped).toHaveLength(5)
      // ADDR6 should be at the top, ADDR2 should be pushed out
      expect(buttonsCapped[0]).toHaveTextContent('GMNO12345678...56789012') // ADDR6
      expect(buttonsCapped[1]).toHaveTextContent('GJKL12345678...56789012') // ADDR5
      expect(buttonsCapped[2]).toHaveTextContent('GGHI12345678...56789012') // ADDR4
      expect(buttonsCapped[3]).toHaveTextContent('GDEF12345678...56789012') // ADDR3
      expect(buttonsCapped[4]).toHaveTextContent('GAAZI4TCR3TY...VKOCCWNA') // ADDR1 (pushed from top, but still in top 5)
    })

    it('supports clearing history', async () => {
      const user = userEvent.setup()
      // Seed history in localStorage
      localStorage.setItem(
        'credence:recent-lookups',
        JSON.stringify([{ address: ADDR1, timestamp: Date.now() }])
      )

      render(<TrustScore />)
      expect(screen.getByTestId('recent-lookups')).toBeInTheDocument()

      const clearBtn = screen.getByRole('button', { name: /clear lookup history/i })
      await user.click(clearBtn)

      expect(screen.queryByTestId('recent-lookups')).not.toBeInTheDocument()
      expect(localStorage.getItem('credence:recent-lookups')).toBe('[]')
    })

    it('selecting a history item fills input, respects URL sync, and triggers lookup', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'credence:recent-lookups',
        JSON.stringify([{ address: ADDR1, timestamp: Date.now() }])
      )

      render(<TrustScore />)
      const recentBtn = screen.getByRole('button', { name: /look up address GAAZI4TCR3TY\.\.\.VKOCCWNA/i })

      mockSetSearchParams.mockClear()
      mockRefetch.mockClear()

      await user.click(recentBtn)

      // Input should be filled
      expect(screen.getByRole('textbox')).toHaveValue(ADDR1)

      // Should call refetch (since pendingLookupRef is set)
      expect(mockRefetch).toHaveBeenCalledOnce()

      // Should sync address to search params
      expect(mockSetSearchParams).toHaveBeenCalledOnce()
      const [updater] = mockSetSearchParams.mock.calls[0] as [
        (prev: URLSearchParams) => URLSearchParams,
        unknown
      ]
      const result = updater(new URLSearchParams())
      expect(result.get('address')).toBe(ADDR1)
    })

    it('respects addressDisplay settings', () => {
      // Seed history
      localStorage.setItem(
        'credence:recent-lookups',
        JSON.stringify([{ address: ADDR1, timestamp: Date.now() }])
      )

      // Test full address format
      mocks.addressDisplay = 'full'
      const { rerender } = render(<TrustScore />)
      expect(screen.getByRole('button', { name: new RegExp(`look up address ${ADDR1}`, 'i') })).toBeInTheDocument()

      // Test friendly address format (when not self address)
      mocks.addressDisplay = 'friendly'
      rerender(<TrustScore />)
      expect(screen.getByRole('button', { name: /look up address GAAZI4TCR3TY\.\.\.VKOCCWNA/i })).toBeInTheDocument()

      // Test friendly address format (when it is self address)
      // Connected wallet address in our mock is 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      const walletAddr = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      localStorage.setItem(
        'credence:recent-lookups',
        JSON.stringify([{ address: walletAddr, timestamp: Date.now() }])
      )
      rerender(<TrustScore key="self-wallet" />)
      expect(screen.getByRole('button', { name: /look up address my wallet/i })).toBeInTheDocument()
    })

    it('falls back to empty list on corrupt stored history', () => {
      // Store corrupt history
      localStorage.setItem('credence:recent-lookups', 'invalid json string here{')
      render(<TrustScore />)
      expect(screen.queryByTestId('recent-lookups')).not.toBeInTheDocument()

      // Store a valid JSON that is not an array
      localStorage.setItem('credence:recent-lookups', JSON.stringify({ notAnArray: true }))
      render(<TrustScore />)
      expect(screen.queryByTestId('recent-lookups')).not.toBeInTheDocument()
    })
  })
})
