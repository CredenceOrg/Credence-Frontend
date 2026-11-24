/**
 * @file mutationQueue.ts
 * @description Concurrency control and deduplication layer for financial mutations.
 *
 * Ensures that:
 * 1. Concurrent mutations on the same resource are deduplicated (share the same promise)
 * 2. Balance versions are tracked to detect stale state (optimistic concurrency control)
 * 3. No partial or unauthorized state is left after failure
 * 4. All operations are serializable and deterministic
 *
 * **Security & Correctness Guarantees:**
 * - Deduplication prevents duplicate financial submissions from race conditions
 * - Version registry detects concurrent modifications and rejects stale requests
 * - In-flight tracking ensures only one operation per resource at a time
 * - No automatic retries on financial operations (explicit user action required)
 *
 * @see {@link ../docs/API_CLIENT_POLICIES.md} for retry policy rationale
 * @see {@link ../docs/OPTIMISTIC_UPDATES.md} for why we don't use optimistic updates on bonds
 */

/**
 * Discriminated union result type for mutation operations.
 * All financial operations return this type instead of throwing, allowing
 * callers to handle errors in a type-safe, reviewable way.
 */
export type MutationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      code: 'validation' | 'conflict' | 'rejected' | 'network' | 'cancelled' | 'unknown'
      message: string
      retryable: boolean
    }

/**
 * In-flight mutation registry.
 * Maps resource keys (e.g., "create:address", "withdraw:bondId") to pending promises.
 * When a second request arrives for the same key, we return the existing promise
 * instead of starting a new operation.
 */
const inflightMutations = new Map<string, Promise<MutationResult<any>>>()

/**
 * Balance version registry.
 * Maps wallet addresses to the last seen balance version.
 * Used for optimistic concurrency control: if a caller provides a version
 * that's older than what we've seen, we reject the request as stale.
 */
const versionRegistry = new Map<string, number>()

/**
 * Register a balance version for an address.
 * Call this after successfully creating or withdrawing a bond to track
 * the authoritative state version.
 *
 * @param address - Stellar public key
 * @param version - Monotonically increasing version number (typically timestamp)
 */
export function registerVersion(address: string, version: number): void {
  const current = versionRegistry.get(address)
  if (current === undefined || version > current) {
    versionRegistry.set(address, version)
  }
}

/**
 * Check if a balance version is stale (optimistic concurrency conflict).
 * Returns true if the provided version is older than the last registered version,
 * indicating that the caller's view of the balance is outdated.
 *
 * @param address - Stellar public key
 * @param version - Version to check
 * @returns true if version is stale, false otherwise
 */
export function isVersionStale(address: string, version: number | undefined): boolean {
  if (version === undefined) {
    return false // No version provided, skip check
  }
  const current = versionRegistry.get(address)
  if (current === undefined) {
    return false // No previous version, accept
  }
  return version <= current
}

/**
 * Get the current registered version for an address.
 * Used primarily for testing and debugging.
 *
 * @param address - Stellar public key
 * @returns Current version or undefined if never registered
 */
export function getVersion(address: string): number | undefined {
  return versionRegistry.get(address)
}

/**
 * Clear the version registry.
 * **For tests only.** Do not call in production code.
 */
export function clearVersionRegistry(): void {
  versionRegistry.clear()
}

/**
 * Clear the in-flight mutation registry.
 * **For tests only.** Do not call in production code.
 */
export function clearInflightMutations(): void {
  inflightMutations.clear()
}

/**
 * Check if a mutation is currently in-flight for a given key.
 * Used primarily for testing and debugging.
 *
 * @param key - Resource key (e.g., "create:address", "withdraw:bondId")
 * @returns true if a mutation is in-flight, false otherwise
 */
export function isInflight(key: string): boolean {
  return inflightMutations.has(key)
}

/**
 * Execute a mutation with deduplication and concurrency control.
 *
 * If a mutation with the same key is already in-flight, returns the existing promise.
 * Otherwise, starts a new mutation and registers it in the in-flight registry.
 * Automatically cleans up the registry when the mutation completes (success or failure).
 *
 * **Deduplication guarantee:**
 * Multiple concurrent calls with the same key will return the same promise instance,
 * ensuring the underlying operation only executes once.
 *
 * @param key - Unique resource key for this mutation
 * @param mutationFn - Async function that performs the mutation
 * @param signal - Optional AbortSignal to cancel the operation
 * @returns Promise that resolves to a MutationResult
 */
export async function executeMutation<T>(
  key: string,
  mutationFn: () => Promise<MutationResult<T>>,
  signal?: AbortSignal
): Promise<MutationResult<T>> {
  // Check for abort before starting
  if (signal?.aborted) {
    return {
      ok: false,
      code: 'cancelled',
      message: 'Operation was cancelled before starting.',
      retryable: false,
    }
  }

  // Deduplication: if already in-flight, return existing promise
  const existing = inflightMutations.get(key)
  if (existing) {
    return existing as Promise<MutationResult<T>>
  }

  // Start new mutation
  const promise = (async () => {
    try {
      // Check abort signal again after any async gap
      if (signal?.aborted) {
        return {
          ok: false,
          code: 'cancelled',
          message: 'Operation was cancelled.',
          retryable: false,
        } as MutationResult<T>
      }

      const result = await mutationFn()
      return result
    } catch (error) {
      // Should not reach here if mutationFn properly returns MutationResult
      // But handle gracefully in case of unexpected errors
      return {
        ok: false,
        code: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        retryable: false,
      } as MutationResult<T>
    } finally {
      // Always clean up in-flight registry
      inflightMutations.delete(key)
    }
  })()

  // Register in in-flight registry
  inflightMutations.set(key, promise)

  // Set up abort listener to remove from registry if cancelled mid-flight
  signal?.addEventListener('abort', () => {
    inflightMutations.delete(key)
  })

  return promise
}

/**
 * Validate a balance version for optimistic concurrency control.
 * Returns an error result if the version is stale, otherwise returns null.
 *
 * @param address - Stellar public key
 * @param version - Version to validate
 * @returns Error result if stale, null if valid
 */
export function validateVersion(
  address: string,
  version: number | undefined
): MutationResult<never> | null {
  if (isVersionStale(address, version)) {
    return {
      ok: false,
      code: 'conflict',
      message:
        'Balance version is stale. Another operation has modified the balance. Please refresh and try again.',
      retryable: true,
    }
  }
  return null
}
