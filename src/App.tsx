import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import { WalletProvider } from './context/WalletContext'
import ToastProvider from './components/ToastProvider'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'

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
const SignIn = lazy(() => import('./pages/SignIn'))
const NotFound = lazy(() => import('./pages/NotFound'))

const BreakpointOverlay = import.meta.env.DEV
  ? lazy(() => import('./components/dev/BreakpointOverlay'))
  : null
const DebugOverlay = import.meta.env.DEV
  ? lazy(() => import('./components/dev/DebugOverlay'))
  : null
const AmountInputTestPage = import.meta.env.DEV
  ? lazy(() => import('./pages/AmountInputTestPage'))
  : null
const ToastTest = import.meta.env.DEV ? lazy(() => import('./pages/ToastTest')) : null

export interface AppProps {
  /** Optional custom subtree to render instead of default Routes for testing and boundary harnesses. */
  children?: ReactNode
  /** Optional custom error fallback for the route ErrorBoundary. */
  errorFallback?: (error: Error, reset: () => void) => ReactNode
  /** Optional custom loading fallback for the route Suspense boundary. */
  loadingFallback?: ReactNode
}

/**
 * Provider order is load-bearing:
 *  - `<WidgetCacheProvider>` (closes #561) sits as the outermost state provider
 *    after `<BrowserRouter>` and above `<ErrorBoundary>` so widget cache state
 *    survives route-level crashes, settings reloads, and wallet-connect cycles.
 *  - `SettingsProvider` must remain the outer ancestor of every provider whose
 *    body calls `useSettings()` (currently `ToastProvider`, which reads
 *    `toastsEnabled` and `autoDismiss`).
 *  - `ToastProvider` sits above `WalletProvider` so `WalletProvider` can use
 *    `useToast()` for idle-disconnect notifications.
 *  - `<ErrorBoundary>` wraps the route `<Suspense>` tree so render failures and
 *    chunk-load rejections are caught with a branded recovery UI without
 *    unmounting outer state or losing user data.
 *  - `<Suspense>` displays an accessible loading fallback (`role="status"`)
 *    while route components resolve dynamically.
 */
const WidgetCacheProvider = lazy(() =>
  import('./widgetCache').then((m) => ({ default: m.WidgetCacheProvider })),
)

export function App({ children, errorFallback, loadingFallback }: AppProps = {}) {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
      <WidgetCacheProvider>
        <SettingsProvider>
          <ToastProvider>
            <WalletProvider>
              <ErrorBoundary fallback={errorFallback}>
                <Suspense
                  fallback={
                    loadingFallback ?? (
                      <div role="status" aria-live="polite">
                        Loading...
                      </div>
                    )
                  }
                >
                  {children ?? (
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
                        {import.meta.env.DEV && AmountInputTestPage && (
                          <Route path="test-amount-input" element={<AmountInputTestPage />} />
                        )}
                        <Route path="signin" element={<SignIn />} />
                        {import.meta.env.DEV && ToastTest && (
                          <Route path="dev/toasts" element={<ToastTest />} />
                        )}
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Routes>
                  )}
                </Suspense>
                {import.meta.env.DEV && BreakpointOverlay && (
                  <BreakpointOverlay />
                )}
                {import.meta.env.DEV && DebugOverlay && (
                  <DebugOverlay />
                )}
              </ErrorBoundary>
            </WalletProvider>
          </ToastProvider>
        </SettingsProvider>
        </WidgetCacheProvider>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
