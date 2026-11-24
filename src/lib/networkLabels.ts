export type CredenceNetwork = 'public' | 'test'

export const NETWORK_LABELS: Record<CredenceNetwork, string> = {
  public: 'Public (Mainnet)',
  test: 'Test (Testnet)',
}

export const NETWORK_PASSPHRASES: Record<CredenceNetwork, string> = {
  public: 'Public Global Stellar Network ; September 2015',
  test: 'Test SDF Network ; September 2015',
}

export function getNetworkLabel(network: CredenceNetwork): string {
  return NETWORK_LABELS[network]
}

export function getNetworkPassphrase(network: CredenceNetwork): string {
  return NETWORK_PASSPHRASES[network]
}
