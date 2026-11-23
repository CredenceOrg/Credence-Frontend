import { useCallback, useEffect, useRef, useState } from 'react'
import { advanceIdentityEpoch } from '../api'
import { DOM_EVENTS } from '../events'
import {
  checkFreighterInstalled,
  createWalletWatcher,
  fetchFreighterAddress,
  fetchFreighterNetwork,
  requestFreighterAccess,
} from '../lib/freighterClient'
import type { CredenceNetwork } from '../lib/networkLabels'
import { emitWalletSessionEvent, generateCorrelationId } from '../lib/walletAudit'

export type WalletErrorCode = 'not_installed' | 'rejected' | 'network_mismatch' | 'unknown'

const WALLET_SESSION_STORAGE_KEY = 'credence:wallet-session'
const WALLET_SESSION_STORAGE_VERSION = 1

export interface WalletError {
  code: WalletErrorCode
  message: string
}

export interface PersistedWalletSession {
  version: number
  address: string
  network: CredenceNetwork | null
  updatedAt: number
}

export interface UseWalletState {
  /** Connected Stellar public key, or empty when disconnected. */
  address: string
  /** True when a wallet address is available. */
  isConnected: boolean
  /** True while a connect request is in flight. */
  isConnecting: boolean
  /** Last connection error, if any. */
  error: WalletError | null
  /** Request Freighter access and store the returned public key. */
  connect: () => Promise<void>
  /** Clear the local wallet session. */
  disconnect: () => void
  /** Freighter network reported by the wallet, or null when unavailable. */
  network: CredenceNetwork | null
}

function parseNetwork(s: string): CredenceNetwork | null {
  if (s === 'public' || s === 'test') return s
  return null
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function clearLegacyWalletStorage(): void {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.removeItem('credence:wallet')
    storage.removeItem('wallet')
    storage.removeItem('wallet:address')
    storage.removeItem('wallet:network')
  } catch {
    // ignore storage failures while cleaning stale keys.
  }
}

function readPersistedWalletSession(): PersistedWalletSession | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(WALLET_SESSION_STORAGE_KEY)
    if (raw === null) {
      const legacyRaw = storage.getItem('credence:wallet')
      if (!legacyRaw) return null

      const legacy = JSON.parse(legacyRaw) as Partial<PersistedWalletSession>
      if (!legacy || typeof legacy !== 'object' || typeof legacy.address !== 'string') {
        clearLegacyWalletStorage()
        return null
      }

      const migrated: PersistedWalletSession = {
        version: WALLET_SESSION_STORAGE_VERSION,
        address: legacy.address,
        network: parseNetwork(String(legacy.network ?? '')) || null,
        updatedAt: typeof legacy.updatedAt === 'number' ? legacy.updatedAt : Date.now(),
      }

      storage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify(migrated))
      clearLegacyWalletStorage()
      return migrated
    }

    const parsed = JSON.parse(raw) as Partial<PersistedWalletSession>
    if (!parsed || typeof parsed !== 'object' || typeof parsed.address !== 'string') {
      storage.removeItem(WALLET_SESSION_STORAGE_KEY)
      return null
    }

    if (parsed.version !== WALLET_SESSION_STORAGE_VERSION) {
      storage.removeItem(WALLET_SESSION_STORAGE_KEY)
      return null
    }

    return {
      version: parsed.version,
      address: parsed.address,
      network: typeof parsed.network === 'string' ? parseNetwork(parsed.network) : null,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    }
  } catch {
    try {
      storage.removeItem(WALLET_SESSION_STORAGE_KEY)
    } catch {
      // ignore storage errors while cleaning a corrupt record.
    }
    return null
  }
}

function writePersistedWalletSession(address: string, network: CredenceNetwork | null): void {
  const storage = getStorage()
  if (!storage || !address.trim()) return

  try {
    const session: PersistedWalletSession = {
      version: WALLET_SESSION_STORAGE_VERSION,
      address,
      network,
      updatedAt: Date.now(),
    }
    storage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // ignore storage failures and keep the in-memory wallet state authoritative.
  }
}

function clearPersistedWalletSession(): void {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.removeItem(WALLET_SESSION_STORAGE_KEY)
  } catch {
    // ignore storage cleanup failures.
  }
  clearLegacyWalletStorage()
}

/**
 * Manages Freighter wallet connection state for the Credence dApp.
 *
 * Guards all Freighter API calls behind browser checks. Handles extension-not-installed,
 * user-rejected, and network-mismatch scenarios without throwing.
 *
 * Emits deterministic, versioned audit events for committed lifecycle transitions.
 *
 * @param settingsNetwork - Network selected in SettingsContext (public or 	est).
 */
