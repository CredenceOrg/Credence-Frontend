export type BondStatus = 'active' | 'pending' | 'settled' | 'slashed' | 'cancelled'

export type TrustTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface TrustScore {
  address: string
  score: number
  tier: TrustTier
  attestations: number
  updatedAt: string
}

export interface Bond {
  id: string
  borrower: string
  lender?: string
  amount: string
  asset: string
  status: BondStatus
  createdAt: string
  maturesAt?: string
}

export interface ApiListResponse<T> {
  items: T[]
  nextCursor?: string
}

export interface ApiMessageResponse {
  message: string
}
