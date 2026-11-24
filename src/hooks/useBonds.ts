import { useApiQuery, type UseApiQueryResult } from './useApiQuery'
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import type { ApiResponse, Bond, operations } from '../api/types'
import { ApiError } from '../api/client'

const PAGE_SIZE = 100

type BondsResponse = ApiResponse<operations['listBonds']>

export interface UseBondsResult {
  data: Bond[]
  isLoading: boolean
  error: UseApiQueryResult<BondsResponse>['error']
  refetch: () => Promise<void>
}

export interface UseBondsOptions {
  /**
   * Set `false` to skip fetching entirely (e.g. a background feature that is
   * switched off). Defaults to `true`; a connected wallet is still required.
   */
  enabled?: boolean
}

export function useBonds(options: UseBondsOptions = {}): UseBondsResult {
  const { address, network: walletNetwork } = useWallet()
  const { network: settingsNetwork } = useSettings()
  const network = walletNetwork || settingsNetwork
  const query = useApiQuery<BondsResponse>(`/bonds?limit=${PAGE_SIZE}`, {
    enabled: options.enabled !== false && Boolean(address),
    identityKey: `${network}:${address}`,
  })
  const hasInvalidAmount = query.data?.items.some((bond) => {
    const amount = Number(bond.amount)
    return bond.amount.trim() === '' || !Number.isFinite(amount) || amount < 0
  })

  return {
    data: hasInvalidAmount ? [] : (query.data?.items ?? []),
    isLoading: query.isLoading,
    error: query.error ?? (hasInvalidAmount ? new ApiError(502, 'Invalid bond amount') : null),
    refetch: query.refetch,
  }
}
