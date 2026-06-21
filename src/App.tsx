import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import { WalletProvider } from './context/WalletContext'
import ToastProvider from './components/ToastProvider'
import Layout from './components/Layout'

const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Bond = lazy(() => import('./pages/Bond'))
const CreateBondPage = lazy(() => import('./pages/CreateBondPage'))
const TrustScore = lazy(() => import('./pages/TrustScore'))
const Settings = lazy(() => import('./pages/Settings'))
const AmountInputTestPage = lazy(() => import('./pages/AmountInputTestPage'))
const NotFound = lazy(() => import('./pages/NotFound'))

// import.meta.env.DEV is replaced with `false` at build time by Vite/Rollup,
// so the dynamic import('./pages/ToastTest') reference is dead-code eliminated
// from the production bundle.
const ToastTest = import.meta.env.DEV
  ? lazy(() => import('./pages/ToastTest'))
  : null

/**
 * Provider order is load-bearing: SettingsProvider must be the outer ancestor
 * because ToastProvider reads toastsEnabled and autoDismiss via useSettings().
 */
function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <WalletProvider>
          <ToastProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="bond" element={<Bond />} />
                  <Route path="bond/new" element={<CreateBondPage />} />
                  <Route path="trust" element={<TrustScore />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="test-amount-input" element={<AmountInputTestPage />} />
                  {import.meta.env.DEV && ToastTest && (
                    <Route path="dev/toasts" element={<ToastTest />} />
                  )}
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </ToastProvider>
        </WalletProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}

export default App
