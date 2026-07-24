import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import { WalletProvider } from './context/WalletContext'
import ToastProvider from './components/ToastProvider'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'

import {
  preloadHome,
  preloadDashboard,
  preloadBond,
  preloadCreateBond,
  preloadBondDetail,
  preloadTrustScore,
  preloadTrustSummary,
  preloadAttestations,
  preloadTransactions,
  preloadSettings,
  preloadAmountInputTest,
  preloadSignIn,
  preloadNotFound,
} from './config/routes'

const Home = lazy(preloadHome)
const Dashboard = lazy(preloadDashboard)
const Bond = lazy(preloadBond)
const CreateBondPage = lazy(preloadCreateBond)
const BondDetail = lazy(preloadBondDetail)
const TrustScore = lazy(preloadTrustScore)
const TrustSummary = lazy(preloadTrustSummary)
const Attestations = lazy(preloadAttestations)
const Transactions = lazy(preloadTransactions)
const Settings = lazy(preloadSettings)
const AmountInputTestPage = lazy(preloadAmountInputTest)
const SignIn = lazy(preloadSignIn)
const NotFound = lazy(preloadNotFound)

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
            </ErrorBoundary>
          </WalletProvider>
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}

export default App
