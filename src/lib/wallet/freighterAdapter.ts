import {
  checkFreighterInstalled,
  createWalletWatcher,
  fetchFreighterAddress,
  fetchFreighterNetwork,
  requestFreighterAccess,
  signFreighterTransaction,
} from '../freighterClient'
import type {
  SignTransactionOptions,
  WalletAdapter,
  WalletChangeEvent,
  WalletConnectResult,
  WalletSignResult,
  WalletWatcherHandle,
} from './adapter'

export const FREIGHTER_ADAPTER_ID = 'freighter'
const FREIGHTER_ADAPTER_INSTALL_URL = 'https://www.freighter.app/'

/**
 * WalletAdapter implementation backed by the Freighter browser extension.
 *
 * Delegates to `freighterClient` so existing mocks and tests continue to work unchanged.
 */
export const freighterAdapter: WalletAdapter = {
  id: FREIGHTER_ADAPTER_ID,
  name: 'Freighter',
  installUrl: FREIGHTER_ADAPTER_INSTALL_URL,

  isInstalled: () => checkFreighterInstalled(),

  connect: (): Promise<WalletConnectResult> => requestFreighterAccess(),

  getAddress: () => fetchFreighterAddress(),

  getNetwork: () => fetchFreighterNetwork(),

  signTransaction: (xdr: string, opts?: SignTransactionOptions): Promise<WalletSignResult> =>
    signFreighterTransaction(xdr, opts),

  disconnect: () => {
    // Freighter does not expose a programmatic disconnect API.
  },

  watchChanges: (
    onChange: (event: WalletChangeEvent) => void
  ): Promise<WalletWatcherHandle | null> => createWalletWatcher(onChange),
}
