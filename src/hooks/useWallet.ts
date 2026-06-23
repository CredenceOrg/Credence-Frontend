import { useCallback, useEffect, useRef, useState } from 'react'
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

/**
 * Manages Freighter wallet connection state for the Credence dApp.
 *
 * Guards all Freighter API calls behind browser checks. Handles extension-not-installed,
 * user-rejected, and network-mismatch scenarios without throwing.
 *
 * @param settingsNetwork - Network selected in SettingsContext (`public` or `test`).
 */
export function useWallet(_settingsNetwork: string): UseWalletState {
  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState<CredenceNetwork | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<WalletError | null>(null)
  const watcherStopRef = useRef<(() => void) | null>(null)

  const stopWatcher = useCallback(() => {
    watcherStopRef.current?.()
    watcherStopRef.current = null
  }, [])

  const syncNetwork = useCallback(async () => {
    const freighterNetwork = await fetchFreighterNetwork()
    setNetwork(freighterNetwork)
    return freighterNetwork
  }, [])

  const startWatcher = useCallback(async () => {
    stopWatcher()
    const watcher = await createWalletWatcher(({ address: nextAddress, network: nextNetwork }) => {
      setAddress(nextAddress)
      setNetwork(nextNetwork)
      setError(null)
    })
    watcherStopRef.current = watcher?.stop ?? null
  }, [stopWatcher])

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return

    setIsConnecting(true)
    setError(null)

    try {
      const installed = await checkFreighterInstalled()
      if (!installed) {
        setError({
          code: 'not_installed',
          message: 'Freighter extension was not detected.',
        })
        return
      }

      const result = await requestFreighterAccess()
      if (!result.ok) {
        setError({
          code: result.code === 'rejected' ? 'rejected' : result.code,
          message: result.message,
        })
        return
      }

      setAddress(result.address)
      await syncNetwork()
      await startWatcher()
    } catch {
      setError({
        code: 'unknown',
        message: 'Unable to connect to Freighter. Please try again.',
      })
    } finally {
      setIsConnecting(false)
    }
  }, [startWatcher, syncNetwork])

  const disconnect = useCallback(() => {
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

      if (!cancelled) {
        setAddress(existingAddress)
        await syncNetwork()
        await startWatcher()
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
      stopWatcher()
    }
  }, [startWatcher, stopWatcher, syncNetwork])

  useEffect(() => {
    if (!address) return

    const handleFocus = () => {
      void syncNetwork()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [address, syncNetwork])

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
