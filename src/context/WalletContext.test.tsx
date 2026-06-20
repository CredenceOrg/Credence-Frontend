import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { WalletProvider, useWallet } from './WalletContext'

function WalletConsumer() {
  const wallet = useWallet()

  return (
    <div>
      <span data-testid="connected">{String(wallet.connected)}</span>
      <span data-testid="address">{wallet.address ?? 'none'}</span>
      <button type="button" onClick={wallet.connect}>
        connect
      </button>
      <button type="button" onClick={wallet.disconnect}>
        disconnect
      </button>
    </div>
  )
}

describe('WalletProvider', () => {
  it('connects and disconnects the placeholder wallet state', async () => {
    const user = userEvent.setup()

    render(
      <WalletProvider>
        <WalletConsumer />
      </WalletProvider>
    )

    expect(screen.getByTestId('connected')).toHaveTextContent('false')
    expect(screen.getByTestId('address')).toHaveTextContent('none')

    await user.click(screen.getByRole('button', { name: 'connect' }))

    expect(screen.getByTestId('connected')).toHaveTextContent('true')
    expect(screen.getByTestId('address').textContent).toMatch(/^G[A-Z0-9]{55}$/)

    await user.click(screen.getByRole('button', { name: 'disconnect' }))

    expect(screen.getByTestId('connected')).toHaveTextContent('false')
    expect(screen.getByTestId('address')).toHaveTextContent('none')
  })
})
