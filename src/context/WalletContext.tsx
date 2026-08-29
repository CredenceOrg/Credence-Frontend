import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { advanceIdentityEpoch } from '../api'
import { useSettings } from './SettingsContext'
import { useWallet as useWalletState, type UseWalletState } from '../hooks/useWallet'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { useToast } from '../components/ToastProvider'
import SessionTimeoutDialog from '../components/SessionTimeoutDialog'
import { emitWalletSessionEvent, generateCorrelationId } from '../lib/walletAudit'

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

/** Read shared wallet connection state with the legacy connected alias. */
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
  const logoutGenRef = useRef(0)

  // Atomic reauth-time tracking: derive directly from wallet address rather
  // than scheduling separate state updates after connect/reauth calls. This
  // prevents lastReauthTime from being set after a concurrent disconnect.
  useEffect(() => {
    if (wallet.isConnected && lastReauthTime === null) {
      setLastReauthTime(Date.now())
    }
    if (!wallet.isConnected) {
      setLastReauthTime(null)
    }
  }, [wallet.isConnected, lastReauthTime])

  const handleLogout = useCallback(() => {
    const prevAddress = wallet.address
    const prevNetwork = wallet.network
    advanceIdentityEpoch()
    wallet.disconnect()
    // Now clear app-local storage (settings, cached data).
    clearAppLocalStorage()
    setShowWarning(false)

    emitWalletSessionEvent('session_expired', {
      address: null,
      network: null,
      correlationId: generateCorrelationId('session-idle-expiry'),
      metadata: {
        previousAddress: prevAddress || null,
        previousNetwork: prevNetwork || null,
        reason: 'inactivity',
      },
    })

    navigate('/signin')
    addToast('warning', 'Logged out due to inactivity.')
  }, [wallet, navigate, addToast])

  const handleStayLoggedIn = useCallback(() => {
    setShowWarning(false)
  }, [])

  const reauth = useCallback(async () => {
    const gen = logoutGenRef.current
    // Reconnect wallet as re-authentication.
    // wallet.connect() uses its own generation counter internally, so
    // a concurrent disconnect will invalidate this connect attempt.
    await wallet.connect()
    // Only update reauth time if:
    // 1. Logout hasn't been triggered in the meantime (same generation)
    // 2. The wallet actually reports connected (connect may have been
    //    invalidated by a concurrent disconnect)
    if (logoutGenRef.current === gen && wallet.isConnected) {
      setLastReauthTime(Date.now())
    }
  }, [wallet])

  const isReauthRequired = useCallback(() => {
    if (!wallet.isConnected || lastReauthTime === null) {
      return true
    }
    const elapsedMs = Date.now() - lastReauthTime
    const thresholdMs = reauthThresholdMinutes * 60 * 1000
    return elapsedMs >= thresholdMs
  }, [wallet.isConnected, lastReauthTime, reauthThresholdMinutes])

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
      <SessionTimeoutDialog
        open={showWarning}
        timeLeftSeconds={60}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={handleLogout}
      />
    </WalletContext.Provider>
  )
}
