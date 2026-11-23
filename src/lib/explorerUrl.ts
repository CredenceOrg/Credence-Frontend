import type { CredenceNetwork } from './networkLabels'

/**
 * Maps a CredenceNetwork value to the stellar.expert subdirectory segment.
 *
 * `'test'` is Credence's internal name for Stellar testnet.
 */
function networkSegment(network: CredenceNetwork): string {
  return network === 'test' ? 'testnet' : 'public'
}

/**
 * Builds a stellar.expert URL for a transaction hash or account address.
 *
 * @param network - The active Credence network (`'public'` or `'test'`).
 * @param hash    - The transaction hash or account address.
 * @param kind    - `'tx'` (default) for transactions, `'address'` for accounts.
 * @returns A fully-qualified stellar.expert URL with the hash percent-encoded.
 *
 * @example
 * explorerUrl('test', 'abc123')
 * // → 'https://stellar.expert/explorer/testnet/tx/abc123'
 *
 * explorerUrl('public', 'GABC…', 'address')
 * // → 'https://stellar.expert/explorer/public/account/GABC%E2%80%A6'
 */
export function explorerUrl(
  network: CredenceNetwork,
  hash: string,
  kind: 'tx' | 'address' = 'tx',
): string {
  const seg = networkSegment(network)
  const path = kind === 'address' ? 'account' : 'tx'
  return `https://stellar.expert/explorer/${seg}/${path}/${encodeURIComponent(hash)}`
}
