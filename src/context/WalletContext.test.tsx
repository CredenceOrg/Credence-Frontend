import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WalletProvider, useWalletContext } from './WalletContext'

vi.mock('../hooks/useWallet', () => ({
  useWallet: () => ({
    address: '',
    isConnected: false,
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    network: 'public',
  }),
}))

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

function WalletConsumer() {
  const wallet = useWalletContext()

  return (
    <div>
      <span data-testid="connected">{String(wallet.isConnected)}</span>
      <span data-testid="address">{wallet.address || 'none'}</span>
      <button type="button" onClick={() => void wallet.connect()}>
        connect
      </button>
      <button type="button" onClick={wallet.disconnect}>
        disconnect
      </button>
    </div>
  )
}

describe('WalletProvider', () => {
  it('exposes shared wallet state with the legacy connected alias', () => {
    render(
      <WalletProvider>
        <WalletConsumer />
      </WalletProvider>
    )

    expect(screen.getByTestId('connected')).toHaveTextContent('false')
    expect(screen.getByTestId('address')).toHaveTextContent('none')
  })
})
