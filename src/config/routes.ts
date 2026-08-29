import { ComponentType } from 'react'

type PreloadFn = () => Promise<{ default: ComponentType<unknown> }>

export const preloadHome: PreloadFn = () => import('../pages/Home')
export const preloadDashboard: PreloadFn = () => import('../pages/Dashboard')
export const preloadBond: PreloadFn = () => import('../pages/Bond')
export const preloadCreateBond: PreloadFn = () => import('../pages/CreateBondPage')
export const preloadBondDetail: PreloadFn = () => import('../pages/BondDetail')
export const preloadTrustScore: PreloadFn = () => import('../pages/TrustScore')
export const preloadTrustSummary: PreloadFn = () => import('../pages/TrustSummary')
export const preloadAttestations: PreloadFn = () => import('../pages/Attestations')
export const preloadTransactions: PreloadFn = () => import('../pages/Transactions')
export const preloadSettings: PreloadFn = () => import('../pages/Settings')
export const preloadAmountInputTest: PreloadFn = () => import('../pages/AmountInputTestPage')
export const preloadSignIn: PreloadFn = () => import('../pages/SignIn')
export const preloadNotFound: PreloadFn = () => import('../pages/NotFound')

export const PRELOADS_BY_PATH: Record<string, PreloadFn> = {
  '/': preloadHome,
  '/dashboard': preloadDashboard,
  '/bond': preloadBond,
  '/trust': preloadTrustScore,
  '/attestations': preloadAttestations,
  '/transactions': preloadTransactions,
  '/settings': preloadSettings,
}
