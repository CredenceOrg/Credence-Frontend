import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from './SettingsContext'
import { useWallet as useWalletState, type UseWalletState } from '../hooks/useWallet'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { useToast } from '../components/ToastProvider'
import SessionTimeoutModal from '../components/SessionTimeoutModal'
import { SessionReauthRequiredError } from '../lib/sessionErrors'

export type WalletContextValue = UseWalletState & {
  connected: boolean
  lastReauthTime: number | null
  reauth: () => Promise<void>
  isReauthRequired: () => boolean
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
  lastReauthTime: null,
  reauth: async () => {},
  isReauthRequired: () => false,
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
  const { network, reauthThresholdMinutes } = useSettings()
  const wallet = useWalletState(network)
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [showWarning, setShowWarning] = useState(false)
  const [lastReauthTime, setLastReauthTime] = useState<number | null>(null)

  const lastReauthRef = useRef<number | null>(lastReauthTime)
  useEffect(() => {
    lastReauthRef.current = lastReauthTime
  }, [lastReauthTime])

  // Set last reauth time when wallet connects
  useEffect(() => {
    if (wallet.isConnected && lastReauthTime === null) {
      setLastReauthTime(Date.now())
    }
    if (!wallet.isConnected) {
      setLastReauthTime(null)
    }
  }, [wallet.isConnected, lastReauthTime])

  const handleLogout = useCallback(() => {
    wallet.disconnect()
    setShowWarning(false)
    setLastReauthTime(null)
    navigate('/signin')
    addToast('warning', 'Logged out due to inactivity.')
  }, [wallet, navigate, addToast])

  const handleStayLoggedIn = useCallback(() => {
    setShowWarning(false)
  }, [])

  const reauth = useCallback(async () => {
    // Reconnect wallet as re-authentication
    await wallet.connect()
    setLastReauthTime(Date.now())
  }, [wallet])

  const isReauthRequired = useCallback(() => {
    if (!wallet.isConnected || lastReauthRef.current === null) {
      return true
    }
    const elapsedMs = Date.now() - lastReauthRef.current
    const thresholdMs = reauthThresholdMinutes * 60 * 1000
    return elapsedMs >= thresholdMs
  }, [wallet.isConnected, reauthThresholdMinutes])

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
    lastReauthTime,
    reauth,
    isReauthRequired,
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
