import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TrustScore from './TrustScore'
import type { TrustScore as TrustScoreData } from '../api/types'

const mockConnect = vi.fn()
const mockRefetch = vi.fn()
let mockConnected = true
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
    network: 'public',
  }),
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
    mockRefetch.mockClear()
    mockSetSearchParams.mockClear()
    mockConnected = true
    mockSearchParams = new URLSearchParams()
    mockTrustScoreState = {
      data: null,
      isLoading: false,
      error: null,
    }
  })

  it('renders the tier ladder explainer and empty activity state', () => {
    render(<TrustScore />)

    expect(screen.getByRole('heading', { name: 'Trust Score' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /how trust is earned/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No recent activity' })).toBeInTheDocument()
    expect(
      screen.getByText(/New trust score events will appear here once bonds/i)
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

  it('fills the lookup input with the connected wallet address', () => {
    mockConnected = true
    render(<TrustScore />)

    fireEvent.click(screen.getByRole('button', { name: /use my address/i }))

    expect(screen.getByRole('textbox')).toHaveValue(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    )
  })

  it('hides the self-address shortcut while disconnected', () => {
    mockConnected = false
    render(<TrustScore />)

    expect(screen.queryByRole('button', { name: /use my address/i })).toBeNull()
  })
})

describe('TrustScore URL sync', () => {
  beforeEach(() => {
    mockConnect.mockClear()
    mockRefetch.mockClear()
    mockSetSearchParams.mockClear()
    mockConnected = true
    mockSearchParams = new URLSearchParams()
    mockTrustScoreState = { data: null, isLoading: false, error: null }
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
})
