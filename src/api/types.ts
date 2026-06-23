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

/** A single protocol transaction event visible on the Transactions history page. */
export interface Transaction {
  /** Unique stable identifier for this record. */
  id: string
  /** Protocol action that produced this transaction. */
  type: 'bond' | 'withdraw' | 'attestation'
  /** USDC amount involved, if applicable. */
  amountUsdc?: number
  /** ISO-8601 timestamp of the event. */
  timestamp: string
  /** Settlement state of the on-chain operation. */
  status: 'pending' | 'confirmed' | 'failed'
  /** On-chain transaction hash for the explorer link. */
  hash: string
}

export interface ApiMessageResponse {
  message: string
}
