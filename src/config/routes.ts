import { ComponentType } from 'react'
import { lazyWithRetry } from '../lib/lazyWithRetry'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ComponentType<any> matches React.lazy return type
export type PreloadFn = () => Promise<{ default: ComponentType<any> }>

export const Home = lazyWithRetry(() => import('../pages/Home'))
export const Dashboard = lazyWithRetry(() => import('../pages/Dashboard'))
export const Bond = lazyWithRetry(() => import('../pages/Bond'))
export const CreateBondPage = lazyWithRetry(() => import('../pages/CreateBondPage'))
export const BondDetail = lazyWithRetry(() => import('../pages/BondDetail'))
export const TrustScore = lazyWithRetry(() => import('../pages/TrustScore'))
export const TrustSummary = lazyWithRetry(() => import('../pages/TrustSummary'))
export const Attestations = lazyWithRetry(() => import('../pages/Attestations'))
export const Transactions = lazyWithRetry(() => import('../pages/Transactions'))
export const Settings = lazyWithRetry(() => import('../pages/Settings'))
export const AmountInputTestPage = lazyWithRetry(() => import('../pages/AmountInputTestPage'))
export const SignIn = lazyWithRetry(() => import('../pages/SignIn'))
export const NotFound = lazyWithRetry(() => import('../pages/NotFound'))

export const preloadHome: PreloadFn = Home.preload
export const preloadDashboard: PreloadFn = Dashboard.preload
export const preloadBond: PreloadFn = Bond.preload
export const preloadCreateBond: PreloadFn = CreateBondPage.preload
export const preloadBondDetail: PreloadFn = BondDetail.preload
export const preloadTrustScore: PreloadFn = TrustScore.preload
export const preloadTrustSummary: PreloadFn = TrustSummary.preload
export const preloadAttestations: PreloadFn = Attestations.preload
export const preloadTransactions: PreloadFn = Transactions.preload
export const preloadSettings: PreloadFn = Settings.preload
export const preloadAmountInputTest: PreloadFn = AmountInputTestPage.preload
export const preloadSignIn: PreloadFn = SignIn.preload
export const preloadNotFound: PreloadFn = NotFound.preload

export const PRELOADS_BY_PATH: Record<string, PreloadFn> = {
  '/': preloadHome,
  '/dashboard': preloadDashboard,
  '/bond': preloadBond,
  '/trust': preloadTrustScore,
  '/attestations': preloadAttestations,
  '/transactions': preloadTransactions,
  '/settings': preloadSettings,
}

/**
 * Browser-wide accessibility audit targets. The seven primary navigation routes
 * come from PRELOADS_BY_PATH; the create-bond/sign-in screens and wildcard 404
 * are valid app routes too (see App.tsx). Keep this list in sync when adding
 * a new static route. Parameterized detail pages need representative fixtures.
 */
export const A11Y_AUDIT_PATHS = [
  ...Object.keys(PRELOADS_BY_PATH),
  '/bond/new',
  '/signin',
  '/a11y-nonexistent-route',
]
