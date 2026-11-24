import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'

/**
 * Layout route guard for private wallet-gated routes.
 *
 * - While the wallet session is restoring on initial load, renders an accessible
 *   loading indicator so private content never flashes and valid sessions are
 *   not prematurely redirected.
 * - When disconnected, redirects to `/signin?next=<encoded current path>`.
 * - When connected, renders the nested route via `<Outlet />`.
 */
export default function RequireWallet() {
  const { isConnected, isRestoring } = useWallet()
  const location = useLocation()

  if (isRestoring) {
    return (
      <div role="status" aria-live="polite">
        Restoring wallet session...
      </div>
    )
  }

  if (!isConnected) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/signin?next=${encodeURIComponent(nextPath)}`} replace />
  }

  return <Outlet />
}
