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

export type WalletErrorCode = 'not_installed' | 'rejected' | 'network_mismatch' | 'unknown'

export interface WalletError {
  code: WalletErrorCode
  message: string
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

/**
 * Manages Freighter wallet connection state for the Credence dApp.
 *
 * Guards all Freighter API calls behind browser checks. Handles extension-not-installed,
 * user-rejected, and network-mismatch scenarios without throwing.
 *
 * Uses a connect generation counter to ensure atomic rollback: every async
 * state update is guarded so that a superseded (stale) connect/disconnect
 * operation cannot clobber the latest committed state.
 *
 * Invariants maintained:
 * - If `connect()` succeeds, watcher is guaranteed to be active.
 * - If `connect()` fails at any point, all side-effect state (address,
 *   network, watcher) is rolled back — no partial state leaks.
 * - `disconnect()` is idempotent and always leaves a clean slate.
 * - Concurrent connect calls: only the latest generation commits.
 * - Watcher callbacks from stale generations are discarded.
 * - Transient error/network state is cleared at the start of each `connect()`
 *   so stale errors from a prior session do not linger during the new flow.
 *
 * @param settingsNetwork - Network selected in SettingsContext (`public` or `test`).
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

  const startWatcher = useCallback(async () => {
    stopWatcher()
    const gen = connectGenRef.current
    const watcher = await createWalletWatcher(({ address: nextAddress, network: nextNetwork }) => {
      // Discard events from a generation that has been superseded (e.g. by
      // disconnect or a newer connect).
      if (connectGenRef.current !== gen) return
      setAddress(nextAddress)
      setNetwork(nextNetwork)
      setError(null)
    })
    // Only commit the watcher handle if this generation is still current.
    if (connectGenRef.current !== gen) {
      watcher?.stop()
      return
    }
    watcherStopRef.current = watcher?.stop ?? null
    watcherGenRef.current = gen
  }, [stopWatcher])

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return

    const gen = ++connectGenRef.current

    // Clear transient error/network state so stale values from a prior
    // session do not linger during the new connect flow.
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
        return
      }

      const result = await requestFreighterAccess()
      if (gen !== connectGenRef.current) return
      if (!result.ok) {
        setError({
          code: result.code === 'rejected' ? 'rejected' : result.code,
          message: result.message,
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
        // Network mismatch: roll back the network we just set and
        // stop the watcher if it was started from a prior connect.
        stopWatcher()
        setNetwork(null)
        setError({
          code: 'network_mismatch',
          message: `Wallet is on ${freighterNetwork} network, expected ${_settingsNetwork}.`,
        })
        return
      }

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
    } finally {
      if (gen === connectGenRef.current) {
        setIsConnecting(false)
      }
    }
  }, [startWatcher, fetchNetwork, stopWatcher, _settingsNetwork])

  const disconnect = useCallback(() => {
    // Increment generation to invalidate any in-flight connect and discard
    // stale watcher callbacks.
    connectGenRef.current++
    stopWatcher()
    setAddress('')
    setNetwork(null)
    setError(null)
    setIsConnecting(false)
  }, [stopWatcher])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false

    async function restoreSession() {
      const installed = await checkFreighterInstalled()
      if (!installed || cancelled) return

      const existingAddress = await fetchFreighterAddress()
      if (!existingAddress || cancelled) return

      // Guard: a concurrent connect() or disconnect() may have bumped the
      // generation while we were awaiting Freighter responses. Only commit
      // if no connect/disconnect has occurred since mount (gen === 0).
      if (cancelled || connectGenRef.current !== 0) return

      setAddress(existingAddress)
      const freighterNetwork = await fetchNetwork()
      if (cancelled || connectGenRef.current !== 0) return
      setNetwork(freighterNetwork)
      await startWatcher()
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
