import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import Button from './Button'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { formatAddressForDisplay } from '../lib/stellar'
import './WalletConnect.css'

/** Spec-only demo address — no Freighter / SDK calls (issue #832 UI/UX scope). */
export const WALLET_CONNECT_DEMO_ADDRESS =
  'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

export type WalletConnectStatus = 'disconnected' | 'connecting' | 'connected'

export interface WalletConnectProps {
  /** Controlled status. When omitted, the component owns a local demo state machine. */
  status?: WalletConnectStatus
  /** Full Stellar public key when connected. */
  address?: string
  /** Optional balance hint shown in the connected pill (desktop). */
  balanceHint?: string
  /** Network used for the explorer link (`public` | `test`). Defaults to `public`. */
  network?: 'public' | 'test'
  /** Called when the user activates Connect (disconnected → connecting). */
  onConnect?: () => void
  /** Called when the user chooses Disconnect. */
  onDisconnect?: () => void
  className?: string
}

function explorerAccountUrl(network: 'public' | 'test', address: string): string {
  const path = network === 'test' ? 'testnet' : 'public'
  return `https://stellar.expert/explorer/${path}/account/${encodeURIComponent(address)}`
}

/** Deterministic pastel hue from an address — jazzicon stand-in without new deps. */
function avatarHue(address: string): number {
  let hash = 0
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0
  }
  return hash % 360
}

/**
 * Header wallet entry point — disconnected / connecting / connected UI.
 *
 * UI/UX spec only: does not call Freighter. Local demo state simulates a
 * connect round-trip so designers and QA can exercise every state.
 *
 * @see docs/wallet-connect-header.md
 */
export default function WalletConnect({
  status: controlledStatus,
  address: controlledAddress,
  balanceHint = '128.4 XLM',
  network = 'public',
  onConnect,
  onDisconnect,
  className = '',
}: WalletConnectProps) {
  const isControlled = controlledStatus !== undefined
  const [internalStatus, setInternalStatus] = useState<WalletConnectStatus>('disconnected')
  const [internalAddress, setInternalAddress] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [liveMessage, setLiveMessage] = useState('')

  const status = isControlled ? controlledStatus! : internalStatus
  const address = isControlled ? (controlledAddress ?? '') : internalAddress

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const { copy, copied } = useCopyToClipboard({ timeoutMs: 2000 })

  const truncated = formatAddressForDisplay(address, 'friendly')
  const hue = address ? avatarHue(address) : 200

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const handleConnect = useCallback(() => {
    onConnect?.()
    if (isControlled) return

    setInternalStatus('connecting')
    setLiveMessage('Connecting wallet')
    window.setTimeout(() => {
      setInternalAddress(WALLET_CONNECT_DEMO_ADDRESS)
      setInternalStatus('connected')
      setLiveMessage('Wallet connected')
    }, 900)
  }, [isControlled, onConnect])

  const handleDisconnect = useCallback(() => {
    onDisconnect?.()
    closeMenu()
    if (!isControlled) {
      setInternalAddress('')
      setInternalStatus('disconnected')
    }
    setLiveMessage('Wallet disconnected')
    queueMicrotask(() => triggerRef.current?.focus())
  }, [closeMenu, isControlled, onDisconnect])

  const handleCopy = useCallback(async () => {
    if (!address) return
    const ok = await copy(address)
    setLiveMessage(ok ? 'Address copied to clipboard' : 'Unable to copy address')
  }, [address, copy])

  // Outside click
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen, closeMenu])

  // Escape closes menu and returns focus to the trigger
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu()
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, closeMenu])

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')
    if (!items || items.length === 0) return
    const list = Array.from(items)
    const index = list.indexOf(document.activeElement as HTMLElement)

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = list[(index + 1 + list.length) % list.length]
      next.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const prev = list[(index - 1 + list.length) % list.length]
      prev.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      list[0].focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      list[list.length - 1].focus()
    }
  }

  if (status === 'disconnected' || status === 'connecting') {
    return (
      <div className={`walletConnect ${className}`.trim()} data-state={status}>
        <Button
          ref={triggerRef}
          variant="primary"
          size="sm"
          isLoading={status === 'connecting'}
          loadingText="Connecting…"
          onClick={handleConnect}
          aria-label={
            status === 'connecting' ? 'Connecting wallet' : 'Connect wallet'
          }
          className="walletConnect__connectBtn"
          data-testid="wallet-connect-btn"
        >
          Connect wallet
        </Button>
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </span>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={`walletConnect walletConnect--connected ${className}`.trim()}
      data-state="connected"
    >
      <button
        ref={triggerRef}
        type="button"
        className="walletConnect__pill"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={`Wallet menu for ${truncated}`}
        onClick={() => setMenuOpen((open) => !open)}
        data-testid="wallet-connected-trigger"
      >
        <span
          className="walletConnect__avatar"
          aria-hidden="true"
          style={{
            background: `linear-gradient(135deg, hsl(${hue} 62% 46%), hsl(${(hue + 40) % 360} 55% 62%))`,
          }}
        />
        <span className="walletConnect__meta">
          <span className="walletConnect__address" title={address}>
            {truncated}
          </span>
          {balanceHint ? (
            <span className="walletConnect__balance">{balanceHint}</span>
          ) : null}
        </span>
        <span className="walletConnect__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {menuOpen ? (
        <div
          ref={menuRef}
          id={menuId}
          className="walletConnect__menu"
          role="menu"
          aria-label="Wallet actions"
          onKeyDown={onMenuKeyDown}
        >
          <div className="walletConnect__menuHeader" role="presentation">
            <span className="walletConnect__menuLabel">Connected</span>
            <code className="walletConnect__menuAddress" title={address}>
              {truncated}
            </code>
          </div>

          <button
            type="button"
            role="menuitem"
            className="walletConnect__menuItem"
            onClick={() => {
              void handleCopy()
            }}
          >
            {copied ? 'Copied!' : 'Copy address'}
          </button>

          <a
            role="menuitem"
            className="walletConnect__menuItem"
            href={explorerAccountUrl(network, address)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMenu}
          >
            View on explorer
          </a>

          <button
            type="button"
            role="menuitem"
            className="walletConnect__menuItem walletConnect__menuItem--danger"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      ) : null}

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </span>
    </div>
  )
}
