import React, { createContext, useContext, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from './SettingsContext'
import { useWallet as useWalletState, type UseWalletState } from '../hooks/useWallet'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { useToast } from '../components/ToastProvider'
import SessionTimeoutModal from '../components/SessionTimeoutModal'

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
  network: null,
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

const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const WARNING_THRESHOLD_MS = 60 * 1000

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { network } = useSettings()
  const wallet = useWalletState(network)
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [showWarning, setShowWarning] = useState(false)

  const handleLogout = useCallback(() => {
    wallet.disconnect()
    setShowWarning(false)
    navigate('/signin')
    addToast('warning', 'Logged out due to inactivity.')
  }, [wallet, navigate, addToast])

  const handleStayLoggedIn = useCallback(() => {
    setShowWarning(false)
  }, [])

  useIdleTimeout({
    timeoutMs: wallet.isConnected ? IDLE_TIMEOUT_MS - WARNING_THRESHOLD_MS : 0,
    onIdle: () => {
      if (wallet.isConnected) {
        setShowWarning(true)
      }
    },
    onActivity: () => {
      if (showWarning) {
        setShowWarning(false)
      }
    },
  })

  // Final logout timer when warning is shown
  useIdleTimeout({
    timeoutMs: showWarning ? WARNING_THRESHOLD_MS : 0,
    onIdle: handleLogout,
  })

  const value = {
    ...wallet,
    connected: wallet.isConnected,
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
      <SessionTimeoutModal
        open={showWarning}
        timeLeftSeconds={60}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={handleLogout}
      />
    </WalletContext.Provider>
  )
}
