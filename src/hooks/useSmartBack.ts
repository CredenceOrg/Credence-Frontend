import { useNavigate, useLocation } from 'react-router-dom'
import { DEFAULT_FALLBACK_ROUTE } from '../config/navigation'
import {
  resolveSmartBackDestination,
  SmartBackLocationState,
  SmartBackResult,
} from '../lib/smartBack'

export interface UseSmartBackOptions {
  /** Optional fallback route when history is missing. Defaults to `/dashboard`. */
  fallback?: string
}

export interface UseSmartBackReturn {
  /** Trigger smart-back navigation */
  goBack: () => void
  /** The active fallback route */
  fallback: string
  /** Pure destination resolution for the current location & history */
  getDestination: () => SmartBackResult
}

/**
 * Custom React hook for smart-back navigation.
 * - Prior-route path (`location.state.from`) is honoured when present.
 * - Standard history back is used when history entry exists.
 * - Missing history falls back to `/dashboard` (or custom fallback route).
 */
export function useSmartBack(options: UseSmartBackOptions = {}): UseSmartBackReturn {
  const navigate = useNavigate()
  const location = useLocation()
  const fallback = options.fallback || DEFAULT_FALLBACK_ROUTE

  const getDestination = (): SmartBackResult => {
    const state = location.state as SmartBackLocationState | null
    const hasHistory =
      typeof window !== 'undefined' &&
      (window.history.length > 1 || Boolean(window.history.state && window.history.state.idx > 0))

    return resolveSmartBackDestination(state, hasHistory, fallback)
  }

  const goBack = () => {
    const destination = getDestination()

    if (destination.type === 'state') {
      navigate(destination.path)
    } else if (destination.type === 'history') {
      navigate(-1)
    } else {
      navigate(destination.path)
    }
  }

  return {
    goBack,
    fallback,
    getDestination,
  }
}
