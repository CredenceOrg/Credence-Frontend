// Minimal stub for @stellar/freighter-api — resolves the missing package during tests.
// The real Freighter extension API is never needed in JSDOM; WalletContext mocks replace it.
export const isConnected = async () => ({ isConnected: false })
export const isAllowed = async () => ({ isAllowed: false })
export const requestAccess = async () => ({ address: '', error: null })
export const getAddress = async () => ({ address: '', error: null })
export const getNetwork = async () => ({ network: '', error: null })
export const signTransaction = async () => ({ signedTxXdr: '', error: null })
export class WatchWalletChanges {
  watch(_cb: unknown) {}
  stop() {}
}
