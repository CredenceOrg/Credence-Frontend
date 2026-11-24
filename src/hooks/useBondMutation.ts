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
import { HorizonError, submitTransaction } from '../lib/horizon'
import { getNetworkPassphrase, type CredenceNetwork } from '../lib/networkLabels'
import { buildCreateBondTransactionXdr, buildWithdrawBondTransactionXdr } from '../lib/stellar'
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
  const { address, isConnected, network } = useWallet()
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

      if (!network) {
        const error: MutationResult<CreateBondResult> = {
          ok: false,
          code: 'validation',
          message: 'Unable to determine the wallet network. Reconnect your wallet and try again.',
          retryable: false,
        }
        setCreateError(error)
        return error
      }

      // Deduplication key: one create operation per address at a time
      const mutationKey = `create:${address}`

      setIsCreating(true)
      setCreateError(null)

      try {
        const result = await executeMutation<CreateBondResult>(
          mutationKey,
          async () => {
            let txXdr: string
            try {
              txXdr = await buildCreateBondTransactionXdr(
                amountUsdc,
                durationDays,
                address!,
                network
              )
            } catch (error) {
              return mapTransactionPreparationFailure(error)
            }

            if (signal?.aborted) return cancelledMutation()

            // Prompt user to sign via Freighter
            const signResult = await signFreighterTransaction(txXdr, {
              networkPassphrase: getNetworkPassphrase(network),
              address: address!,
            })

            if (signal?.aborted) return cancelledMutation()
            if (!signResult.ok) {
              return mapSigningFailure(signResult)
            }

            const submission = await submitBondTransaction(signResult.signedTxXdr, network, signal)
            if (!submission.ok) return submission

            // Register version after successful operation
            if (balanceVersion !== undefined) {
              registerVersion(address!, balanceVersion)
            }

            return {
              ok: true,
              data: {
                amountUsdc,
                durationDays,
                transactionHash: submission.data,
              },
            }
          },
          signal
        )

        if (!result.ok && result.code !== 'cancelled') {
          setCreateError(result)
        }

        return result
      } finally {
        setIsCreating(false)
      }
    },
    [address, isConnected, network, balance]
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

      if (!network) {
        const error: MutationResult<WithdrawBondResult> = {
          ok: false,
          code: 'validation',
          message: 'Unable to determine the wallet network. Reconnect your wallet and try again.',
          retryable: false,
        }
        setWithdrawError(error)
        return error
      }

      // Deduplication key: one withdraw per bondId at a time
      const mutationKey = `withdraw:${bondId}`

      setIsWithdrawing(true)
      setWithdrawError(null)

      try {
        const result = await executeMutation<WithdrawBondResult>(
          mutationKey,
          async () => {
            let txXdr: string
            try {
              txXdr = await buildWithdrawBondTransactionXdr(
                address!,
                network,
                params.expectedAmount
              )
            } catch (error) {
              return mapTransactionPreparationFailure(error)
            }

            if (signal?.aborted) return cancelledMutation()

            // Prompt user to sign via Freighter
            const signResult = await signFreighterTransaction(txXdr, {
              networkPassphrase: getNetworkPassphrase(network),
              address: address!,
            })

            if (signal?.aborted) return cancelledMutation()
            if (!signResult.ok) {
              return mapSigningFailure(signResult)
            }

            const submission = await submitBondTransaction(signResult.signedTxXdr, network, signal)
            if (!submission.ok) return submission

            // Register version after successful operation
            if (balanceVersion !== undefined) {
              registerVersion(address!, balanceVersion)
            }

            return {
              ok: true,
              data: {
                bondId,
                transactionHash: submission.data,
              },
            }
          },
          signal
        )

        if (!result.ok && result.code !== 'cancelled') {
          setWithdrawError(result)
        }

        return result
      } finally {
        setIsWithdrawing(false)
      }
    },
    [address, isConnected, network]
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

  if (!VALID_DURATIONS.some((duration) => duration === durationDays)) {
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
// Mutation Failure Mapping
// ---------------------------------------------------------------------------

type MutationFailure = Extract<MutationResult<never>, { ok: false }>
type SigningFailure = Extract<Awaited<ReturnType<typeof signFreighterTransaction>>, { ok: false }>

function cancelledMutation(): MutationFailure {
  return {
    ok: false,
    code: 'cancelled',
    message: 'Operation was cancelled.',
    retryable: false,
  }
}

function mapTransactionPreparationFailure(
  error: unknown
): MutationFailure {
  if (error instanceof HorizonError) {
    return {
      ok: false,
      code: 'network',
      message: error.message,
      retryable: false,
    }
  }

  return {
    ok: false,
    code: 'unknown',
    message: error instanceof Error ? error.message : 'Unable to prepare the transaction.',
    retryable: false,
  }
}

function mapSigningFailure(error: SigningFailure): MutationFailure {
  if (error.code === 'rejected') {
    return {
      ok: false,
      code: 'cancelled',
      message: error.message,
      retryable: false,
    }
  }

  return {
    ok: false,
    code: error.code === 'not_installed' ? 'rejected' : 'unknown',
    message: error.message,
    retryable: false,
  }
}

async function submitBondTransaction(
  signedTxXdr: string,
  network: CredenceNetwork,
  signal?: AbortSignal
): Promise<MutationResult<string>> {
  try {
    return {
      ok: true,
      data: await submitTransaction(signedTxXdr, network, signal),
    }
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      return {
        ok: false,
        code: 'cancelled',
        message: 'Transaction submission was cancelled.',
        retryable: false,
      }
    }

    if (error instanceof HorizonError) {
      const transactionCode = error.resultCodes?.transaction
      if (transactionCode === 'tx_bad_seq') {
        return {
          ok: false,
          code: 'conflict',
          message: 'The wallet sequence changed. Refresh your account and review the transaction before trying again.',
          retryable: true,
        }
      }

      if (transactionCode === 'tx_insufficient_balance') {
        return {
          ok: false,
          code: 'rejected',
          message: 'The Stellar account does not have enough balance to submit this transaction.',
          retryable: false,
        }
      }

      if (transactionCode === 'tx_failed') {
        return {
          ok: false,
          code: 'network',
          message: 'The network rejected the transaction. Review the bond state before submitting again.',
          retryable: false,
        }
      }
    }

    return {
      ok: false,
      code: 'network',
      message: error instanceof Error ? error.message : 'Unable to submit the transaction.',
      retryable: false,
    }
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}
