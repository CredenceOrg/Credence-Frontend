import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import WalletConnect, { WALLET_CONNECT_DEMO_ADDRESS } from './WalletConnect'
import { formatAddressForDisplay } from '../lib/stellar'

describe('WalletConnect', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders Connect wallet with an accessible name when disconnected', () => {
    render(<WalletConnect />)
    const btn = screen.getByRole('button', { name: /connect wallet/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAccessibleName(/connect wallet/i)
  })

  it('shows connecting (Button isLoading) then connected with truncated address', async () => {
    render(<WalletConnect />)
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))

    expect(screen.getByRole('button', { name: /connecting wallet/i })).toBeDisabled()

    await act(async () => {
      vi.advanceTimersByTime(900)
    })

    const friendly = formatAddressForDisplay(WALLET_CONNECT_DEMO_ADDRESS, 'friendly')
    expect(
      screen.getByRole('button', { name: new RegExp(`wallet menu for ${friendly}`, 'i') })
    ).toBeInTheDocument()
    expect(screen.getByText(friendly)).toBeInTheDocument()
  })

  it('opens the dropdown and closes on Escape with focus restore', async () => {
    render(
      <WalletConnect status="connected" address={WALLET_CONNECT_DEMO_ADDRESS} />
    )
    const trigger = screen.getByTestId('wallet-connected-trigger')
    fireEvent.click(trigger)
    expect(screen.getByRole('menu', { name: /wallet actions/i })).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(trigger)
  })

  it('exposes copy, explorer, and disconnect menu items', () => {
    render(
      <WalletConnect
        status="connected"
        address={WALLET_CONNECT_DEMO_ADDRESS}
        network="public"
      />
    )
    fireEvent.click(screen.getByTestId('wallet-connected-trigger'))

    expect(screen.getByRole('menuitem', { name: /copy address/i })).toBeInTheDocument()
    const explorer = screen.getByRole('menuitem', { name: /view on explorer/i })
    expect(explorer).toHaveAttribute(
      'href',
      `https://stellar.expert/explorer/public/account/${WALLET_CONNECT_DEMO_ADDRESS}`
    )
    expect(screen.getByRole('menuitem', { name: /disconnect/i })).toBeInTheDocument()
  })

  it('calls onDisconnect and closes the menu', () => {
    const onDisconnect = vi.fn()
    render(
      <WalletConnect
        status="connected"
        address={WALLET_CONNECT_DEMO_ADDRESS}
        onDisconnect={onDisconnect}
      />
    )
    fireEvent.click(screen.getByTestId('wallet-connected-trigger'))
    fireEvent.click(screen.getByRole('menuitem', { name: /disconnect/i }))
    expect(onDisconnect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('uses the friendly truncation rule (GABC…WXYZ)', () => {
    const friendly = formatAddressForDisplay(WALLET_CONNECT_DEMO_ADDRESS, 'friendly')
    expect(friendly).toMatch(/^G.{5}….+$/)
    expect(friendly.length).toBeLessThan(WALLET_CONNECT_DEMO_ADDRESS.length)
  })
})
