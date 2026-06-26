import { lazy, ReactNode, Suspense, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import { WalletProvider } from './context/WalletContext'
import ToastProvider from './components/ToastProvider'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import ErrorState from './components/states/ErrorState'
import RouteErrorPage from './pages/RouteErrorPage'

function createLazyPages() {
  return {
    Home: lazy(() => import('./pages/Home')),
    Dashboard: lazy(() => import('./pages/Dashboard')),
    Bond: lazy(() => import('./pages/Bond')),
    CreateBondPage: lazy(() => import('./pages/CreateBondPage')),
    BondDetail: lazy(() => import('./pages/BondDetail')),
    TrustScore: lazy(() => import('./pages/TrustScore')),
    Attestations: lazy(() => import('./pages/Attestations')),
    Transactions: lazy(() => import('./pages/Transactions')),
    Settings: lazy(() => import('./pages/Settings')),
    AmountInputTestPage: lazy(() => import('./pages/AmountInputTestPage')),
    NotFound: lazy(() => import('./pages/NotFound')),
    // import.meta.env.DEV is replaced with `false` at build time by Vite/Rollup,
    // so the dynamic import('./pages/ToastTest') reference is dead-code eliminated
    // from the production bundle.
    ToastTest: import.meta.env.DEV ? lazy(() => import('./pages/ToastTest')) : null,
  }
}

function isLazyRouteLoadError(error: Error) {
  return (
    error.name === 'ChunkLoadError' ||
    /chunkloaderror|loading chunk \d+ failed|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(
      error.message
    )
  )
}

function RouteLoadFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const lazyLoadError = isLazyRouteLoadError(error)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: 'var(--credence-space-6)',
      }}
    >
      <ErrorState
        type={lazyLoadError ? 'network' : 'generic'}
        title="Page failed to load"
        message={
          lazyLoadError
            ? 'The page bundle could not be loaded. This can happen after an app update or a temporary network interruption.'
            : 'This route failed to render. Try again to reload the page content.'
        }
        action={{ label: 'Try again', onClick: onRetry }}
      />
      <a
        href="/"
        style={{
          marginTop: 'var(--credence-space-4)',
          fontSize: 'var(--credence-font-size-sm)',
          color: 'var(--credence-text-secondary)',
          textDecoration: 'underline',
        }}
      >
        Go to home page
      </a>
    </div>
  )
}

export function LazyRouteBoundary({ children }: { children: (retryKey: number) => ReactNode }) {
  const location = useLocation()
  const [retryKey, setRetryKey] = useState(0)
  const boundaryKey = `${location.pathname}${location.search}${location.hash}:${retryKey}`

  return (
    <ErrorBoundary
      key={boundaryKey}
      fallback={(error) => (
        <RouteLoadFallback error={error} onRetry={() => setRetryKey((key) => key + 1)} />
      )}
    >
      {children(retryKey)}
    </ErrorBoundary>
  )
}

function LazyRoutes({ retryKey }: { retryKey: number }) {
  const pages = useMemo(() => createLazyPages(), [retryKey])

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Layout />} errorElement={<RouteErrorPage />}>
          <Route index element={<pages.Home />} />
          <Route path="dashboard" element={<pages.Dashboard />} />
          <Route path="bond" element={<pages.Bond />} />
          <Route path="bond/new" element={<pages.CreateBondPage />} />
          <Route path="bond/:id" element={<pages.BondDetail />} />
          <Route path="trust" element={<pages.TrustScore />} />
          <Route path="attestations" element={<pages.Attestations />} />
          <Route path="transactions" element={<pages.Transactions />} />
          <Route path="settings" element={<pages.Settings />} />
          <Route path="test-amount-input" element={<pages.AmountInputTestPage />} />
          {import.meta.env.DEV && pages.ToastTest && (
            <Route path="dev/toasts" element={<pages.ToastTest />} />
          )}
          <Route path="*" element={<pages.NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

/**
 * Provider order is load-bearing: SettingsProvider must be the outer ancestor
 * because ToastProvider reads toastsEnabled and autoDismiss via useSettings().
 * ToastProvider sits above WalletProvider so WalletProvider can use useToast()
 * for idle-disconnect notifications.
 */
function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <ToastProvider>
          <WalletProvider>
            <LazyRouteBoundary>
              {(retryKey) => <LazyRoutes retryKey={retryKey} />}
            </LazyRouteBoundary>
          </WalletProvider>
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}

export default App
