import { useCallback, useEffect, useRef, useState } from 'react'
import { advanceIdentityEpoch } from '../api'
import { DOM_EVENTS } from '../events'
import type { CredenceNetwork } from '../lib/networkLabels'
import { emitWalletSessionEvent, generateCorrelationId } from '../lib/walletAudit'
import type {
  SignTransactionOptions,
  WalletAdapter,
  WalletSignResult,
} from '../lib/wallet/adapter'
import {
  DEFAULT_WALLET_ADAPTER_ID,
  getWalletAdapter,
  getWalletAdapters,
} from '../lib/wallet/registry'

export type WalletErrorCode = 'not_installed' | 'rejected' | 'network_mismatch' | 'unknown'

const WALLET_SESSION_STORAGE_KEY = 'credence:wallet-session'
const WALLET_ADAPTER_STORAGE_KEY = 'credence:wallet-adapter'
const WALLET_SESSION_STORAGE_VERSION = 1

export interface WalletError {
  code: WalletErrorCode
  message: string
}

export interface PersistedWalletSession {
  version: number
  address: string
  network: CredenceNetwork | null
  adapterId?: string
  updatedAt: number
}

export interface UseWalletState {
  /** Connected Stellar public key, or empty when disconnected. */
  address: string
  /** True when a wallet address is available. */
  isConnected: boolean
  /** True while a connect request is in flight. */
  isConnecting: boolean
  /** True while the initial wallet session restoration check is in progress. */
  isRestoring: boolean
  /** Last connection error, if any. */
  error: WalletError | null
  /** Request wallet access (using the selected or specified adapter) and store the returned public key. */
  connect: (adapterId?: string) => Promise<void>
  /** Clear the local wallet session. */
  disconnect: () => void
  /** Network reported by the wallet, or null when unavailable. */
  network: CredenceNetwork | null
  /** Active/selected wallet adapter id (e.g. 'freighter', 'xbull'). */
  adapterId?: string
  /** Registered wallet adapters available for selection. */
  availableAdapters?: readonly WalletAdapter[]
  /** Select the preferred wallet adapter for subsequent connect attempts. */
  selectAdapter?: (adapterId: string) => void
  /** Sign a Stellar transaction XDR using the active wallet adapter. */
  signTransaction?: (xdr: string, opts?: SignTransactionOptions) => Promise<WalletSignResult>
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

function readPersistedAdapterId(): string {
  const storage = getStorage()
  if (!storage) return DEFAULT_WALLET_ADAPTER_ID
  try {
    const raw = storage.getItem(WALLET_ADAPTER_STORAGE_KEY)
    if (raw && raw.trim()) return raw.trim()
  } catch {
    // ignore storage failures
  }
  return DEFAULT_WALLET_ADAPTER_ID
}

function writePersistedAdapterId(adapterId: string): void {
  const storage = getStorage()
  if (!storage || !adapterId.trim()) return
  try {
    storage.setItem(WALLET_ADAPTER_STORAGE_KEY, adapterId.trim())
  } catch {
    // ignore storage failures
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
        adapterId: typeof legacy.adapterId === 'string' ? legacy.adapterId : DEFAULT_WALLET_ADAPTER_ID,
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
      adapterId: typeof parsed.adapterId === 'string' ? parsed.adapterId : undefined,
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

function writePersistedWalletSession(
  address: string,
  network: CredenceNetwork | null,
  adapterId: string
): void {
  const storage = getStorage()
  if (!storage || !address.trim()) return

  try {
    const session: PersistedWalletSession = {
      version: WALLET_SESSION_STORAGE_VERSION,
      address,
      network,
      adapterId,
      updatedAt: Date.now(),
    }
    storage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify(session))
    storage.setItem(WALLET_ADAPTER_STORAGE_KEY, adapterId)
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
 * Manages Stellar wallet connection state for the Credence dApp via WalletAdapter.
 *
 * Guards all adapter calls behind browser checks. Handles extension-not-installed,
 * user-rejected, and network-mismatch scenarios without throwing.
 *
 * Emits deterministic, versioned audit events carrying the active adapter id.
 *
 * @param settingsNetwork - Network selected in SettingsContext (public or test).
 */
export function useWallet(_settingsNetwork: string): UseWalletState {
  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState<CredenceNetwork | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(() => typeof window !== 'undefined')
  const [error, setError] = useState<WalletError | null>(null)
  const [adapterId, setAdapterId] = useState<string>(() => readPersistedAdapterId())
  const watcherStopRef = useRef<(() => void) | null>(null)
  const connectInFlightRef = useRef(false)
  const settingsNetworkRef = useRef(_settingsNetwork)
  settingsNetworkRef.current = _settingsNetwork
  const activeAdapterIdRef = useRef(adapterId)
  activeAdapterIdRef.current = adapterId
  const walletStateRef = useRef<{ address: string; network: CredenceNetwork | null }>({
    address: '',
    network: null,
  })

  const stopWatcher = useCallback(() => {
    watcherStopRef.current?.()
    watcherStopRef.current = null
  }, [])

  const selectAdapter = useCallback((nextAdapterId: string) => {
    const resolved = getWalletAdapter(nextAdapterId)
    activeAdapterIdRef.current = resolved.id
    setAdapterId(resolved.id)
    writePersistedAdapterId(resolved.id)
  }, [])

  const applyWalletState = useCallback(
    (
      next: { address: string; network: CredenceNetwork | null },
      options: { rejectMismatch?: boolean; correlationId?: string; adapterId?: string } = {}
    ) => {
      const currentAdapterId = options.adapterId ?? activeAdapterIdRef.current
      const expected = parseNetwork(settingsNetworkRef.current)
      const mismatch = Boolean(next.network && expected && next.network !== expected)
      const previous = walletStateRef.current
      const committed = mismatch && options.rejectMismatch ? { address: '', network: null } : next

      if (committed.address) {
        writePersistedWalletSession(committed.address, committed.network, currentAdapterId)
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
          adapterId: currentAdapterId,
          correlationId: options.correlationId,
          metadata: { previousAddress: previous.address },
        })
      }
      if (previous.network && committed.network && previous.network !== committed.network) {
        advanceIdentityEpoch()
        emitWalletSessionEvent('network_changed', {
          ...committed,
          adapterId: currentAdapterId,
          correlationId: options.correlationId,
          metadata: { previousNetwork: previous.network },
        })
      }
      return mismatch
    },
    []
  )

  const startWatcher = useCallback(
    async (adapter: WalletAdapter, correlationId?: string) => {
      stopWatcher()
      if (!adapter.watchChanges) return
      const watcher = await adapter.watchChanges((next) => {
        applyWalletState(next, { correlationId, adapterId: adapter.id })
      })
      watcherStopRef.current = watcher?.stop ?? null
    },
    [stopWatcher, applyWalletState]
  )

  const connect = useCallback(
    async (requestedAdapterId?: string) => {
      if (typeof window === 'undefined') return
      if (connectInFlightRef.current) return

      const adapter = getWalletAdapter(requestedAdapterId ?? activeAdapterIdRef.current)
      activeAdapterIdRef.current = adapter.id
      setAdapterId(adapter.id)
      writePersistedAdapterId(adapter.id)

      connectInFlightRef.current = true
      const correlationId = generateCorrelationId('wallet-connect')
      emitWalletSessionEvent('session_connecting', {
        address: null,
        network: null,
        adapterId: adapter.id,
        correlationId,
      })

      setIsConnecting(true)
      setError(null)

      try {
        const installed = await adapter.isInstalled()
        if (!installed) {
          const message = `${adapter.name} extension was not detected.`
          setError({
            code: 'not_installed',
            message,
          })
          emitWalletSessionEvent('session_failed', {
            address: null,
            network: null,
            adapterId: adapter.id,
            correlationId,
            metadata: { code: 'not_installed', message },
          })
          return
        }

        const result = await adapter.connect()
        if (!result.ok) {
          setError({
            code: result.code === 'rejected' ? 'rejected' : result.code,
            message: result.message,
          })
          emitWalletSessionEvent('session_failed', {
            address: null,
            network: null,
            adapterId: adapter.id,
            correlationId,
            metadata: { code: result.code, message: result.message },
          })
          return
        }

        advanceIdentityEpoch()
        const walletNetwork = await adapter.getNetwork()
        const mismatch = applyWalletState(
          { address: result.address, network: walletNetwork },
          { rejectMismatch: true, correlationId, adapterId: adapter.id }
        )
        if (mismatch) return

        emitWalletSessionEvent('session_connected', {
          address: result.address,
          network: walletNetwork,
          adapterId: adapter.id,
          correlationId,
        })
        await startWatcher(adapter, correlationId)
      } catch {
        const message = `Unable to connect to ${adapter.name}. Please try again.`
        setError({
          code: 'unknown',
          message,
        })
        emitWalletSessionEvent('session_failed', {
          address: null,
          network: null,
          adapterId: adapter.id,
          correlationId,
          metadata: { code: 'unknown', message: `Unable to connect to ${adapter.name}.` },
        })
      } finally {
        connectInFlightRef.current = false
        setIsConnecting(false)
      }
    },
    [startWatcher, applyWalletState]
  )

  const disconnect = useCallback(() => {
    const previousAddress = address
    const previousNetwork = network
    const currentAdapterId = activeAdapterIdRef.current
    stopWatcher()
    connectInFlightRef.current = false
    clearPersistedWalletSession()
    advanceIdentityEpoch()
    walletStateRef.current = { address: '', network: null }
    setAddress('')
    setNetwork(null)
    setError(null)
    setIsConnecting(false)

    void getWalletAdapter(currentAdapterId).disconnect()

    emitWalletSessionEvent('session_disconnected', {
      address: null,
      network: null,
      adapterId: currentAdapterId,
      correlationId: generateCorrelationId('wallet-disconnect'),
      metadata: { previousAddress, previousNetwork },
    })
  }, [stopWatcher, address, network])

  const signTransaction = useCallback(
    async (xdr: string, opts?: SignTransactionOptions): Promise<WalletSignResult> => {
      const adapter = getWalletAdapter(activeAdapterIdRef.current)
      return adapter.signTransaction(xdr, opts)
    },
    []
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false

    async function restoreSession() {
      // Validate/migrate storage, and use the persisted adapter id if present.
      const persisted = readPersistedWalletSession()
      const restoreAdapterId = persisted?.adapterId ?? readPersistedAdapterId()
      const adapter = getWalletAdapter(restoreAdapterId)
      activeAdapterIdRef.current = adapter.id
      setAdapterId(adapter.id)

      const installed = await adapter.isInstalled()
      if (!installed || cancelled) return

      const existingAddress = await adapter.getAddress()
      if (!existingAddress || cancelled) return

      const restoredNetwork = await adapter.getNetwork()
      if (!cancelled) {
        applyWalletState(
          { address: existingAddress, network: restoredNetwork },
          { adapterId: adapter.id }
        )
        await startWatcher(adapter)
      try {
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
      } finally {
        if (!cancelled) {
          setIsRestoring(false)
        }
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
      const adapter = getWalletAdapter(activeAdapterIdRef.current)
      try {
        const currentAddress = await adapter.getAddress()
        const currentNetwork = await adapter.getNetwork()
        if (!cancelled && walletStateRef.current === previous) {
          applyWalletState(
            { address: currentAddress ?? '', network: currentNetwork },
            { adapterId: adapter.id }
          )
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
    isRestoring,
    error,
    connect,
    disconnect,
    network,
    adapterId,
    availableAdapters: getWalletAdapters(),
    selectAdapter,
    signTransaction,
  }
}
