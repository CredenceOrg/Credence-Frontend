import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import { WalletProvider } from './context/WalletContext'
import ToastProvider from './components/ToastProvider'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import RouteErrorPage from './pages/RouteErrorPage'

const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Bond = lazy(() => import('./pages/Bond'))
const CreateBondPage = lazy(() => import('./pages/CreateBondPage'))
const BondDetail = lazy(() => import('./pages/BondDetail'))
const TrustScore = lazy(() => import('./pages/TrustScore'))
const Attestations = lazy(() => import('./pages/Attestations'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Settings = lazy(() => import('./pages/Settings'))
const AmountInputTestPage = lazy(() => import('./pages/AmountInputTestPage'))
const SignIn = lazy(() => import('./pages/SignIn'))
const NotFound = lazy(() => import('./pages/NotFound'))

// import.meta.env.DEV is replaced with `false` at build time by Vite/Rollup,
// so the dynamic import('./pages/ToastTest') reference is dead-code eliminated
// from the production bundle.
const ToastTest = import.meta.env.DEV ? lazy(() => import('./pages/ToastTest')) : null

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
            <ErrorBoundary>
              <Suspense fallback={<div>Loading...</div>}>
                <Routes>
                  <Route path="/" element={<Layout />} errorElement={<RouteErrorPage />}>
                    <Route index element={<Home />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="bond" element={<Bond />} />
                    <Route path="bond/new" element={<CreateBondPage />} />
                    <Route path="bond/:id" element={<BondDetail />} />
                    <Route path="trust" element={<TrustScore />} />
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
            </ErrorBoundary>
          </WalletProvider>
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}

export default App
