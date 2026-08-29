import { useCallback, useEffect, useRef, useState } from 'react'
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
  /** Monotonically increasing counter guarding connect side-effects. */
  const connectGenRef = useRef(0)
  /** Generation of the watcher currently registered. */
  const watcherGenRef = useRef(0)

  const stopWatcher = useCallback(() => {
    watcherStopRef.current?.()
    watcherStopRef.current = null
  }, [])

  /** Read-only: fetch Freighter network without touching state. */
  const fetchNetwork = useCallback(async (): Promise<CredenceNetwork | null> => {
    return fetchFreighterNetwork()
  }, [])

  const startWatcher = useCallback(
    async (correlationId?: string) => {
      stopWatcher()
      const watcher = await createWalletWatcher(
        ({ address: nextAddress, network: nextNetwork }) => {
          setAddress((prevAddress) => {
            if (prevAddress && nextAddress && prevAddress !== nextAddress) {
              emitWalletSessionEvent('account_changed', {
                address: nextAddress,
                network: nextNetwork,
                correlationId,
                metadata: { previousAddress: prevAddress },
              })
            }
            return nextAddress
          })
          setNetwork((prevNetwork) => {
            if (prevNetwork && nextNetwork && prevNetwork !== nextNetwork) {
              emitWalletSessionEvent('network_changed', {
                address: nextAddress,
                network: nextNetwork,
                correlationId,
                metadata: { previousNetwork: prevNetwork },
              })
            }
            return nextNetwork
          })
          setError(null)
        }
      )
      watcherStopRef.current = watcher?.stop ?? null
    },
    [stopWatcher]
  )

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return

    const correlationId = generateCorrelationId('wallet-connect')
    emitWalletSessionEvent('session_connecting', {
      address: null,
      network: null,
      correlationId,
    })

    setIsConnecting(true)
    setError(null)
    setNetwork(null)
    setIsConnecting(true)

    try {
      const installed = await checkFreighterInstalled()
      if (gen !== connectGenRef.current) return
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
      if (gen !== connectGenRef.current) return
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

      // Capture address locally — do NOT commit to state yet.
      // React flushes setState calls at await boundaries; committing the
      // address early would leak partial state if this connect is superseded
      // by a newer connect or disconnect before the watcher starts.
      const connectedAddress = result.address

      const freighterNetwork = await fetchNetwork()

      if (gen !== connectGenRef.current) return
      setNetwork(freighterNetwork)

      if (
        freighterNetwork &&
        parseNetwork(_settingsNetwork) &&
        freighterNetwork !== parseNetwork(_settingsNetwork)
      ) {
        clearPersistedWalletSession()
        setAddress('')
        setError({
          code: 'network_mismatch',
          message: `Wallet is on ${freighterNetwork} network, expected ${_settingsNetwork}.`,
        })
        return
      }

      writePersistedWalletSession(result.address, freighterNetwork)
      await startWatcher()

      if (gen !== connectGenRef.current) {
        // Superseded after watcher started — stop it explicitly.
        stopWatcher()
        setNetwork(null)
        return
      }

      // All side-effects succeeded and generation is current — commit now.
      setAddress(connectedAddress)
    } catch {
      if (gen !== connectGenRef.current) return
      // Full rollback: ensure no partial state remains.
      stopWatcher()
      setAddress('')
      setNetwork(null)
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
      if (gen === connectGenRef.current) {
        setIsConnecting(false)
      }
    }
  }, [startWatcher, syncNetwork])

  const disconnect = useCallback(() => {
    // Increment generation to invalidate any in-flight connect and discard
    // stale watcher callbacks.
    connectGenRef.current++
    stopWatcher()
    clearPersistedWalletSession()
    setAddress('')
    setNetwork(null)
    setError(null)
    setIsConnecting(false)

    emitWalletSessionEvent('session_disconnected', {
      address: null,
      network: null,
      correlationId: generateCorrelationId('wallet-disconnect'),
      metadata: { previousAddress: prevAddress || null, previousNetwork: prevNetwork || null },
    })
  }, [stopWatcher, address, network])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false

    async function restoreSession() {
      const persistedSession = readPersistedWalletSession()
      if (persistedSession && persistedSession.address) {
        const storedNetwork = persistedSession.network
        if (
          storedNetwork &&
          parseNetwork(_settingsNetwork) &&
          storedNetwork !== parseNetwork(_settingsNetwork)
        ) {
          clearPersistedWalletSession()
          return
        }
      }

      const installed = await checkFreighterInstalled()
      if (!installed || cancelled) return

      const existingAddress = await fetchFreighterAddress()
      if (!existingAddress || cancelled) return

      if (persistedSession && persistedSession.address && existingAddress !== persistedSession.address) {
        clearPersistedWalletSession()
        return
      }

      if (!cancelled) {
        const restoredAddress = persistedSession?.address || existingAddress
        const restoredNetwork = persistedSession?.network ?? (await syncNetwork())

        if (
          restoredNetwork &&
          parseNetwork(_settingsNetwork) &&
          restoredNetwork !== parseNetwork(_settingsNetwork)
        ) {
          clearPersistedWalletSession()
          setAddress('')
          setNetwork(null)
          setError({
            code: 'network_mismatch',
            message: `Wallet is on ${restoredNetwork} network, expected ${_settingsNetwork}.`,
          })
          return
        }

        setAddress(restoredAddress)
        setNetwork(restoredNetwork)
        setError(null)
        writePersistedWalletSession(restoredAddress, restoredNetwork)
        await startWatcher()
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
      stopWatcher()
    }
  }, [startWatcher, stopWatcher, fetchNetwork])

  useEffect(() => {
    if (!address) return

    const handleFocus = () => {
      void fetchNetwork().then((freighterNetwork) => {
        setNetwork(freighterNetwork)
      })
    }

    window.addEventListener(DOM_EVENTS.FOCUS, handleFocus)
    return () => window.removeEventListener(DOM_EVENTS.FOCUS, handleFocus)
  }, [address, fetchNetwork])

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
