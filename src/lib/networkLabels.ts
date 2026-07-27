export type CredenceNetwork = 'public' | 'test'

export const NETWORK_LABELS: Record<CredenceNetwork, string> = {
  public: 'Public (Mainnet)',
  test: 'Test (Testnet)',
}

export function getNetworkLabel(network: CredenceNetwork): string {
  return NETWORK_LABELS[network]
}
