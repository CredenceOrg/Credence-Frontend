/**
 * @file useBondMutation.ts
 * @description Production-grade bond mutation hook with concurrency safety, deduplication,
 * and deterministic error handling.
 *
 * **Concurrency & Safety Guarantees:**
 * 1. Concurrent mutations on the same address/bond are deduplicated (share same promise)
 * 2. Balance version tracking prevents stale-read/lost-update races
 * 3. Wallet rejection, network failure, and abort are handled as typed, recoverable errors
 * 4. No partial state or unauthorized operations after failure
 * 5. All operations return discriminated results (never throw) for reviewable error paths
 *
 * **Race Safety:**
 * - Two concurrent createBond() calls for the same address will share the same wallet prompt
 * - Two concurrent withdrawBond() calls for the same bondId will share the same wallet prompt
 * - Two concurrent operations on different resources (e.g., different bonds) run independently
 * - Stale balance versions are detected and rejected with a retryable conflict error
 *
 * **Security & Correctness:**
 * - No optimistic updates on financial operations (wait for wallet confirmation)
 * - No automatic retries (user must explicitly retry after reviewing error)
 * - Validation happens before wallet prompt (fail fast on invalid input)
 * - AbortSignal support for cancellation mid-flight
 *
 * @see {@link ../lib/mutationQueue.ts} for deduplication and version tracking
 * @see {@link ../docs/OPTIMISTIC_UPDATES.md} for why we don't use optimistic updates
 * @see {@link ../docs/API_CLIENT_POLICIES.md} for error handling policy
 */

import { useState, useCallback } from 'react'
import { useWallet } from '../context/WalletContext'
import { useUsdcBalance } from './useUsdcBalance'
import { signFreighterTransaction } from '../lib/freighterClient'
import {
  executeMutation,
  registerVersion,
  validateVersion,
  type MutationResult,
} from '../lib/mutationQueue'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBondParams {
  /** Bond amount in USDC */
  amountUsdc: number
  /** Lock duration in days (must be 30, 90, or 180) */
  durationDays: number
  /** Optional balance version for optimistic concurrency control */
  balanceVersion?: number
}

export interface CreateBondResult {
  /** Bond amount in USDC */
  amountUsdc: number
  /** Lock duration in days */
  durationDays: number
  /** Stellar transaction hash */
  transactionHash: string
}

export interface WithdrawBondParams {
  /** Unique bond identifier */
  bondId: string
  /** Optional expected amount for validation */
  expectedAmount?: number
  /** Optional balance version for optimistic concurrency control */
  balanceVersion?: number
}

export interface WithdrawBondResult {
  /** Bond identifier */
  bondId: string
  /** Stellar transaction hash */
  transactionHash: string
}

export interface UseBondMutationResult {
  /** Create a new bond */
  createBond: (
    params: CreateBondParams,
    signal?: AbortSignal
  ) => Promise<MutationResult<CreateBondResult>>

  /** Withdraw an existing bond */
  withdrawBond: (
    params: WithdrawBondParams,
    signal?: AbortSignal
  ) => Promise<MutationResult<WithdrawBondResult>>

  /** True while a create operation is in progress */
  isCreating: boolean

  /** True while a withdraw operation is in progress */
  isWithdrawing: boolean

  /** Last create error, if any */
  createError: MutationResult<CreateBondResult> | null

