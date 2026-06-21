import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkFreighterInstalled,
  createWalletWatcher,
  fetchFreighterAddress,
  fetchFreighterNetwork,
  requestFreighterAccess,
  type CredenceNetwork,
} from '../lib/freighterClient'

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
  /** Active Credence network from settings (`public` or `test`). */
  network: CredenceNetwork
}

/**
 * Manages Freighter wallet connection state for the Credence dApp.
 *
 * Guards all Freighter API calls behind browser checks. Handles extension-not-installed,
 * user-rejected, and network-mismatch scenarios without throwing.
 *
 * @param settingsNetwork - Network selected in SettingsContext (`public` or `test`).
 */
export function useWallet(settingsNetwork: string): UseWalletState {
  const network: CredenceNetwork = settingsNetwork === 'test' ? 'test' : 'public'
  const [address, setAddress] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<WalletError | null>(null)
  const watcherStopRef = useRef<(() => void) | null>(null)

  const stopWatcher = useCallback(() => {
    watcherStopRef.current?.()
    watcherStopRef.current = null
  }, [])

  const startWatcher = useCallback(async () => {
    stopWatcher()
    const watcher = await createWalletWatcher(({ address: nextAddress }) => {
      setAddress(nextAddress)
      setError(null)
    })
    watcherStopRef.current = watcher?.stop ?? null
  }, [stopWatcher])

  const verifyNetwork = useCallback(
    async (): Promise<WalletError | null> => {
      const freighterNetwork = await fetchFreighterNetwork()
      if (freighterNetwork && freighterNetwork !== network) {
        return {
          code: 'network_mismatch',
          message: `Freighter is on ${freighterNetwork === 'test' ? 'Testnet' : 'Mainnet'}, but Credence is set to ${network === 'test' ? 'Testnet' : 'Mainnet'}. Update Settings or switch Freighter network.`,
        }
      }
      return null
    },
    [network],
  )

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

      const mismatch = await verifyNetwork()
      if (mismatch) {
        setError(mismatch)
        setAddress('')
        return
      }

      setAddress(result.address)
      await startWatcher()
    } catch {
      setError({
        code: 'unknown',
        message: 'Unable to connect to Freighter. Please try again.',
      })
    } finally {
      setIsConnecting(false)
    }
  }, [startWatcher, verifyNetwork])

  const disconnect = useCallback(() => {
    stopWatcher()
    setAddress('')
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

      const mismatch = await verifyNetwork()
      if (mismatch) {
        if (!cancelled) setError(mismatch)
        return
      }

      if (!cancelled) {
        setAddress(existingAddress)
        await startWatcher()
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
      stopWatcher()
    }
  }, [startWatcher, stopWatcher, verifyNetwork])

  useEffect(() => {
    if (!address) return

    void verifyNetwork().then((mismatch) => {
      if (mismatch) setError(mismatch)
    })
  }, [address, network, verifyNetwork])

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
