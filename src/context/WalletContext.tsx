import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

const DEMO_WALLET_ADDRESS = 'GDEMO000000000000000000000000000000000000000000000000000'

export interface WalletState {
  connected: boolean
  address: string | null
  connect: () => void
  disconnect: () => void
}

const WalletContext = createContext<WalletState | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)

  const value = useMemo<WalletState>(
    () => ({
      connected: Boolean(address),
      address,
      connect: () => setAddress(DEMO_WALLET_ADDRESS),
      disconnect: () => setAddress(null),
    }),
    [address]
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const wallet = useContext(WalletContext)

  if (!wallet) {
    throw new Error('useWallet must be used within WalletProvider')
  }

  return wallet
}
