/**
 * Durable client-side replay guard for wallet-backed actions.
 *
 * Invariants:
 * - Each operation is bound to a caller-provided request key and payload fingerprint.
 * - Safe retries with the same key and fingerprint return the first committed result.
 * - Concurrent duplicates share one in-flight execution.
 * - Reusing a key for a different payload is rejected before side effects run.
 * - Failed or rejected executions are not committed, so a later retry can recover.
 *
 * The backend or wallet contract remains authoritative for balances and ledger state;
 * this guard prevents the frontend from initiating duplicate local effects while a
 * durable server nonce is unavailable in this app layer.
 */

export class IdempotencyConflictError extends Error {
  constructor(readonly requestKey: string) {
    super(`Idempotency key "${requestKey}" was reused for a different operation payload.`)
    this.name = 'IdempotencyConflictError'
  }
}

export interface IdempotentOperationInput<TResult> {
  namespace: string
  requestKey: string
  fingerprint: string
  execute: () => Promise<TResult>
}

interface StoredCommit<TResult> {
  fingerprint: string
  result: TResult
}

const STORAGE_PREFIX = 'credence:idempotent-operation:'
interface InFlightOperation<TResult> {
  fingerprint: string
  promise: Promise<TResult>
}

const inFlight = new Map<string, InFlightOperation<unknown>>()

function storageKey(namespace: string, requestKey: string): string {
  return `${STORAGE_PREFIX}${namespace}:${requestKey}`
}

function readCommit<TResult>(key: string): StoredCommit<TResult> | null {
  if (typeof localStorage === 'undefined') return null

  const raw = localStorage.getItem(key)
  if (!raw) return null

  try {
    return JSON.parse(raw) as StoredCommit<TResult>
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function writeCommit<TResult>(key: string, commit: StoredCommit<TResult>): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(commit))
}

export function resetIdempotentOperationStore(): void {
  inFlight.clear()
  if (typeof localStorage === 'undefined') return

  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      localStorage.removeItem(key)
    }
  }
}

export async function runIdempotentOperation<TResult>({
  namespace,
  requestKey,
  fingerprint,
  execute,
}: IdempotentOperationInput<TResult>): Promise<TResult> {
  const key = storageKey(namespace, requestKey)
  const committed = readCommit<TResult>(key)

  if (committed) {
    if (committed.fingerprint !== fingerprint) {
      throw new IdempotencyConflictError(requestKey)
    }
    return committed.result
  }

  const existing = inFlight.get(key)
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new IdempotencyConflictError(requestKey)
    }
    return existing.promise.then((result) => result as TResult)
  }

  const operation = (async () => {
    try {
      const result = await execute()
      writeCommit(key, { fingerprint, result })
      return result
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, { fingerprint, promise: operation })
  return operation
}
