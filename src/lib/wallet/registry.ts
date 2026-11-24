import type { WalletAdapter } from './adapter'
import { FREIGHTER_ADAPTER_ID, freighterAdapter } from './freighterAdapter'
import { xbullAdapter } from './xbullAdapter'

export const DEFAULT_WALLET_ADAPTER_ID = FREIGHTER_ADAPTER_ID

const builtInAdapters: readonly WalletAdapter[] = [freighterAdapter, xbullAdapter]

let registeredAdapters: WalletAdapter[] = [...builtInAdapters]

/** Returns all registered wallet adapters in display order. */
export function getWalletAdapters(): readonly WalletAdapter[] {
  return registeredAdapters
}

/** Looks up an adapter by id, falling back to the default adapter when omitted or unknown. */
export function getWalletAdapter(id?: string | null): WalletAdapter {
  if (id) {
    const found = registeredAdapters.find((a) => a.id === id)
    if (found) return found
  }
  return registeredAdapters[0] ?? freighterAdapter
}

/** Registers or replaces a wallet adapter by id (useful for tests or custom providers). */
export function registerWalletAdapter(adapter: WalletAdapter): void {
  const index = registeredAdapters.findIndex((a) => a.id === adapter.id)
  if (index >= 0) {
    registeredAdapters = [
      ...registeredAdapters.slice(0, index),
      adapter,
      ...registeredAdapters.slice(index + 1),
    ]
  } else {
    registeredAdapters = [...registeredAdapters, adapter]
  }
}

/** Restores the built-in adapter list — for tests only. */
export function resetWalletAdapters(): void {
  registeredAdapters = [...builtInAdapters]
}