export function useWallet(_settingsNetwork: string): UseWalletState {
  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState<CredenceNetwork | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<WalletError | null>(null)
  const watcherStopRef = useRef<(() => void) | null>(null)
  const connectInFlightRef = useRef(false)
  const settingsNetworkRef = useRef(_settingsNetwork)
  settingsNetworkRef.current = _settingsNetwork
  const walletStateRef = useRef<{ address: string; network: CredenceNetwork | null }>({
    address: '',
    network: null,
  })

  const stopWatcher = useCallback(() => {
    watcherStopRef.current?.()
    watcherStopRef.current = null
  }, [])

  const applyWalletState = useCallback(
    (
      next: { address: string; network: CredenceNetwork | null },
      options: { rejectMismatch?: boolean; correlationId?: string } = {}
    ) => {
      const expected = parseNetwork(settingsNetworkRef.current)
      const mismatch = Boolean(next.network && expected && next.network !== expected)
      const previous = walletStateRef.current
      const committed = mismatch && options.rejectMismatch ? { address: '', network: null } : next

      if (committed.address) {
        writePersistedWalletSession(committed.address, committed.network)
      } else {
        clearPersistedWalletSession()
      }
      walletStateRef.current = committed
      setAddress(committed.address)
      setNetwork(committed.network)
      setError(
        mismatch
          ? {
              code: 'network_mismatch',
              message: `Wallet is on ${next.network} network, expected ${settingsNetworkRef.current}.`,
            }
          : null
      )

      // Persist first; subscribers must observe the same state as the audit event.
      // Keep side effects outside React state updaters, which may be replayed.
      if (previous.address && committed.address && previous.address !== committed.address) {
        advanceIdentityEpoch()
        emitWalletSessionEvent('account_changed', {
          ...committed,
          correlationId: options.correlationId,
          metadata: { previousAddress: previous.address },
        })
      }
      if (previous.network && committed.network && previous.network !== committed.network) {
        advanceIdentityEpoch()
        emitWalletSessionEvent('network_changed', {
          ...committed,
          correlationId: options.correlationId,
          metadata: { previousNetwork: previous.network },
        })
      }
      return mismatch
    },
    []
  )

  const startWatcher = useCallback(
    async (correlationId?: string) => {
      stopWatcher()
      const watcher = await createWalletWatcher((next) => {
        applyWalletState(next, { correlationId })
      })
      watcherStopRef.current = watcher?.stop ?? null
    },
    [stopWatcher, applyWalletState]
  )

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (connectInFlightRef.current) return

    connectInFlightRef.current = true
    const correlationId = generateCorrelationId('wallet-connect')
    emitWalletSessionEvent('session_connecting', {
      address: null,
      network: null,
      correlationId,
    })

    setIsConnecting(true)
    setError(null)

    try {
      const installed = await checkFreighterInstalled()
      if (!installed) {
        setError({
          code: 'not_installed',
          message: 'Freighter extension was not detected.',
        })
        emitWalletSessionEvent('session_failed', {
          address: null,
          network: null,
          correlationId,
          metadata: { code: 'not_installed', message: 'Freighter extension was not detected.' },
        })
        return
      }

      const result = await requestFreighterAccess()
      if (!result.ok) {
        setError({
          code: result.code === 'rejected' ? 'rejected' : result.code,
          message: result.message,
        })
        emitWalletSessionEvent('session_failed', {
          address: null,
          network: null,
          correlationId,
          metadata: { code: result.code, message: result.message },
        })
        return
      }

      advanceIdentityEpoch()
      const freighterNetwork = await fetchFreighterNetwork()
      const mismatch = applyWalletState(
        { address: result.address, network: freighterNetwork },
        { rejectMismatch: true, correlationId }
      )
      if (mismatch) return
      await startWatcher(correlationId)
    } catch {
      setError({
        code: 'unknown',
        message: 'Unable to connect to Freighter. Please try again.',
      })
      emitWalletSessionEvent('session_failed', {
        address: null,
        network: null,
        correlationId,
        metadata: { code: 'unknown', message: 'Unable to connect to Freighter.' },
      })
    } finally {
      connectInFlightRef.current = false
      setIsConnecting(false)
    }
  }, [startWatcher, applyWalletState])

  const disconnect = useCallback(() => {
    const previousAddress = address
    const previousNetwork = network
    stopWatcher()
    connectInFlightRef.current = false
    clearPersistedWalletSession()
    advanceIdentityEpoch()
    walletStateRef.current = { address: '', network: null }
    setAddress('')
    setNetwork(null)
    setError(null)
    setIsConnecting(false)

    emitWalletSessionEvent('session_disconnected', {
      address: null,
      network: null,
      correlationId: generateCorrelationId('wallet-disconnect'),
      metadata: { previousAddress, previousNetwork },
    })
  }, [stopWatcher, address, network])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false

    async function restoreSession() {
      // Validate/migrate storage, but Freighter's currently allowed state is authoritative.
      readPersistedWalletSession()

      const installed = await checkFreighterInstalled()
      if (!installed || cancelled) return

      const existingAddress = await fetchFreighterAddress()
      if (!existingAddress || cancelled) return

      const restoredNetwork = await fetchFreighterNetwork()
      if (!cancelled) {
        applyWalletState({ address: existingAddress, network: restoredNetwork })
        await startWatcher()
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
      stopWatcher()
    }
  }, [startWatcher, stopWatcher, applyWalletState])

  useEffect(() => {
    if (walletStateRef.current.address) applyWalletState(walletStateRef.current)
  }, [_settingsNetwork, applyWalletState])

  useEffect(() => {
    if (!address) return

    let cancelled = false
    const handleFocus = async () => {
      const previous = walletStateRef.current
      try {
        const currentAddress = await fetchFreighterAddress()
        const currentNetwork = await fetchFreighterNetwork()
        if (!cancelled && walletStateRef.current === previous) {
          applyWalletState({ address: currentAddress ?? '', network: currentNetwork })
        }
      } catch {
        // A transient extension failure must not discard the last known session.
      }
    }

    window.addEventListener(DOM_EVENTS.FOCUS, handleFocus)
    return () => {
      cancelled = true
      window.removeEventListener(DOM_EVENTS.FOCUS, handleFocus)
    }
  }, [address, applyWalletState])

  return {
    address,
    isConnected: Boolean(address),
    isConnecting,
    error,
    connect,
    disconnect,
    network,
  }
}
