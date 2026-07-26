// Browser-safe stand-in for @stellar/freighter-api, used only by the Playwright
// dev server when E2E_MOCK_WALLET=true (see vite.config.ts). Mirrors the shape of
// src/test/__mocks__/freighter-api.stub.ts but simulates a *connectable* wallet
// instead of an always-disconnected one, so e2e specs can drive the real
// "Connect wallet" button through src/hooks/useWallet.ts without a browser
// extension installed. Never bundled into a production build.
export const MOCK_WALLET_ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

export const isConnected = async () => ({ isConnected: true })
// False so the silent session-restore effect in useWallet doesn't auto-populate
// the address on mount — tests exercise the explicit "Connect wallet" click.
export const isAllowed = async () => ({ isAllowed: false })
export const requestAccess = async () => ({ address: MOCK_WALLET_ADDRESS, error: null })
export const getAddress = async () => ({ address: MOCK_WALLET_ADDRESS, error: null })
export const getNetwork = async () => ({ network: 'PUBLIC', error: null })
export const signTransaction = async () => ({ signedTxXdr: '', error: null })
export class WatchWalletChanges {
  watch(_cb: unknown) {}
  stop() {}
}