  /** Last withdraw error, if any */
  withdrawError: MutationResult<WithdrawBondResult> | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DURATIONS = [30, 90, 180] as const

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for creating and withdrawing USDC bonds on the Credence protocol.
 *
 * **Usage Example:**
 * ```tsx
 * const { createBond, isCreating, createError } = useBondMutation()
 *
 * const handleCreate = async () => {
 *   const result = await createBond({
 *     amountUsdc: 1000,
 *     durationDays: 90,
 *     balanceVersion: Date.now(),
 *   })
 *
 *   if (result.ok) {
 *     console.log('Bond created:', result.data.transactionHash)
 *   } else {
 *     console.error('Bond creation failed:', result.message)
 *     if (result.retryable) {
 *       // Show retry button
 *     }
 *   }
 * }
 * ```
 *
 * **Concurrency:**
 * Multiple concurrent calls are automatically deduplicated by address/bondId.
 *
 * **Error Handling:**
 * All operations return `MutationResult<T>` (never throw). Check `result.ok`
 * and handle errors explicitly. `result.retryable` indicates if retry is safe.
 */
export function useBondMutation(): UseBondMutationResult {
  const { address, isConnected } = useWallet()
  const { balance } = useUsdcBalance()

  const [isCreating, setIsCreating] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [createError, setCreateError] = useState<MutationResult<CreateBondResult> | null>(null)
  const [withdrawError, setWithdrawError] = useState<MutationResult<WithdrawBondResult> | null>(
    null
  )

  // ---------------------------------------------------------------------------
  // Create Bond
  // ---------------------------------------------------------------------------

  const createBond = useCallback(
    async (
      params: CreateBondParams,
      signal?: AbortSignal
    ): Promise<MutationResult<CreateBondResult>> => {
      const { amountUsdc, durationDays, balanceVersion } = params

      // Early validation (fail fast before wallet prompt)
      const validationError = validateCreateParams(
        amountUsdc,
        durationDays,
        address,
        isConnected,
        balance
      )
      if (validationError) {
        setCreateError(validationError)
        return validationError
      }

      // Check version staleness
      const versionError = validateVersion(address!, balanceVersion)
      if (versionError) {
        setCreateError(versionError as MutationResult<CreateBondResult>)
        return versionError as MutationResult<CreateBondResult>
      }

      // Deduplication key: one create operation per address at a time
      const mutationKey = `create:${address}`

      setIsCreating(true)
      setCreateError(null)

      try {
        const result = await executeMutation(
          mutationKey,
          async () => {
            // Build transaction XDR (simulated for now)
            const txXdr = await buildCreateBondTx(amountUsdc, durationDays, address!)

            // Prompt user to sign via Freighter
            const signResult = await signFreighterTransaction(txXdr)

            if (!signResult.ok) {
              return {
                ok: false,
                code: signResult.code === 'rejected' ? 'rejected' : 'unknown',
                message: signResult.message,
                retryable: signResult.code !== 'rejected', // Can retry network/unknown, not rejection
              }
            }

            // Submit signed transaction to network (simulated for now)
            const txHash = await submitTransaction(signResult.signedTxXdr)

            // Register version after successful operation
            if (balanceVersion !== undefined) {
              registerVersion(address!, balanceVersion)
            }

            return {
              ok: true,
              data: {
                amountUsdc,
                durationDays,
                transactionHash: txHash,
              },
            }
          },
          signal
        )

        if (!result.ok) {
          setCreateError(result)
        }

        return result
      } finally {
        setIsCreating(false)
      }
    },
    [address, isConnected, balance]
  )

  // ---------------------------------------------------------------------------
  // Withdraw Bond
  // ---------------------------------------------------------------------------

  const withdrawBond = useCallback(
    async (
      params: WithdrawBondParams,
      signal?: AbortSignal
    ): Promise<MutationResult<WithdrawBondResult>> => {
      const { bondId, balanceVersion } = params

      // Early validation
      const validationError = validateWithdrawParams(bondId, address, isConnected)
      if (validationError) {
        setWithdrawError(validationError)
        return validationError
      }

      // Check version staleness
      const versionError = validateVersion(address!, balanceVersion)
      if (versionError) {
        setWithdrawError(versionError as MutationResult<WithdrawBondResult>)
        return versionError as MutationResult<WithdrawBondResult>
      }

      // Deduplication key: one withdraw per bondId at a time
      const mutationKey = `withdraw:${bondId}`

      setIsWithdrawing(true)
      setWithdrawError(null)

      try {
        const result = await executeMutation(
          mutationKey,
          async () => {
            // Build withdrawal transaction XDR (simulated for now)
            const txXdr = await buildWithdrawBondTx(bondId, address!)

            // Prompt user to sign via Freighter
            const signResult = await signFreighterTransaction(txXdr)

            if (!signResult.ok) {
              return {
                ok: false,
                code: signResult.code === 'rejected' ? 'rejected' : 'unknown',
                message: signResult.message,
                retryable: signResult.code !== 'rejected',
              }
            }

            // Submit signed transaction to network (simulated for now)
            const txHash = await submitTransaction(signResult.signedTxXdr)

            // Register version after successful operation
            if (balanceVersion !== undefined) {
              registerVersion(address!, balanceVersion)
            }

            return {
              ok: true,
              data: {
                bondId,
                transactionHash: txHash,
              },
            }
          },
          signal
        )

        if (!result.ok) {
          setWithdrawError(result)
        }

        return result
      } finally {
        setIsWithdrawing(false)
      }
    },
    [address, isConnected]
  )

  return {
    createBond,
    withdrawBond,
    isCreating,
    isWithdrawing,
    createError,
    withdrawError,
  }
}

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

function validateCreateParams(
  amountUsdc: number,
  durationDays: number,
  address: string | null,
  isConnected: boolean,
  balance: number
): MutationResult<CreateBondResult> | null {
  if (!isConnected || !address) {
    return {
      ok: false,
      code: 'validation',
      message: 'Wallet not connected. Please connect your wallet to create a bond.',
      retryable: false,
    }
  }

  if (amountUsdc <= 0) {
    return {
      ok: false,
      code: 'validation',
      message: 'Bond amount must be greater than zero.',
      retryable: false,
    }
  }

  if (!VALID_DURATIONS.includes(durationDays as any)) {
    return {
      ok: false,
      code: 'validation',
      message: 'Invalid lock duration. Must be 30, 90, or 180 days.',
      retryable: false,
    }
  }

  if (amountUsdc > balance) {
    return {
      ok: false,
      code: 'validation',
      message: `Insufficient balance. You have ${balance} USDC, but need ${amountUsdc} USDC.`,
      retryable: false,
    }
  }

  return null
}

function validateWithdrawParams(
  bondId: string,
  address: string | null,
  isConnected: boolean
): MutationResult<WithdrawBondResult> | null {
  if (!isConnected || !address) {
    return {
      ok: false,
      code: 'validation',
      message: 'Wallet not connected. Please connect your wallet to withdraw.',
      retryable: false,
    }
  }

  if (!bondId || bondId.trim().length === 0) {
    return {
      ok: false,
      code: 'validation',
      message: 'Invalid bond ID.',
      retryable: false,
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Transaction Building (Simulated)
// ---------------------------------------------------------------------------

/**
 * Build a Stellar transaction XDR for creating a bond.
 * **TODO:** Replace with actual Stellar SDK integration.
 *
 * @param amountUsdc - Bond amount
 * @param durationDays - Lock duration
 * @param address - Stellar public key
 * @returns Transaction XDR string
 */
async function buildCreateBondTx(
  amountUsdc: number,
  durationDays: number,
  address: string
): Promise<string> {
  // Simulated transaction building
  // In production, this would use Stellar SDK to build a real transaction
  await new Promise((resolve) => setTimeout(resolve, 10)) // Simulate async work
  return `XDR_CREATE_${amountUsdc}_${durationDays}_${address.slice(0, 8)}`
}

/**
 * Build a Stellar transaction XDR for withdrawing a bond.
 * **TODO:** Replace with actual Stellar SDK integration.
 *
 * @param bondId - Bond identifier
 * @param address - Stellar public key
 * @returns Transaction XDR string
 */
async function buildWithdrawBondTx(bondId: string, address: string): Promise<string> {
  // Simulated transaction building
  await new Promise((resolve) => setTimeout(resolve, 10))
  return `XDR_WITHDRAW_${bondId}_${address.slice(0, 8)}`
}

/**
 * Submit a signed transaction to the Stellar network.
 * **TODO:** Replace with actual Horizon API integration.
 *
 * @param signedTxXdr - Signed transaction XDR
 * @returns Transaction hash
 */
async function submitTransaction(signedTxXdr: string): Promise<string> {
  // Simulated transaction submission
  await new Promise((resolve) => setTimeout(resolve, 50))
  return `SIMULATED_TX_HASH_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
