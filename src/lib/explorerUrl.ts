/**
 * Builds a Stellar Expert / Horizon explorer URL for a transaction hash.
 *
 * @param network - The Credence network setting: `'public'` or `'testnet'`
 * @param hash - The on-chain transaction hash
 * @returns A fully-qualified URL string pointing to the transaction on Stellar Expert
 */
export function explorerUrl(network: string, hash: string): string {
  const base =
    network === 'testnet'
      ? 'https://stellar.expert/explorer/testnet/tx'
      : 'https://stellar.expert/explorer/public/tx'
  return `${base}/${encodeURIComponent(hash)}`
}
