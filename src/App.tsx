import { lazy, Suspense, useState, useCallback, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import { WalletProvider, useWallet } from './context/WalletContext'
import ToastProvider from './components/ToastProvider'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import BreakpointOverlay from './components/dev/BreakpointOverlay'
import DebugOverlay from './components/dev/DebugOverlay'
import { WidgetCacheProvider } from './widgetCache'
import { MutationRecoveryProvider } from './components/MutationRecoveryProvider'
import LoadingSkeleton from './components/states/LoadingSkeleton'
import ReauthPrompt from './components/ReauthPrompt'

const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Bond = lazy(() => import('./pages/Bond'))
const CreateBondPage = lazy(() => import('./pages/CreateBondPage'))
const BondDetail = lazy(() => import('./pages/BondDetail'))
const TrustScore = lazy(() => import('./pages/TrustScore'))
const TrustSummary = lazy(() => import('./pages/TrustSummary'))
const Attestations = lazy(() => import('./pages/Attestations'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Settings = lazy(() => import('./pages/Settings'))
const AmountInputTestPage = lazy(() => import('./pages/AmountInputTestPage'))
const SignIn = lazy(() => import('./pages/SignIn'))
const NotFound = lazy(() => import('./pages/NotFound'))

const ToastTest = import.meta.env.DEV ? lazy(() => import('./pages/ToastTest')) : null

function AppRouter() {
  const { isReauthRequired, reauth, connected } = useWallet()
  const [showReauth, setShowReauth] = useState(false)

  useEffect(() => {
    if (connected && isReauthRequired()) {
      setShowReauth(true)
    }
  }, [connected, isReauthRequired])

  const handleReauthConfirm = useCallback(async () => {
    await reauth()
    setShowReauth(false)
  }, [reauth])

  const handleReauthCancel = useCallback(() => {
    setShowReauth(false)
  }, [])

  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<LoadingSkeleton variant="dashboard" />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="bond" element={<Bond />} />
              <Route path="bond/new" element={<CreateBondPage />} />
              <Route path="bond/:id" element={<BondDetail />} />
              <Route path="trust" element={<TrustScore />} />
              <Route path="trust/summary" element={<TrustSummary />} />
              <Route path="attestations" element={<Attestations />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="settings" element={<Settings />} />
              <Route path="test-amount-input" element={<AmountInputTestPage />} />
              <Route path="signin" element={<SignIn />} />
              {import.meta.env.DEV && ToastTest && (
                <Route path="dev/toasts" element={<ToastTest />} />
              )}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
        <BreakpointOverlay />
        <DebugOverlay />
      </ErrorBoundary>

      <ReauthPrompt 
        open={showReauth}
        onConfirm={handleReauthConfirm}
        onCancel={handleReauthCancel}
      />
    </>
  )
}

/**
 * Provider order is partly load-bearing:
 *  - `SettingsProvider` must remain the outer ancestor of every provider whose
 *    body calls `useSettings()` (currently `ToastProvider`, which reads
 *    `toastsEnabled` and `autoDismiss`).
 *  - `ToastProvider` sits above `WalletProvider` so `WalletProvider` can use
 *    `useToast()` for idle-disconnect notifications.
 *
 * `<WidgetCacheProvider>` (closes #561) sits ABOVE `SettingsProvider` because
 * it has no dependency on any other context, and we deliberately keep it as
 * the outermost shared ancestor after `<BrowserRouter>` so dashboard widget
 * state survives settings-watcher reloads and wallet-connect cycles. See
 * `docs/widget-cache.md` for the per-key isolation contract.
 */
function App() {
  return (
    <BrowserRouter>
      <WidgetCacheProvider>
        <SettingsProvider>
          <ToastProvider>
            <WalletProvider>
              <MutationRecoveryProvider>
                <AppRouter />
              </MutationRecoveryProvider>
            </WalletProvider>
          </ToastProvider>
        </SettingsProvider>
      </WidgetCacheProvider>
    </BrowserRouter>
  )
}

export default App
