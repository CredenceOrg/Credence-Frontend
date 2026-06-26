/**
 * @file useUsdcBalance.ts
 * @description React hook that fetches the connected account's USDC balance from
 * the Stellar Horizon API. Auto-fetches when the wallet connects and re-fetches
 * when the address or network changes.
 *
 * @example
 * ```tsx
 * const { balance, status, error, refetch } = useUsdcBalance()
 * ```
 *
 * @see {@link ../lib/horizon.ts} for the underlying Horizon fetch.
 * @see {@link ../context/WalletContext.tsx} for wallet state.
 * @see {@link ../context/SettingsContext.tsx} for network selection.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useWallet } from '../context/WalletContext'
import { useSettings } from '../context/SettingsContext'
import { fetchUsdcBalance, HorizonError } from '../lib/horizon'
import type { CredenceNetwork } from '../lib/networkLabels'

export type UseUsdcBalanceStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface UseUsdcBalanceResult {
  /** USDC balance as a number (0 when disconnected or no trustline). */
  balance: number
  /** Current fetch status. `'idle'` when disconnected, `'loading'` while fetching, `'ready'` on success, `'error'` on failure. */
  status: UseUsdcBalanceStatus
  /** Last fetch failure, if any. `null` on success or before first fetch. */
  error: Error | null
  /** Manually re-fetch the balance. No-op when disconnected. */
  refetch: () => void
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

/**
 * Returns the connected account's USDC balance from Stellar Horizon.
 *
 * **Auto-fetches** on mount when a wallet is connected, and re-fetches whenever
 * the connected address or active network changes. Returns `{ balance: 0, status: 'idle' }`
 * when no wallet is connected.
 *
 * Race-safe: in-flight requests are aborted when `refetch` is called again, when
 * address/network changes, or on unmount.
 *
 * SSR-safe: no DOM access during render; Horizon calls are guarded by browser checks.
 */
export function useUsdcBalance(): UseUsdcBalanceResult {
  const { address, isConnected } = useWallet()
  const { network } = useSettings()

  const [balance, setBalance] = useState(0)
  const [status, setStatus] = useState<UseUsdcBalanceStatus>('idle')
  const [error, setError] = useState<Error | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const fetchIdRef = useRef(0)
  const mountedRef = useRef(true)

  const fetchBalance = useCallback(async () => {
    if (!isConnected || !address || !network) {
      setBalance(0)
      setStatus('idle')
      setError(null)
      return
    }

    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller
    const fetchId = ++fetchIdRef.current

    setStatus('loading')
    setError(null)

    try {
      const result = await fetchUsdcBalance(
        address,
        network as CredenceNetwork,
        controller.signal
      )

      if (!mountedRef.current || fetchId !== fetchIdRef.current) return

      setBalance(result)
      setStatus('ready')
    } catch (err) {
      if (!mountedRef.current || fetchId !== fetchIdRef.current || isAbortError(err)) return

      setBalance(0)
      setStatus('error')
      setError(
        err instanceof HorizonError
          ? err
          : new Error('Unexpected error while fetching USDC balance')
      )
    } finally {
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        setStatus((prev) => (prev === 'loading' ? 'error' : prev))
      }
    }
  }, [address, isConnected, network])

  const refetch = useCallback(() => {
    void fetchBalance()
  }, [fetchBalance])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    void fetchBalance()
  }, [fetchBalance])

  return {
    balance,
    status,
    error,
    refetch,
  }
}
