import React, { createContext, useContext } from 'react'
import { useSettings } from './SettingsContext'
import { useWallet as useWalletState, type UseWalletState } from '../hooks/useWallet'

export type WalletContextValue = UseWalletState & {
  connected: boolean
}

const defaultWalletState: WalletContextValue = {
  address: '',
  isConnected: false,
  connected: false,
  isConnecting: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  network: 'public',
}

const WalletContext = createContext<WalletContextValue>(defaultWalletState)

/** Read shared wallet connection state. Must be used within WalletProvider. */
export function useWalletContext(): WalletContextValue {
  return useContext(WalletContext)
}

/** Read shared wallet connection state with the legacy `connected` alias. */
export function useWallet(): WalletContextValue {
  return useWalletContext()
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { network } = useSettings()
  const wallet = useWalletState(network)
  const value = {
    ...wallet,
    connected: wallet.isConnected,
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
