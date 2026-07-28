import { ReactNode } from 'react'
import { useWallet } from '../context/WalletContext'
import Banner from './Banner'

/**
 * Control visibility and interaction gating rules for wallet-dependent actions.
 *
 * Gating Strategy:
 * - When disconnected: shows a Banner prompt and renders content as "disabled-hint"
 * - When connected: renders content normally, user can interact
 *
 * Disabled vs Hidden Rules:
 * - DISABLED: Form inputs, buttons that accept user interaction
 *   → Remain in DOM, visible in reading order, focusable with aria-disabled or disabled attr
 *   → User sees they exist but cannot use without connecting
 *   → Reduces cognitive overhead: user knows what they could do
 *
 * - HIDDEN: Whole action card sections that are visually redundant
 *   → Use `hidden` attribute to remove from DOM and a11y tree
 *   → Applied only to secondary/tertiary content that duplicates the prompt
 */
export interface ConnectGateProps {
  /**
   * Content to conditionally render/gate.
   * When disconnected, this is rendered but inputs within should respect disabled rules.
   */
  children: ReactNode

  /**
   * Title for the disconnect prompt Banner.
   * Example: "Create a bond"
   */
  title: string

  /**
   * Description for the disconnect prompt Banner.
   * Example: "Connect your wallet to create and manage bonds."
   */
  description: string

  /**
   * Custom action label for the Banner CTA.
   * @default "Connect wallet"
   */
  actionLabel?: string

  /**
   * Hide the gated content entirely when disconnected.
   * Use only for secondary content that's redundant with the disconnect prompt.
   * @default false
   */
  hideWhenDisconnected?: boolean

  /**
   * Optional callback fired when the connect CTA is clicked.
   * If not provided, the global wallet context connect() is called.
   */
  onConnectClick?: () => void
}

/**
 * ConnectGate wrapper for wallet identity-gating UI sections.
 *
 * Usage:
 * ```tsx
 * <ConnectGate
 *   title="Create a bond"
 *   description="Connect your wallet to create and manage bonds."
 * >
 *   <FormField label="Amount">
 *     <AmountInput disabled={!isConnected} ... />
 *   </FormField>
 *   <Button disabled={!isConnected} ... >
 *     Create Bond
 *   </Button>
 * </ConnectGate>
 * ```
 *
 * When disconnected:
 * - Banner appears above content with title, description, and connect CTA
 * - If hideWhenDisconnected is true, content is hidden via `hidden` attribute
 * - If hideWhenDisconnected is false (default), content is visible but disabled
 *   (inputs/buttons should have disabled={!isConnected} props)
 */
export default function ConnectGate({
  children,
  title,
  description,
  actionLabel = 'Connect wallet',
  hideWhenDisconnected = false,
  onConnectClick,
}: ConnectGateProps) {
  const { isConnected, connect } = useWallet()

  const handleConnect = () => {
    if (onConnectClick) {
      onConnectClick()
    } else {
      connect()
    }
  }

  return (
    <>
      {!isConnected && (
        <Banner
          severity="warn"
          title={title}
          action={{
            label: actionLabel,
            onClick: handleConnect,
          }}
        >
          {description}
        </Banner>
      )}

      <div hidden={!isConnected && hideWhenDisconnected}>{children}</div>
    </>
  )
}
