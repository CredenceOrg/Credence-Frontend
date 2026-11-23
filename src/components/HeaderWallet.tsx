import { useRef, useState, useCallback } from 'react'
import { useWallet } from '../context/WalletContext'
import { useSettings } from '../context/SettingsContext'
import { useUsdcBalance } from '../hooks/useUsdcBalance'
import { formatUsdc } from '../lib/format'
import WalletConnect from './WalletConnect'
import ConnectWalletDialog from './ConnectWalletDialog'

/**
 * Container component that wires the real WalletContext and USDC balance
 * into WalletConnect's controlled-mode props.
 *
 * This replaces the bare uncontrolled <WalletConnect /> in Layout so that:
 * - Connect → opens the real Freighter dialog (via ConnectWalletDialog)
 * - Disconnect → calls WalletContext.disconnect(), ending the real session
 * - Balance → shows the actual USDC balance from Horizon, never a placeholder
 * - Network → uses the app's selected network for the explorer link
 */
export default function HeaderWallet({ className }: { className?: string }) {
  const { address, isConnected, isConnecting, disconnect } = useWallet()
  const { network } = useSettings()
  const { balance, status: balanceStatus } = useUsdcBalance()

  const [connectOpen, setConnectOpen] = useState(false)

  // The connect button rendered by WalletConnect is internal to that component.
  // We attach a ref to the wrapper element so focus can return to the trigger
  // area when the dialog closes — this is the same element the user clicked.
  const wrapperRef = useRef<HTMLDivElement>(null)

  const handleConnect = useCallback(() => {
    setConnectOpen(true)
  }, [])

  const handleDialogClose = useCallback(() => {
    setConnectOpen(false)
  }, [])

  const handleDisconnect = useCallback(() => {
    disconnect()
  }, [disconnect])

  // Derive the controlled status from the real wallet state.
  const status = isConnecting ? 'connecting' : isConnected ? 'connected' : 'disconnected'

  // Only show a balance hint when Horizon has successfully returned a value.
  // Never fall back to a placeholder number — pass undefined while loading or on error
  // so WalletConnect renders no balance text at all.
  const balanceHint = balanceStatus === 'ready' ? formatUsdc(balance) : undefined

  // WalletContext.network is CredenceNetwork ('public' | 'test' | null).
  // WalletConnect only accepts 'public' | 'test', so fall back to 'public' when null.
  const walletConnectNetwork: 'public' | 'test' = network === 'test' ? 'test' : 'public'

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      <WalletConnect
        status={status}
        address={address}
        network={walletConnectNetwork}
        balanceHint={balanceHint}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        className={className}
      />
      <ConnectWalletDialog
        open={connectOpen}
        onClose={handleDialogClose}
        returnFocusRef={wrapperRef as React.RefObject<HTMLElement>}
      />
    </div>
  )
}
