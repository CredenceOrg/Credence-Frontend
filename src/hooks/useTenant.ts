import { useWallet } from '../context/WalletContext'
import type { Tenant } from '../api/types'

/**
 * Custom hook to retrieve the current active tenant context.
 * This is backed by the wallet auth context.
 *
 * @throws {Error} If there is no active wallet connection.
 */
export function useTenant(): Tenant {
  const { address, isConnected } = useWallet()

  if (!isConnected || !address) {
    throw new Error('Tenant context requires a connected wallet')
  }

  return {
    tenantId: address,
  }
}
