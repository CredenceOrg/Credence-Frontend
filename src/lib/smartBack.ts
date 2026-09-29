import { DEFAULT_FALLBACK_ROUTE } from '../config/navigation'

export interface SmartBackLocationState {
  from?: string
  [key: string]: unknown
}

export type SmartBackResult =
  | { type: 'state'; path: string }
  | { type: 'history' }
  | { type: 'fallback'; path: string }

/**
 * Resolves the destination for smart-back navigation.
 *
 * Rules:
 * 1. Prior-route path (`locationState.from`) is honoured if present.
 * 2. Standard history back (`navigate(-1)`) is used if history exists.
 * 3. Missing history falls back to `/dashboard` (or custom fallback route).
 */
export function resolveSmartBackDestination(
  locationState?: SmartBackLocationState | null,
  hasHistory = true,
  fallback: string = DEFAULT_FALLBACK_ROUTE
): SmartBackResult {
  if (
    locationState &&
    typeof locationState.from === 'string' &&
    locationState.from.trim().length > 0
  ) {
    return { type: 'state', path: locationState.from.trim() }
  }

  if (hasHistory) {
    return { type: 'history' }
  }

  return {
    type: 'fallback',
    path: fallback || DEFAULT_FALLBACK_ROUTE,
  }
}
