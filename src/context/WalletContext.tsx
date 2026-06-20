import React, { createContext, useContext } from 'react'
import { useSettings } from './SettingsContext'
import { useWallet, type UseWalletState } from '../hooks/useWallet'

const defaultWalletState: UseWalletState = {
  address: '',
  isConnected: false,
  isConnecting: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  network: 'public',
}

const WalletContext = createContext<UseWalletState>(defaultWalletState)

/** Read shared wallet connection state. Must be used within WalletProvider. */
export function useWalletContext(): UseWalletState {
  return useContext(WalletContext)
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { network } = useSettings()
  const wallet = useWallet(network)

  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
}
