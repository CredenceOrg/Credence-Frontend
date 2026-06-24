import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { getNetworkLabel, type CredenceNetwork } from '../lib/networkLabels'

/**
 * Result of comparing the app's selected Stellar network to the connected wallet's network.
 *
 * `mismatch` is `true` only when both sides report a network and the normalized values differ.
 * `expected` is always the SettingsContext label for the app network.
 * `actual` is the wallet-reported label when available, or an empty string when the wallet is
 * disconnected or Freighter has not reported a network yet.
 */
export interface NetworkMismatchState {
  mismatch: boolean
  expected: string
  actual: string
}

export function compareNetworkMismatch(
  expectedNetwork: CredenceNetwork,
  actualNetwork: CredenceNetwork | null
): NetworkMismatchState {
  const expected = getNetworkLabel(expectedNetwork)
  const actual = actualNetwork ? getNetworkLabel(actualNetwork) : ''

  return {
    mismatch: Boolean(actualNetwork && actualNetwork !== expectedNetwork),
    expected,
    actual,
  }
}

/**
 * Compares the app's selected network from SettingsContext with the connected Freighter network.
 *
 * No extra side effects are performed here: the hook only reads context state and returns the
 * comparison result so callers can render banners or disable actions deterministically.
 */
export function useNetworkMismatch(): NetworkMismatchState {
  const { network: expectedNetwork } = useSettings()
  const { network: actualNetwork, isConnected } = useWallet()

  const normalizedExpected: CredenceNetwork = expectedNetwork === 'test' ? 'test' : 'public'
  const normalizedActual = isConnected ? actualNetwork : null

  return compareNetworkMismatch(normalizedExpected, normalizedActual)
}
