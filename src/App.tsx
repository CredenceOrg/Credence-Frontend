import { Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FeatureFlagProvider } from './context/FeatureFlagContext'
import { SettingsProvider } from './context/SettingsContext'
import { WalletProvider } from './context/WalletContext'
import ToastProvider from './components/ToastProvider'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import RequireWallet from './components/RequireWallet'
import BreakpointOverlay from './components/dev/BreakpointOverlay'
import DebugOverlay from './components/dev/DebugOverlay'
import { WidgetCacheProvider } from './widgetCache'
import { lazyWithRetry } from './lib/lazyWithRetry'
import {
  Home,
  Dashboard,
  Bond,
  CreateBondPage,
  BondDetail,
  TrustScore,
  TrustSummary,
  Attestations,
  Transactions,
  Settings,
  AmountInputTestPage,
  SignIn,
  NotFound,
} from './config/routes'

const ToastTest = import.meta.env.DEV ? lazyWithRetry(() => import('./pages/ToastTest')) : null

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
 *  - `<FeatureFlagProvider>` reads `useLocation()`, so it must sit inside
 *    `<BrowserRouter>` and above every flag consumer.
 *  - `<WidgetCacheProvider>` (closes #561) sits as the outermost state provider
 *    after `<FeatureFlagProvider>` and above `<ErrorBoundary>` so widget cache
 *    state survives route-level crashes, settings reloads, and wallet-connect cycles.
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
export function App({ children, errorFallback, loadingFallback }: AppProps = {}) {
  return (
    <BrowserRouter>
      <FeatureFlagProvider>
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
                          <Route path="trust" element={<TrustScore />} />
                          <Route path="trust/summary" element={<TrustSummary />} />
                          <Route path="trust/:address" element={<TrustScore />} />
                          <Route path="dashboard" element={<Dashboard />} />
                          <Route path="bond" element={<Bond />} />
                          <Route path="bond/new" element={<CreateBondPage />} />
                          <Route path="bond/:id" element={<BondDetail />} />
                          <Route path="attestations" element={<Attestations />} />
                          <Route path="transactions" element={<Transactions />} />
                          <Route path="settings" element={<Settings />} />
                          <Route path="test-amount-input" element={<AmountInputTestPage />} />
                          <Route path="signin" element={<SignIn />} />
                          <Route element={<RequireWallet />}>
                          </Route>
                          {import.meta.env.DEV && ToastTest && (
                            <Route path="dev/toasts" element={<ToastTest />} />
                          )}
                          <Route path="*" element={<NotFound />} />
                        </Route>
                      </Routes>
                    )}
                  </Suspense>
                  <BreakpointOverlay />
                  <DebugOverlay />
                </ErrorBoundary>
              </WalletProvider>
            </ToastProvider>
          </SettingsProvider>
        </WidgetCacheProvider>
      </FeatureFlagProvider>
    </BrowserRouter>
  )
}

export default App
