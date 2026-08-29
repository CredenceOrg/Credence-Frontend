import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  IdempotencyConflictError,
  resetIdempotentOperationStore,
  runIdempotentOperation,
} from './idempotentOperation'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('runIdempotentOperation', () => {
  beforeEach(() => {
    resetIdempotentOperationStore()
    vi.restoreAllMocks()
  })

  it('returns the first committed result for duplicate safe retries', async () => {
    const execute = vi.fn().mockResolvedValue({ txHash: 'tx-1', balance: 900 })

    const first = await runIdempotentOperation({
      namespace: 'bond:create',
      requestKey: 'request-1',
      fingerprint: 'amount=100',
      execute,
    })
    const retry = await runIdempotentOperation({
      namespace: 'bond:create',
      requestKey: 'request-1',
      fingerprint: 'amount=100',
      execute,
    })

    expect(first).toEqual({ txHash: 'tx-1', balance: 900 })
    expect(retry).toEqual(first)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('shares one in-flight execution for concurrent duplicates', async () => {
    const pending = deferred<{ txHash: string }>()
    const execute = vi.fn().mockReturnValue(pending.promise)

    const first = runIdempotentOperation({
      namespace: 'bond:withdraw',
      requestKey: 'withdraw-1',
      fingerprint: 'bond=1',
      execute,
    })
    const duplicate = runIdempotentOperation({
      namespace: 'bond:withdraw',
      requestKey: 'withdraw-1',
      fingerprint: 'bond=1',
      execute,
    })

    pending.resolve({ txHash: 'withdraw-tx-1' })

    await expect(first).resolves.toEqual({ txHash: 'withdraw-tx-1' })
    await expect(duplicate).resolves.toEqual({ txHash: 'withdraw-tx-1' })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('keeps one committed effect when retries resolve after newer operations', async () => {
    const slow = deferred<{ txHash: string }>()
    const fast = deferred<{ txHash: string }>()
    const slowExecute = vi.fn().mockReturnValue(slow.promise)
    const fastExecute = vi.fn().mockReturnValue(fast.promise)

    const first = runIdempotentOperation({
      namespace: 'trust-score:attestation',
      requestKey: 'attest-1',
      fingerprint: 'subject=A',
      execute: slowExecute,
    })
    const second = runIdempotentOperation({
      namespace: 'trust-score:attestation',
      requestKey: 'attest-2',
      fingerprint: 'subject=B',
      execute: fastExecute,
    })

    fast.resolve({ txHash: 'tx-fast' })
    await expect(second).resolves.toEqual({ txHash: 'tx-fast' })
    slow.resolve({ txHash: 'tx-slow' })
    await expect(first).resolves.toEqual({ txHash: 'tx-slow' })

    const replay = await runIdempotentOperation({
      namespace: 'trust-score:attestation',
      requestKey: 'attest-1',
      fingerprint: 'subject=A',
      execute: slowExecute,
    })

    expect(replay).toEqual({ txHash: 'tx-slow' })
    expect(slowExecute).toHaveBeenCalledTimes(1)
    expect(fastExecute).toHaveBeenCalledTimes(1)
  })

  it('does not commit failed timeout or wallet errors, allowing recovery with the same key', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('wallet timeout'))
      .mockResolvedValueOnce({ txHash: 'recovered-tx' })

    await expect(
      runIdempotentOperation({
        namespace: 'bond:create',
        requestKey: 'retryable',
        fingerprint: 'amount=100',
        execute,
      })
    ).rejects.toThrow('wallet timeout')

    await expect(
      runIdempotentOperation({
        namespace: 'bond:create',
        requestKey: 'retryable',
        fingerprint: 'amount=100',
        execute,
      })
    ).resolves.toEqual({ txHash: 'recovered-tx' })
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('rejects conflicting key reuse before running a second side effect', async () => {
    const execute = vi.fn().mockResolvedValue({ txHash: 'tx-1' })

    await runIdempotentOperation({
      namespace: 'bond:create',
      requestKey: 'same-key',
      fingerprint: 'amount=100',
      execute,
    })

    await expect(
      runIdempotentOperation({
        namespace: 'bond:create',
        requestKey: 'same-key',
        fingerprint: 'amount=200',
        execute,
      })
    ).rejects.toBeInstanceOf(IdempotencyConflictError)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('rejects concurrent conflicting reuse before joining the existing operation', async () => {
    const pending = deferred<{ txHash: string }>()
    const execute = vi.fn().mockReturnValue(pending.promise)

    const original = runIdempotentOperation({
      namespace: 'bond:withdraw',
      requestKey: 'same-key',
      fingerprint: 'bond=1',
      execute,
    })

    await expect(
      runIdempotentOperation({
        namespace: 'bond:withdraw',
        requestKey: 'same-key',
        fingerprint: 'bond=2',
        execute,
      })
    ).rejects.toBeInstanceOf(IdempotencyConflictError)

    pending.resolve({ txHash: 'tx-1' })
    await expect(original).resolves.toEqual({ txHash: 'tx-1' })
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
