import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { advanceIdentityEpoch } from '../api'
import { useSettings } from './SettingsContext'
import { useWallet as useWalletState, type UseWalletState } from '../hooks/useWallet'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { useToast } from '../components/ToastProvider'
import SessionTimeoutDialog from '../components/SessionTimeoutDialog'
import ReauthPrompt from '../components/ReauthPrompt'
import { emitWalletSessionEvent, generateCorrelationId } from '../lib/walletAudit'
import { clearAppLocalStorage } from '../lib/clearAppLocalStorage'
import { fetchFreighterAddress, requestFreighterAccess } from '../lib/freighterClient'

export type WalletContextValue = UseWalletState & {
  connected: boolean
  lastReauthTime: number | null
  reauth: () => Promise<boolean>
  requestReauth: () => Promise<boolean>
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
  reauth: async () => false,
  requestReauth: async () => false,
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

/** Minutes after the last re-auth before sensitive actions require it again. */
const REAUTH_THRESHOLD_MINUTES = 15

const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const WARNING_THRESHOLD_MS = 60 * 1000

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { network } = useSettings()
  const reauthThresholdMinutes = REAUTH_THRESHOLD_MINUTES
  const wallet = useWalletState(network)
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [showWarning, setShowWarning] = useState(false)
  const [showReauthPrompt, setShowReauthPrompt] = useState(false)
  const [lastReauthTime, setLastReauthTime] = useState<number | null>(null)
  const logoutGenRef = useRef(0)
  const latestWalletRef = useRef(wallet)
  latestWalletRef.current = wallet
  const pendingReauthRef = useRef<{
    promise: Promise<boolean>
    resolve: (success: boolean) => void
  } | null>(null)

  const finishReauthPrompt = useCallback((success: boolean) => {
    setShowReauthPrompt(false)
    const pending = pendingReauthRef.current
    pendingReauthRef.current = null
    pending?.resolve(success)
  }, [])

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
    logoutGenRef.current += 1
    finishReauthPrompt(false)
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
  }, [wallet, navigate, addToast, finishReauthPrompt])

  const handleStayLoggedIn = useCallback(() => {
    setShowWarning(false)
  }, [])

  const disconnect = useCallback(() => {
    logoutGenRef.current += 1
    wallet.disconnect()
  }, [wallet.disconnect])

  const isReauthRequired = useCallback(() => {
    if (!wallet.isConnected || lastReauthTime === null) {
      return true
    }
    const elapsedMs = Date.now() - lastReauthTime
    const thresholdMs = reauthThresholdMinutes * 60 * 1000
    return elapsedMs >= thresholdMs
  }, [wallet.isConnected, lastReauthTime, reauthThresholdMinutes])

  const reauth = useCallback(async () => {
    const gen = logoutGenRef.current
    const session = latestWalletRef.current

    try {
      if (!session.isConnected || !session.address) {
        await session.connect()
        const connectedWallet = latestWalletRef.current
        if (
          logoutGenRef.current !== gen ||
          !connectedWallet.isConnected ||
          !connectedWallet.address
        ) {
          return false
        }
        setLastReauthTime(Date.now())
        return true
      }

      const access = await requestFreighterAccess()
      if (!access.ok) return false
      if (logoutGenRef.current !== gen) return false
      if (access.address !== session.address) {
        disconnect()
        return false
      }

      const activeAddress = await fetchFreighterAddress()
      if (logoutGenRef.current !== gen) return false

      if (!activeAddress || activeAddress !== session.address) {
        if (activeAddress && activeAddress !== session.address) disconnect()
        return false
      }

      const latestWallet = latestWalletRef.current
      if (
        !latestWallet.isConnected ||
        latestWallet.address !== session.address ||
        logoutGenRef.current !== gen
      ) {
        return false
      }

      setLastReauthTime(Date.now())
      return true
    } catch {
      addToast('danger', 'Unable to verify your wallet. Please try again.')
      return false
    }
  }, [addToast, disconnect])

  const requestReauth = useCallback(() => {
    if (!isReauthRequired()) return Promise.resolve(true)
    if (pendingReauthRef.current) return pendingReauthRef.current.promise

    let resolve!: (success: boolean) => void
    const promise = new Promise<boolean>((yes) => {
      resolve = yes
    })
    pendingReauthRef.current = { promise, resolve }
    setShowReauthPrompt(true)
    return promise
  }, [isReauthRequired])

  const handleReauthConfirm = useCallback(async () => {
    const success = await reauth()
    finishReauthPrompt(success)
  }, [finishReauthPrompt, reauth])

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
    disconnect,
    connected: wallet.isConnected,
    lastReauthTime,
    reauth,
    requestReauth,
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
      <ReauthPrompt
        open={showReauthPrompt}
        onConfirm={handleReauthConfirm}
        onCancel={() => finishReauthPrompt(false)}
      />
    </WalletContext.Provider>
  )
}
