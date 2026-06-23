/** Official Freighter browser extension install page. */
export const FREIGHTER_INSTALL_URL = 'https://www.freighter.app/'

import type { CredenceNetwork } from './networkLabels'
export type { CredenceNetwork } from './networkLabels'

type FreighterModule = typeof import('@stellar/freighter-api')

let freighterModule: FreighterModule | null = null

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

export async function checkFreighterInstalled(): Promise<boolean> {
  const freighter = await loadFreighter()
  if (!freighter) return false

  const result = await freighter.isConnected()
  return result.isConnected === true && !result.error
}

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

export async function fetchFreighterAddress(): Promise<string | null> {
  const freighter = await loadFreighter()
  if (!freighter) return null

  const allowed = await freighter.isAllowed()
  if (!allowed.isAllowed || allowed.error) return null

  const addressResult = await freighter.getAddress()
  if (addressResult.error || !addressResult.address) return null

  return addressResult.address
}

export async function fetchFreighterNetwork(): Promise<CredenceNetwork | null> {
  const freighter = await loadFreighter()
  if (!freighter) return null

  const networkResult = await freighter.getNetwork()
  if (networkResult.error || !networkResult.network) return null

  return mapFreighterNetwork(networkResult.network)
}

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
