export function getExplorerTxUrl(network: string, hash: string): string {
  // map common generic network names to stellar.expert paths
  let explorerNetwork = 'public'
  const netLower = network.toLowerCase()
  if (netLower.includes('test')) {
    explorerNetwork = 'testnet'
  } else if (netLower.includes('future')) {
    explorerNetwork = 'futurenet'
  }
  
  return `https://stellar.expert/explorer/${explorerNetwork}/tx/${hash}`
}
