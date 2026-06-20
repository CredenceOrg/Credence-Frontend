import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TrustScore from './TrustScore'

const connectedAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const mockAddToast = vi.fn()
const mockConnect = vi.fn()

let mockConnected = true

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}))

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    connected: mockConnected,
    address: mockConnected ? connectedAddress : null,
    connect: mockConnect,
    disconnect: vi.fn(),
  }),
}))

describe('TrustScore Page', () => {
  beforeEach(() => {
    mockAddToast.mockClear()
    mockConnect.mockClear()
    mockConnected = true
  })

  it('connects the wallet instead of looking up a score while disconnected', async () => {
    const user = userEvent.setup()
    mockConnected = false

    render(<TrustScore />)

    expect(screen.getByText(/Connect a wallet to look up your own trust score/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Connect wallet to continue$/i }))

    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockAddToast).not.toHaveBeenCalled()
  })

  it('fills the connected wallet and looks up the score while connected', async () => {
    const user = userEvent.setup()

    render(<TrustScore />)

    await user.click(screen.getByRole('button', { name: /^Use connected wallet$/i }))

    const lookupButton = screen.getByRole('button', { name: /^Look up score$/i })
    await waitFor(() => expect(lookupButton).toBeEnabled())
    await user.click(lookupButton)

    expect(screen.getByRole('textbox', { name: /Stellar Address/i })).toHaveValue(connectedAddress)
    expect(mockConnect).not.toHaveBeenCalled()
    expect(mockAddToast).toHaveBeenCalledWith('success', 'Trust score retrieved.')
  })
})
