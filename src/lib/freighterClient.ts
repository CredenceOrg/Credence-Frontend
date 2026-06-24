/**
 * @file freighterClient.ts
 * @description Thin, SSR-safe wrapper around `@stellar/freighter-api`.
 *
 * Every export guards against a non-browser environment (`typeof window === 'undefined'`)
 * and lazy-loads the Freighter SDK the first time it is needed, so importing this module
 * has no side effects and is safe in SSR/test contexts. The wallet React state machine in
 * `src/hooks/useWallet.ts` builds on these primitives; prefer that hook in components.
 */

/** Official Freighter browser extension install page. */
export const FREIGHTER_INSTALL_URL = 'https://www.freighter.app/'

import type { CredenceNetwork } from './networkLabels'
export type { CredenceNetwork } from './networkLabels'

type FreighterModule = typeof import('@stellar/freighter-api')

let freighterModule: FreighterModule | null = null

/**
 * Lazily imports `@stellar/freighter-api`, caching the module after first load.
 * Returns `null` outside a browser (SSR), so callers can short-circuit safely.
 */
async function loadFreighter(): Promise<FreighterModule | null> {
  if (typeof window === 'undefined') return null
  if (!freighterModule) {
    freighterModule = await import('@stellar/freighter-api')
  }
  return freighterModule
}

export function mapFreighterNetwork(freighterNetwork: string): CredenceNetwork | null {
  const normalized = freighterNetwork.trim().toUpperCase()
  if (normalized.includes('TEST')) return 'test'
  if (normalized.includes('PUBLIC') || normalized.includes('MAIN')) return 'public'
  return null
}

/**
 * Reports whether the Freighter extension is present and reachable.
 *
 * @returns `true` only when the SDK loads (browser) and reports a healthy connection.
 */
export async function checkFreighterInstalled(): Promise<boolean> {
  const freighter = await loadFreighter()
  if (!freighter) return false

  const result = await freighter.isConnected()
  return result.isConnected === true && !result.error
}

/**
 * Prompts the user (via Freighter) to grant access and returns the connected address.
 *
 * Never throws — failures are returned as a discriminated result so callers can map them
 * to UI state. The `code` distinguishes a missing extension, a user-rejected prompt, and
 * any other failure (best-effort detected by inspecting Freighter's error message).
 *
 * @returns `{ ok: true, address }` on success, otherwise `{ ok: false, code, message }`.
 */
export async function requestFreighterAccess(): Promise<
  | { ok: true; address: string }
  | { ok: false; code: 'not_installed' | 'rejected' | 'unknown'; message: string }
> {
  const freighter = await loadFreighter()
  if (!freighter) {
    return {
      ok: false,
      code: 'not_installed',
      message: 'Freighter is not available in this environment.',
    }
  }

  const installed = await freighter.isConnected()
  if (!installed.isConnected || installed.error) {
    return { ok: false, code: 'not_installed', message: 'Freighter extension was not detected.' }
  }

  const access = await freighter.requestAccess()
  if (access.error) {
    const message = access.error.message || 'Connection request was rejected.'
    const rejected =
      access.error.message?.toLowerCase().includes('reject') ||
      access.error.message?.toLowerCase().includes('denied') ||
      access.error.message?.toLowerCase().includes('cancel')
    return { ok: false, code: rejected ? 'rejected' : 'unknown', message }
  }

  if (!access.address) {
    return { ok: false, code: 'unknown', message: 'Freighter did not return a wallet address.' }
  }

  return { ok: true, address: access.address }
}

/**
 * Reads the already-authorized address without prompting, for silent session restore.
 *
 * @returns The public key when Freighter has previously granted access, else `null`.
 */
export async function fetchFreighterAddress(): Promise<string | null> {
  const freighter = await loadFreighter()
  if (!freighter) return null

  const allowed = await freighter.isAllowed()
  if (!allowed.isAllowed || allowed.error) return null

  const addressResult = await freighter.getAddress()
  if (addressResult.error || !addressResult.address) return null

  return addressResult.address
}

/**
 * Reads Freighter's currently selected network, mapped to a {@link CredenceNetwork}.
 *
 * @returns The mapped network, or `null` if unavailable or unrecognized.
 */
export async function fetchFreighterNetwork(): Promise<CredenceNetwork | null> {
  const freighter = await loadFreighter()
  if (!freighter) return null

  const networkResult = await freighter.getNetwork()
  if (networkResult.error || !networkResult.network) return null

  return mapFreighterNetwork(networkResult.network)
}

/**
 * Subscribes to Freighter account/network changes (e.g. the user switches accounts).
 *
 * The caller **must** invoke the returned `stop()` to remove the watcher and avoid leaks
 * (`useWallet` does this on disconnect and unmount). Errors emitted by the watcher are
 * swallowed; only successful change events reach `onChange`.
 *
 * @param onChange - Invoked with the new address and mapped network on each change.
 * @returns A `{ stop }` handle, or `null` outside a browser.
 */
export async function createWalletWatcher(
  onChange: (params: { address: string; network: CredenceNetwork | null }) => void
): Promise<{ stop: () => void } | null> {
  const freighter = await loadFreighter()
  if (!freighter) return null

  const watcher = new freighter.WatchWalletChanges()
  watcher.watch((params) => {
    if (params.error) return
    onChange({
      address: params.address,
      network: mapFreighterNetwork(params.network),
    })
  })

  return {
    stop: () => watcher.stop(),
  }
}

/** Resets the cached module — for tests only. */
export function resetFreighterModuleCache(): void {
  freighterModule = null
}
