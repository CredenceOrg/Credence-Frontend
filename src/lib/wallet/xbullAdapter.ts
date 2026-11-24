import type { CredenceNetwork } from '../networkLabels'
import {
  normalizeWalletNetwork,
  type SignTransactionOptions,
  type WalletAdapter,
  type WalletConnectResult,
  type WalletSignResult,
} from './adapter'

export const XBULL_ADAPTER_ID = 'xbull'
export const XBULL_INSTALL_URL = 'https://xbull.app/'

export interface XBullSDK {
  connect?: (params?: { canRequestPublicKey?: boolean; canRequestSign?: boolean }) => Promise<void>
  getPublicKey?: () => Promise<string>
  getNetwork?: () => Promise<string>
  sign?: (params: {
    xdr: string
    publicKey?: string
    network?: string
  }) => Promise<string | { signedXDR?: string; signedTxXdr?: string }>
  closeConnections?: () => Promise<void> | void
}

interface WindowWithXBull extends Window {
  xBullSDK?: XBullSDK
}

function getXBullSDK(): XBullSDK | null {
  if (typeof window === 'undefined') return null
  const sdk = (window as WindowWithXBull).xBullSDK
  return sdk && typeof sdk === 'object' ? sdk : null
}

function isRejectionMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('reject') ||
    lower.includes('denied') ||
    lower.includes('cancel') ||
    lower.includes('declined')
  )
}

let cachedAddress: string | null = null

/**
 * WalletAdapter implementation for the xBull Stellar wallet extension.
 *
 * Uses SSR-safe feature detection against `window.xBullSDK`.
 */
export const xbullAdapter: WalletAdapter = {
  id: XBULL_ADAPTER_ID,
  name: 'xBull',
  installUrl: XBULL_INSTALL_URL,

  async isInstalled(): Promise<boolean> {
    return getXBullSDK() !== null
  },

  async connect(): Promise<WalletConnectResult> {
    const sdk = getXBullSDK()
    if (!sdk) {
      return {
        ok: false,
        code: 'not_installed',
        message: 'xBull extension was not detected.',
      }
    }

    try {
      if (typeof sdk.connect === 'function') {
        await sdk.connect({ canRequestPublicKey: true, canRequestSign: true })
      }
      if (typeof sdk.getPublicKey !== 'function') {
        return {
          ok: false,
          code: 'unknown',
          message: 'xBull does not expose a public key method.',
        }
      }
      const address = await sdk.getPublicKey()
      if (!address) {
        return {
          ok: false,
          code: 'unknown',
          message: 'xBull did not return a wallet address.',
        }
      }
      cachedAddress = address
      return { ok: true, address }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection request was rejected.'
      return {
        ok: false,
        code: isRejectionMessage(message) ? 'rejected' : 'unknown',
        message,
      }
    }
  },

  async getAddress(): Promise<string | null> {
    const sdk = getXBullSDK()
    if (!sdk) return null
    if (cachedAddress) return cachedAddress
    if (typeof sdk.getPublicKey !== 'function') return null
    try {
      const address = await sdk.getPublicKey()
      if (address) {
        cachedAddress = address
        return address
      }
      return null
    } catch {
      return null
    }
  },

  async getNetwork(): Promise<CredenceNetwork | null> {
    const sdk = getXBullSDK()
    if (!sdk || typeof sdk.getNetwork !== 'function') return null
    try {
      const raw = await sdk.getNetwork()
      return raw ? normalizeWalletNetwork(raw) : null
    } catch {
      return null
    }
  },

  async signTransaction(xdr: string, opts?: SignTransactionOptions): Promise<WalletSignResult> {
    const sdk = getXBullSDK()
    if (!sdk) {
      return {
        ok: false,
        code: 'not_installed',
        message: 'xBull extension was not detected.',
      }
    }

    if (typeof sdk.sign !== 'function') {
      return {
        ok: false,
        code: 'unknown',
        message: 'xBull does not support transaction signing in this environment.',
      }
    }

    try {
      const result = await sdk.sign({
        xdr,
        publicKey: opts?.address,
        network: opts?.networkPassphrase,
      })
      const signedTxXdr =
        typeof result === 'string' ? result : result?.signedTxXdr || result?.signedXDR || ''

      if (!signedTxXdr) {
        return {
          ok: false,
          code: 'unknown',
          message: 'xBull did not return a signed transaction.',
        }
      }
      return { ok: true, signedTxXdr }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to sign the transaction. Please try again.'
      return {
        ok: false,
        code: isRejectionMessage(message) ? 'rejected' : 'unknown',
        message,
      }
    }
  },

  async disconnect(): Promise<void> {
    cachedAddress = null
    const sdk = getXBullSDK()
    if (sdk && typeof sdk.closeConnections === 'function') {
      try {
        await sdk.closeConnections()
      } catch {
        // Ignore provider teardown errors.
      }
    }
  },
}

/** Resets in-memory xBull state — for tests only. */
export function resetXBullAdapterState(): void {
  cachedAddress = null
}
