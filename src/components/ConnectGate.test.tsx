import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConnectGate from './ConnectGate'
import * as WalletContextModule from '../context/WalletContext'

vi.mock('../context/WalletContext', () => ({
  useWallet: vi.fn(),
}))

const mockConnect = vi.fn(async () => {})

function mockWalletState(isConnected: boolean) {
  vi.mocked(WalletContextModule.useWallet).mockReturnValue({
    address: isConnected ? 'GAABC123DEF456GAABC123DEF456GAABC123DEF456GAABC123DEFGHI' : '',
    isConnected,
    isConnecting: false,
    error: null,
    connect: mockConnect,
    disconnect: vi.fn(),
    network: isConnected ? 'PUBLIC' : null,
    connected: isConnected,
    lastReauthTime: null,
    reauth: vi.fn(async () => {}),
    isReauthRequired: vi.fn(() => false),
  })
}

const DEFAULT_PROPS = {
  title: 'Create a bond',
  description: 'Connect your wallet to create and manage bonds.',
}

describe('ConnectGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when disconnected', () => {
    beforeEach(() => {
      mockWalletState(false)
    })

    it('renders the banner with title, description, and default connect button', () => {
      render(
        <ConnectGate {...DEFAULT_PROPS}>
          <button disabled>Create Bond</button>
        </ConnectGate>
      )

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(DEFAULT_PROPS.title)).toBeInTheDocument()
      expect(screen.getByText(DEFAULT_PROPS.description)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeInTheDocument()
    })

    it('renders a custom actionLabel when provided', () => {
      render(
        <ConnectGate {...DEFAULT_PROPS} actionLabel="Link Stellar wallet">
          <p>Gated content</p>
        </ConnectGate>
      )

      expect(screen.getByRole('button', { name: 'Link Stellar wallet' })).toBeInTheDocument()
    })

    it('renders children visibly by default', () => {
      render(
        <ConnectGate {...DEFAULT_PROPS}>
          <p>Gated form content</p>
        </ConnectGate>
      )

      const content = screen.getByText('Gated form content')
      expect(content).toBeInTheDocument()
      expect(content.parentElement).not.toHaveAttribute('hidden')
    })

    it('hides children container when hideWhenDisconnected is true', () => {
      render(
        <ConnectGate {...DEFAULT_PROPS} hideWhenDisconnected>
          <p>Secondary gated content</p>
        </ConnectGate>
      )

      const content = screen.getByText('Secondary gated content')
      expect(content).toBeInTheDocument()
      expect(content.parentElement).toHaveAttribute('hidden')
    })

    it('calls wallet connect() when the banner connect button is clicked', () => {
      render(
        <ConnectGate {...DEFAULT_PROPS}>
          <p>Gated content</p>
        </ConnectGate>
      )

      fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))
      expect(mockConnect).toHaveBeenCalledTimes(1)
    })

    it('calls onConnectClick instead of wallet connect() when provided', () => {
      const onConnectClick = vi.fn()
      render(
        <ConnectGate {...DEFAULT_PROPS} onConnectClick={onConnectClick}>
          <p>Gated content</p>
        </ConnectGate>
      )

      fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))
      expect(onConnectClick).toHaveBeenCalledTimes(1)
      expect(mockConnect).not.toHaveBeenCalled()
    })
  })

  describe('when connected', () => {
    beforeEach(() => {
      mockWalletState(true)
    })

    it('does not render the banner and renders children visibly', () => {
      render(
        <ConnectGate {...DEFAULT_PROPS}>
          <button>Create Bond</button>
        </ConnectGate>
      )

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText(DEFAULT_PROPS.title)).not.toBeInTheDocument()
      expect(screen.queryByText(DEFAULT_PROPS.description)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Connect wallet' })).not.toBeInTheDocument()

      const childButton = screen.getByRole('button', { name: 'Create Bond' })
      expect(childButton).toBeInTheDocument()
      expect(childButton.parentElement).not.toHaveAttribute('hidden')
    })

    it('renders children visibly even when hideWhenDisconnected is true', () => {
      render(
        <ConnectGate {...DEFAULT_PROPS} hideWhenDisconnected>
          <p>Secondary gated content</p>
        </ConnectGate>
      )

      const content = screen.getByText('Secondary gated content')
      expect(content).toBeInTheDocument()
      expect(content.parentElement).not.toHaveAttribute('hidden')
    })
  })
})
