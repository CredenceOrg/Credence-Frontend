/**
 * @file mutationStorage.ts
 * @description Versioned storage system for bond and trust-score mutations with deterministic recovery.
 *
 * Design Principles:
 * 1. Forward/backward compatibility through schema versioning
 * 2. Deterministic state recovery under all failure conditions
 * 3. Prevention of duplicate submissions and partial state corruption
 * 4. Resumable operations with observable progress
 * 5. Explicit migration paths with rollback support
 *
 * Storage Schema Evolution:
 * - v1: Initial implementation with basic mutation tracking
 * - v2: Enhanced with operation deduplication and retry policies
 * - Future versions can be added with automatic migration
 *
 * Invariants:
 * - No unauthorized partial state persists across failures
 * - All mutations are idempotent and recoverable
 * - State transitions are atomic and observable
 * - Legacy data is preserved during migrations
 */

import { safeReadJson, safeWriteJson, safeRemoveItem } from './storageJson'
import { logInfo, logWarn, logError } from './log'

// ═══════════════════════════════════════════════════════════════════════════
// Types and Constants
// ═══════════════════════════════════════════════════════════════════════════

export type MutationStatus = 'idle' | 'pending' | 'submitting' | 'success' | 'error' | 'cancelled'
export type MutationType = 'bond_create' | 'bond_withdraw' | 'trust_score_lookup'
export type MutationOperationId = string // UUID or deterministic hash

export interface MutationError {
  type:
    'network' | 'backend' | 'validation' | 'wallet_rejected' | 'timeout' | 'generic' | 'rate_limit'
  message: string
  code?: string | number
  /**
   * Present when `type === 'rate_limit'`: the number of milliseconds before a
   * retry of this exact mutation is likely to succeed, so the UI can show an
   * actionable "retry after Ns" message instead of letting the user hammer.
   */
  retryAfterMs?: number
  timestamp: string
  retryable: boolean
}

export interface MutationAttempt {
  attemptId: string
  timestamp: string
  requestHash: string
  status: MutationStatus
  error?: MutationError
  txHash?: string
  response?: Record<string, unknown>
}

export interface MutationOperation {
  operationId: MutationOperationId
  type: MutationType
  status: MutationStatus

  // Request metadata (no secrets)
  requestHash: string
  requestMetadata: Record<string, unknown>

  // Attempt history
  attempts: MutationAttempt[]
  maxAttempts: number

  // Timestamps
  createdAt: string
  updatedAt: string
  completedAt?: string

  // Final result
  finalTxHash?: string
  finalResponse?: Record<string, unknown>

  // Recovery metadata
  isRecovered: boolean
  recoveredAt?: string
  recoverySource?: 'storage' | 'api' | 'manual'

  /**
   * Bounded, append-only audit trail of every *committed* status transition.
   *
   * Optional and additive: records written by earlier builds simply have no
   * history, and older readers ignore the field, so the v2 schema is
   * unchanged for compatibility purposes. Rejected transitions are never
   * recorded here — the trail only ever contains legal edges, which is what
   * makes the invariant reviewable after the fact.
   */
  statusHistory?: MutationStatusTransition[]
}

/** One committed edge of the state-transition matrix. */
export interface MutationStatusTransition {
  from: MutationStatus
  to: MutationStatus
  at: string
  /** True when this edge was traversed as part of a multi-step reconciliation. */
  indirect?: boolean
}

// Schema versioning for forward/backward compatibility
export interface MutationStorageV2 {
  schemaVersion: 2
  operations: Record<MutationOperationId, MutationOperation>
  metadata: {
    createdAt: string
    /** Set on every write by `writeMutationStorage`. */
    updatedAt?: string
    /** Set when `cleanupStaleOperations` removed at least one operation. */
    lastCleanup?: string
    lastMigration?: {
      fromVersion: number
      toVersion: number
      migratedAt: string
      preservedLegacyData: boolean
    }
  }
}

// Legacy v1 schema for migration compatibility
export interface MutationStorageV1 {
  schemaVersion: 1
  bondActions: {
    create: LegacyBondActionRecord
    withdraw: LegacyBondActionRecord
  }
  trustScoreActions?: {
    lookup: LegacyTrustScoreRecord
  }
}

interface LegacyBondActionRecord {
  status: 'idle' | 'pending' | 'success' | 'error'
  attempts: number
  lastAttemptAt?: string
  lastSuccessAt?: string
  lastError?: {
    type: 'network' | 'backend' | 'validation' | 'generic'
    message: string
    at: string
  }
  lastRequest?: Record<string, unknown>
  lastTxHash?: string
}

interface LegacyTrustScoreRecord {
  status: 'idle' | 'pending' | 'success' | 'error'
  attempts: number
  lastAttemptAt?: string
  lastSuccessAt?: string
  lastError?: {
    type: 'network' | 'backend' | 'validation' | 'generic'
    message: string
    at: string
  }
  lastRequest?: { address: string }
  lastResponse?: Record<string, unknown>
}

// Storage keys
export const MUTATION_STORAGE_V2_KEY = 'credence:mutations:v2'
export const MUTATION_STORAGE_V1_KEY = 'credence:bond-actions:v1' // Reuse existing key
const MUTATION_STORAGE_LEGACY_KEYS = ['credence:bond-actions:v1', 'credence:trust-actions:v1']

// Configuration
const DEFAULT_MAX_ATTEMPTS = 3

const STALE_OPERATION_MS = 24 * 60 * 60 * 1000 // 24 hours

// ═══════════════════════════════════════════════════════════════════════════
// State-Transition Matrix
// ═══════════════════════════════════════════════════════════════════════════
//
// Every bond and trust-score mutation follows the lifecycle:
//
//   idle ──▶ pending ──▶ submitting ──▶ success
//                │            │
//                ▼            ▼
//             error ◀───── error
//                │
//                ▼
//            pending (retry)
//
// Terminal states (no outgoing edges): success, cancelled.
// The matrix is authoritative: any transition not listed here is rejected
// by `updateMutationOperation` and the mutation system will not persist
// unauthorized or partial state.

/**
 * Legal state-transition matrix for `MutationStatus`.
 *
 * Keys are source statuses; values are the set of allowed target statuses.
 * An empty set means the state is terminal (no outgoing transitions).
 * The identity transition (status → same status) is always allowed.
 */
export const LEGAL_TRANSITIONS: ReadonlyMap<MutationStatus, ReadonlySet<MutationStatus>> = new Map([
  // idle: a freshly created operation can only begin execution
  ['idle', new Set(['pending'])],

  // pending: queued for execution; can start, fail validation, or be cancelled
  ['pending', new Set(['submitting', 'error', 'cancelled'])],

  // submitting: in-flight; can succeed, fail permanently, retry (back to pending), or cancel
  ['submitting', new Set(['success', 'error', 'pending', 'cancelled'])],

  // success: terminal – no outgoing transitions allowed
  ['success', new Set()],

  // error: failed; can be retried (back to pending) or cancelled
  ['error', new Set(['pending', 'cancelled'])],

  // cancelled: terminal – no outgoing transitions allowed
  ['cancelled', new Set()],
])

/**
 * Validates whether a state transition is legal under the invariant matrix.
 *
 * @returns `null` if the transition is legal (or a no-op), or a human-readable
 *          violation message if it is illegal.
 */
export function validateStateTransition(from: MutationStatus, to: MutationStatus): string | null {
  // Identity transitions (no actual change) are always valid
  if (from === to) return null

  const allowed = LEGAL_TRANSITIONS.get(from)
  if (!allowed) {
    return `Unknown source status: ${from}`
  }
  if (!allowed.has(to)) {
    return `Illegal state transition: ${from} → ${to}`
  }
  return null
}

/**
 * Statuses with no outgoing edges in the matrix. Once an operation reaches
 * one of these it is immutable with respect to status: no code path — retry,
 * cancel, recovery, migration or legacy mirror — may move it again.
 */
export const TERMINAL_STATUSES: ReadonlySet<MutationStatus> = new Set<MutationStatus>([
  'success',
  'cancelled',
])

/** True when `status` is terminal (see {@link TERMINAL_STATUSES}). */
export function isTerminalStatus(status: MutationStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

/**
 * Resolves the shortest legal path from `from` to `to` through the matrix.
 *
 * This exists because several callers legitimately need to reach a state that
 * is not one edge away — the clearest case being recovery confirming a
 * transaction for an operation still recorded as `pending`, which must travel
 * `pending → submitting → success` rather than jumping straight to `success`.
 * Resolving the path keeps those callers honest: they either traverse real
 * edges of the matrix or they are rejected, and they can never invent one.
 *
 * @returns the target statuses to traverse, **excluding** `from` and
 *          **including** `to` (so an identity transition yields `[]`), or
 *          `null` when `to` is unreachable from `from`.
 */
export function resolveTransitionPath(
  from: MutationStatus,
  to: MutationStatus
): MutationStatus[] | null {
  if (from === to) return []

  // Breadth-first search keeps the result the *shortest* legal path, which
  // matters: a longer path would fabricate lifecycle states the operation
  // never actually occupied.
  const queue: MutationStatus[][] = [[from]]
  const seen = new Set<MutationStatus>([from])

  while (queue.length > 0) {
    const path = queue.shift() as MutationStatus[]
    const tail = path[path.length - 1]

    for (const next of LEGAL_TRANSITIONS.get(tail) ?? []) {
      if (seen.has(next)) continue
      const extended = [...path, next]
      if (next === to) return extended.slice(1)
      seen.add(next)
      queue.push(extended)
    }
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// Authoritative Transition Entry Point
// ═══════════════════════════════════════════════════════════════════════════

/** Why a requested transition was refused. */
export type TransitionRejectionReason =
  'operation_not_found' | 'terminal_state' | 'illegal_transition' | 'unknown_status'

export type MutationTransitionResult =
  | {
      ok: true
      operation: MutationOperation
      /** Edges actually committed, in order. Empty for an identity transition. */
      path: MutationStatus[]
    }
  | {
      ok: false
      reason: TransitionRejectionReason
      message: string
      from: MutationStatus | null
      to: MutationStatus
      /** The unchanged operation, when one exists, so callers can resync. */
      operation: MutationOperation | null
    }

export interface TransitionOptions {
  /**
   * Allow reaching `targetStatus` through intermediate legal states when no
   * direct edge exists (see {@link resolveTransitionPath}). Off by default:
   * ordinary lifecycle code should only ever traverse single edges, and
   * needing more than one is a deliberate reconciliation decision.
   */
  allowIndirect?: boolean
}

/** Keep the audit trail useful without letting it grow without bound. */
const MAX_STATUS_HISTORY = 50

/**
 * The single authoritative entry point for changing a mutation's status.
 *
 * Every status change in the bond and trust-score system goes through here, so
 * the matrix is enforced in exactly one place. The call is all-or-nothing:
 *
 *   • If the transition is legal, the new status **and** every field produced
 *     by `updater` are committed in one write.
 *   • If it is illegal, nothing at all is written — not the status, and not
 *     the updater's other fields. A rejected operation therefore cannot leave
 *     behind a half-applied txHash, error or completion timestamp.
 *
 * Unlike {@link updateMutationOperation}, the outcome is explicit, so callers
 * can report the authoritative result instead of assuming their request won.
 *
 * @param updater produces the non-status fields to commit alongside the
 *   transition. It may not set `status`; the target comes from `targetStatus`.
 */
export function transitionMutationOperation(
  operationId: MutationOperationId,
  targetStatus: MutationStatus,
  updater?: (operation: MutationOperation) => Partial<Omit<MutationOperation, 'status'>>,
  options?: TransitionOptions
): MutationTransitionResult {
  const storage = readMutationStorage()
  const operation = storage.operations[operationId]

  if (!operation) {
    logWarn('mutation_operation_not_found', { operationId })
    return {
      ok: false,
      reason: 'operation_not_found',
      message: `Unknown operation: ${operationId}`,
      from: null,
      to: targetStatus,
      operation: null,
    }
  }

  const from = operation.status

  if (!LEGAL_TRANSITIONS.has(from) || !LEGAL_TRANSITIONS.has(targetStatus)) {
    return reject(operation, 'unknown_status', `Unknown status in ${from} → ${targetStatus}`)
  }

  // Resolve how (and whether) the target can legally be reached.
  let path: MutationStatus[] | null
  if (from === targetStatus) {
    path = []
  } else if (LEGAL_TRANSITIONS.get(from)?.has(targetStatus)) {
    path = [targetStatus]
  } else if (options?.allowIndirect) {
    path = resolveTransitionPath(from, targetStatus)
  } else {
    path = null
  }

  if (path === null) {
    return reject(
      operation,
      isTerminalStatus(from) ? 'terminal_state' : 'illegal_transition',
      isTerminalStatus(from)
        ? `Operation is in terminal state ${from}; ${targetStatus} is unreachable`
        : `Illegal state transition: ${from} → ${targetStatus}`
    )
  }

  // Legal: build the committed record. The updater runs only now, so its
  // side-effect-free output is never persisted for a rejected transition.
  const updates = updater ? updater(operation) : {}
  const at = new Date().toISOString()

  const history = [...(operation.statusHistory ?? [])]
  let cursor = from
  for (const step of path) {
    history.push({ from: cursor, to: step, at, ...(path.length > 1 ? { indirect: true } : {}) })
    cursor = step
  }

  const updatedOperation: MutationOperation = {
    ...operation,
    ...updates,
    status: targetStatus,
    statusHistory: history.slice(-MAX_STATUS_HISTORY),
    updatedAt: at,
  }

  storage.operations[operationId] = updatedOperation
  writeMutationStorage(storage)

  if (path.length > 1) {
    logInfo('mutation_state_transition_indirect', {
      operationId,
      type: operation.type,
      from,
      to: targetStatus,
      path: path.join(' → '),
    })
  }

  return { ok: true, operation: updatedOperation, path }

  function reject(
    op: MutationOperation,
    reason: TransitionRejectionReason,
    message: string
  ): MutationTransitionResult {
    logWarn('mutation_state_transition_violation', {
      operationId,
      type: op.type,
      from: op.status,
      to: targetStatus,
      reason,
      violation: message,
    })
    return { ok: false, reason, message, from: op.status, to: targetStatus, operation: op }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage Operations
// ═══════════════════════════════════════════════════════════════════════════

function createEmptyStorageV2(): MutationStorageV2 {
  return {
    schemaVersion: 2,
    operations: {},
    metadata: {
      createdAt: new Date().toISOString(),
    },
  }
}

let opIdCounter = 0
function generateOperationId(type: MutationType, requestHash: string): MutationOperationId {
  opIdCounter = (opIdCounter + 1) % 1000000
  return `${type}:${requestHash}:${Date.now()}_${opIdCounter}`
}

function generateAttemptId(): string {
  return `attempt:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`
}

function calculateRequestHash(type: MutationType, params: Record<string, unknown>): string {
  // Create deterministic hash of request parameters (excluding timestamps, nonces)
  const sortedParams = Object.keys(params)
    .filter((key) => !['timestamp', 'nonce', 'requestId'].includes(key))
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key]
        return acc
      },
      {} as Record<string, unknown>
    )

  return `${type}:${JSON.stringify(sortedParams)}`
}

// ═══════════════════════════════════════════════════════════════════════════
// Migration System
// ═══════════════════════════════════════════════════════════════════════════

function migrateFromV1(v1Data: MutationStorageV1): MutationStorageV2 {
  const v2Storage = createEmptyStorageV2()

  try {
    // Migrate bond create operations
    if (v1Data.bondActions?.create && v1Data.bondActions.create.status !== 'idle') {
      const legacy = v1Data.bondActions.create
      const operationId = generateOperationId(
        'bond_create',
        `legacy:create:${legacy.lastAttemptAt || Date.now()}`
      )

      v2Storage.operations[operationId] = {
        operationId,
        type: 'bond_create',
        status: mapLegacyStatus(legacy.status),
        requestHash: `legacy:create:${legacy.lastAttemptAt || Date.now()}`,
        requestMetadata: legacy.lastRequest || {},
        attempts: [
          {
            attemptId: generateAttemptId(),
            timestamp: legacy.lastAttemptAt || new Date().toISOString(),
            requestHash: `legacy:create:${legacy.lastAttemptAt || Date.now()}`,
            status: mapLegacyStatus(legacy.status),
            error: legacy.lastError ? mapLegacyError(legacy.lastError) : undefined,
            txHash: legacy.lastTxHash,
          },
        ],
        maxAttempts: Math.max(legacy.attempts || 1, DEFAULT_MAX_ATTEMPTS),
        createdAt: legacy.lastAttemptAt || new Date().toISOString(),
        updatedAt: legacy.lastSuccessAt || legacy.lastAttemptAt || new Date().toISOString(),
        completedAt: legacy.lastSuccessAt,
        finalTxHash: legacy.lastTxHash,
        isRecovered: true,
        recoveredAt: new Date().toISOString(),
        recoverySource: 'storage',
      }
    }

    // Migrate bond withdraw operations
    if (v1Data.bondActions?.withdraw && v1Data.bondActions.withdraw.status !== 'idle') {
      const legacy = v1Data.bondActions.withdraw
      const operationId = generateOperationId(
        'bond_withdraw',
        `legacy:withdraw:${legacy.lastAttemptAt || Date.now()}`
      )

      v2Storage.operations[operationId] = {
        operationId,
        type: 'bond_withdraw',
        status: mapLegacyStatus(legacy.status),
        requestHash: `legacy:withdraw:${legacy.lastAttemptAt || Date.now()}`,
        requestMetadata: legacy.lastRequest || {},
        attempts: [
          {
            attemptId: generateAttemptId(),
            timestamp: legacy.lastAttemptAt || new Date().toISOString(),
            requestHash: `legacy:withdraw:${legacy.lastAttemptAt || Date.now()}`,
            status: mapLegacyStatus(legacy.status),
            error: legacy.lastError ? mapLegacyError(legacy.lastError) : undefined,
            txHash: legacy.lastTxHash,
          },
        ],
        maxAttempts: Math.max(legacy.attempts || 1, DEFAULT_MAX_ATTEMPTS),
        createdAt: legacy.lastAttemptAt || new Date().toISOString(),
        updatedAt: legacy.lastSuccessAt || legacy.lastAttemptAt || new Date().toISOString(),
        completedAt: legacy.lastSuccessAt,
        finalTxHash: legacy.lastTxHash,
        isRecovered: true,
        recoveredAt: new Date().toISOString(),
        recoverySource: 'storage',
      }
    }

    // Migrate trust score operations if present
    if (v1Data.trustScoreActions?.lookup && v1Data.trustScoreActions.lookup.status !== 'idle') {
      const legacy = v1Data.trustScoreActions.lookup
      const operationId = generateOperationId(
        'trust_score_lookup',
        `legacy:lookup:${legacy.lastAttemptAt || Date.now()}`
      )

      v2Storage.operations[operationId] = {
        operationId,
        type: 'trust_score_lookup',
        status: mapLegacyStatus(legacy.status),
        requestHash: `legacy:lookup:${legacy.lastAttemptAt || Date.now()}`,
        requestMetadata: legacy.lastRequest || {},
        attempts: [
          {
            attemptId: generateAttemptId(),
            timestamp: legacy.lastAttemptAt || new Date().toISOString(),
            requestHash: `legacy:lookup:${legacy.lastAttemptAt || Date.now()}`,
            status: mapLegacyStatus(legacy.status),
            error: legacy.lastError ? mapLegacyError(legacy.lastError) : undefined,
            response: legacy.lastResponse,
          },
        ],
        maxAttempts: Math.max(legacy.attempts || 1, DEFAULT_MAX_ATTEMPTS),
        createdAt: legacy.lastAttemptAt || new Date().toISOString(),
        updatedAt: legacy.lastSuccessAt || legacy.lastAttemptAt || new Date().toISOString(),
        completedAt: legacy.lastSuccessAt,
        finalResponse: legacy.lastResponse,
        isRecovered: true,
        recoveredAt: new Date().toISOString(),
        recoverySource: 'storage',
      }
    }

    // Record migration metadata
    v2Storage.metadata.lastMigration = {
      fromVersion: 1,
      toVersion: 2,
      migratedAt: new Date().toISOString(),
      preservedLegacyData: true,
    }

    logInfo('mutation_storage_migrated', {
      from: 1,
      to: 2,
      operationCount: Object.keys(v2Storage.operations).length,
    })

    return v2Storage
  } catch (error) {
    logError('mutation_storage_migration_failed', {
      from: 1,
      to: 2,
      error: error instanceof Error ? error.message : String(error),
    })

    // Return empty storage on migration failure to prevent corruption
    return createEmptyStorageV2()
  }
}

function mapLegacyStatus(legacyStatus: string): MutationStatus {
  switch (legacyStatus) {
    case 'idle':
      return 'idle'
    case 'pending':
      return 'pending'
    case 'success':
      return 'success'
    case 'error':
      return 'error'
    default:
      return 'error'
  }
}

function mapLegacyError(legacyError: { type: string; message: string; at: string }): MutationError {
  return {
    type: legacyError.type as MutationError['type'],
    message: legacyError.message,
    timestamp: legacyError.at,
    retryable: legacyError.type === 'network' || legacyError.type === 'generic',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reads mutation storage with automatic migration and stale operation cleanup.
 */
export function readMutationStorage(): MutationStorageV2 {
  // Try to read v2 storage first
  const v2Result = safeReadJson<MutationStorageV2>(MUTATION_STORAGE_V2_KEY)
  if (v2Result.ok && v2Result.value && v2Result.value.schemaVersion === 2) {
    return cleanupStaleOperations(v2Result.value)
  }

  // Try to read v1 storage for migration
  const v1Result = safeReadJson<MutationStorageV1>(MUTATION_STORAGE_V1_KEY)
  if (v1Result.ok && v1Result.value && v1Result.value.schemaVersion === 1) {
    const migrated = migrateFromV1(v1Result.value)
    const writeResult = safeWriteJson(MUTATION_STORAGE_V2_KEY, migrated)
    if (!writeResult.ok) {
      logWarn('mutation_storage_write_failed_after_migration', {
        error: writeResult.error?.message ?? String(writeResult.error),
      })
    }
    return migrated
  }

  // Return empty storage if no valid data found
  return createEmptyStorageV2()
}

/**
 * Writes mutation storage with atomic updates and rollback protection.
 */
export function writeMutationStorage(storage: MutationStorageV2): void {
  storage.metadata.updatedAt = new Date().toISOString()
  const writeResult = safeWriteJson(MUTATION_STORAGE_V2_KEY, storage)
  if (!writeResult.ok) {
    logWarn('mutation_storage_write_failed', {
      error: writeResult.error?.message ?? String(writeResult.error),
    })
  }
}

/**
 * Removes stale operations to prevent storage bloat and misleading UI states.
 */
function cleanupStaleOperations(storage: MutationStorageV2): MutationStorageV2 {
  const now = Date.now()
  const staleThreshold = now - STALE_OPERATION_MS

  const cleanedOperations: Record<string, MutationOperation> = {}
  let removedCount = 0

  for (const [operationId, operation] of Object.entries(storage.operations)) {
    const operationTime = new Date(operation.updatedAt).getTime()

    // Keep non-stale operations and operations in terminal states
    if (
      operationTime > staleThreshold ||
      operation.status === 'success' ||
      operation.status === 'cancelled'
    ) {
      cleanedOperations[operationId] = operation
    } else {
      removedCount++
    }
  }

  if (removedCount > 0) {
    logInfo('mutation_storage_cleanup', { removedStaleOperations: removedCount })

    return {
      ...storage,
      operations: cleanedOperations,
      metadata: {
        ...storage.metadata,
        lastCleanup: new Date().toISOString(),
      },
    }
  }

  return storage
}

/**
 * Options for creating a mutation operation.
 */
export interface CreateMutationOptions {
  maxAttempts?: number
  /**
   * Optional initial status for migration/historical reconstruction.
   * When provided, the operation is created directly in the given status,
   * bypassing the normal idle-start lifecycle. This is *only* intended for
   * migrating legacy records whose terminal state (e.g. `success`) cannot
   * be reached through the standard idle → pending → … transition chain.
   * Normal code paths must NOT use this option.
   */
  migrationStatus?: MutationStatus
}

/**
 * Creates a new mutation operation with deduplication check.
 *
 * @param options.migrationStatus - When set, the operation is created directly
 *   in the given status (bypassing the transition matrix). Intended only for
 *   migrating legacy records that are already in a terminal state.
 */
export function createMutationOperation(
  type: MutationType,
  params: Record<string, unknown>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  options?: CreateMutationOptions
): { operationId: MutationOperationId; isNewOperation: boolean } {
  const storage = readMutationStorage()
  const requestHash = calculateRequestHash(type, params)

  // Check for existing operation with same request hash.
  //
  // Terminal operations are deliberately excluded. A `success` must not be
  // re-run, and a `cancelled` one must not be resurrected: because `cancelled`
  // has no outgoing edges, deduplicating onto it would hand the caller an
  // operation that can never start again, and the user's repeat request would
  // silently do nothing. Excluding both means a repeat after a cancellation
  // gets a genuinely new, runnable operation.
  const existingOperation = Object.values(storage.operations).find(
    (op) => op.type === type && op.requestHash === requestHash && !isTerminalStatus(op.status)
  )

  if (existingOperation) {
    logInfo('mutation_operation_deduplicated', {
      operationId: existingOperation.operationId,
      type,
      requestHash,
    })
    return { operationId: existingOperation.operationId, isNewOperation: false }
  }

  // Determine initial status: migration callers may supply a terminal status
  // that cannot be reached through the normal idle-start lifecycle.
  const initialStatus: MutationStatus =
    options?.migrationStatus && LEGAL_TRANSITIONS.has(options.migrationStatus)
      ? options.migrationStatus
      : 'idle'

  // Create new operation
  const operationId = generateOperationId(type, requestHash)
  const createdAt = new Date().toISOString()
  const operation: MutationOperation = {
    operationId,
    type,
    status: initialStatus,
    requestHash,
    requestMetadata: { ...params },
    attempts: [],
    maxAttempts,
    createdAt,
    updatedAt: createdAt,
    isRecovered: initialStatus !== 'idle',
    // Seed the audit trail so a migration-reconstructed operation is
    // distinguishable from one that genuinely walked the lifecycle: the entry
    // records that it entered the state directly at creation time.
    statusHistory:
      initialStatus === 'idle'
        ? []
        : [{ from: 'idle', to: initialStatus, at: createdAt, indirect: true }],
  }

  storage.operations[operationId] = operation
  writeMutationStorage(storage)

  logInfo('mutation_operation_created', {
    operationId,
    type,
    requestHash,
    initialStatus,
  })
  return { operationId, isNewOperation: true }
}

/**
 * Updates an existing mutation operation atomically.
 */
export function updateMutationOperation(
  operationId: MutationOperationId,
  updater: (operation: MutationOperation) => Partial<MutationOperation>
): MutationOperation | null {
  const storage = readMutationStorage()
  const operation = storage.operations[operationId]

  if (!operation) {
    logWarn('mutation_operation_not_found', { operationId })
    return null
  }

  const updates = updater(operation)

  // ── Enforce state-transition invariants ─────────────────────────────────
  // A status change delegates to `transitionMutationOperation`, so the matrix
  // is enforced in exactly one place and the committed edge is recorded in the
  // audit trail no matter which API the caller reached for.
  //
  // Illegal transitions are rejected: the original (unmodified) operation is
  // returned so callers can still read the current state, but nothing is
  // persisted — not the status, and not the updater's other fields. This
  // guarantees:
  //   • Terminal states (success, cancelled) never leave their state.
  //   • No partial or unauthorized state can survive across any path.
  if (updates.status !== undefined && updates.status !== operation.status) {
    const { status: targetStatus, ...rest } = updates
    const result = transitionMutationOperation(operationId, targetStatus, () => rest)
    // On rejection, hand back the unchanged operation (unchanged contract).
    return result.ok ? result.operation : result.operation
  }

  const updatedOperation: MutationOperation = {
    ...operation,
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  storage.operations[operationId] = updatedOperation
  writeMutationStorage(storage)

  return updatedOperation
}

/**
 * Gets all operations of a specific type, optionally filtered by status.
 */
export function getMutationOperations(
  type?: MutationType,
  status?: MutationStatus
): MutationOperation[] {
  const storage = readMutationStorage()
  const operations = Object.values(storage.operations)

  let filtered = operations
  if (type) {
    filtered = filtered.filter((op) => op.type === type)
  }
  if (status) {
    filtered = filtered.filter((op) => op.status === status)
  }

  return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Pagination and Cursor Semantics
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const MUTATION_CURSOR_VERSION = 1 as const
export const DEFAULT_MUTATION_PAGE_LIMIT = 20
export const MIN_MUTATION_PAGE_LIMIT = 1
export const MAX_MUTATION_PAGE_LIMIT = 100

export interface MutationCursorPayload {
  version: typeof MUTATION_CURSOR_VERSION
  updatedAt: string
  operationId: string
  type?: MutationType
  status?: MutationStatus
  scope?: string
  order?: 'desc' | 'asc'
}

export interface PaginateMutationOptions {
  type?: MutationType
  status?: MutationStatus
  scope?: string
  limit?: number
  cursor?: string
  order?: 'desc' | 'asc'
}

export interface PaginatedMutationResult {
  items: MutationOperation[]
  nextCursor?: string
  hasNextPage: boolean
  totalCount: number
  limit: number
  appliedScope?: string
}

export function encodeMutationCursor(
  payload: Omit<MutationCursorPayload, 'version'> & { version?: typeof MUTATION_CURSOR_VERSION }
): string {
  const versionedPayload: MutationCursorPayload = {
    version: MUTATION_CURSOR_VERSION,
    ...payload,
  }
  const jsonStr = JSON.stringify(versionedPayload)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(jsonStr, 'utf-8').toString('base64url')
  }
  return btoa(jsonStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeMutationCursor(cursor: string): MutationCursorPayload | null {
  if (!cursor || typeof cursor !== 'string') return null
  try {
    let jsonStr: string
    if (typeof Buffer !== 'undefined') {
      jsonStr = Buffer.from(cursor, 'base64url').toString('utf-8')
    } else {
      const padded =
        cursor.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((cursor.length + 3) % 4)
      jsonStr = atob(padded)
    }
    const parsed = JSON.parse(jsonStr)
    if (
      parsed &&
      parsed.version === MUTATION_CURSOR_VERSION &&
      typeof parsed.updatedAt === 'string' &&
      typeof parsed.operationId === 'string'
    ) {
      return parsed as MutationCursorPayload
    }
    return null
  } catch {
    return null
  }
}

export function validateMutationCursor(
  cursor: string,
  expectedOptions: {
    type?: MutationType
    status?: MutationStatus
    scope?: string
    order?: 'desc' | 'asc'
  }
): { valid: boolean; payload?: MutationCursorPayload; error?: string } {
  const payload = decodeMutationCursor(cursor)
  if (!payload) {
    return { valid: false, error: 'Invalid or malformed cursor format' }
  }
  if (expectedOptions.type && payload.type && payload.type !== expectedOptions.type) {
    return {
      valid: false,
      error: `Cursor scope mismatch: expected type ${expectedOptions.type}, got ${payload.type}`,
    }
  }
  if (expectedOptions.status && payload.status && payload.status !== expectedOptions.status) {
    return {
      valid: false,
      error: `Cursor scope mismatch: expected status ${expectedOptions.status}, got ${payload.status}`,
    }
  }
  if (expectedOptions.scope && payload.scope && payload.scope !== expectedOptions.scope) {
    return {
      valid: false,
      error: `Cursor scope mismatch: expected scope ${expectedOptions.scope}, got ${payload.scope}`,
    }
  }
  if (expectedOptions.order && payload.order && payload.order !== expectedOptions.order) {
    return {
      valid: false,
      error: `Cursor order mismatch: expected order ${expectedOptions.order}, got ${payload.order}`,
    }
  }
  return { valid: true, payload }
}

function compareOperations(
  a: { updatedAt: string; operationId: string },
  b: { updatedAt: string; operationId: string },
  order: 'desc' | 'asc' = 'desc'
): number {
  const timeA = new Date(a.updatedAt).getTime()
  const timeB = new Date(b.updatedAt).getTime()
  if (timeA !== timeB) {
    return order === 'desc' ? timeB - timeA : timeA - timeB
  }
  return order === 'desc'
    ? b.operationId.localeCompare(a.operationId)
    : a.operationId.localeCompare(b.operationId)
}

function clampLimit(limit?: number): number {
  if (typeof limit !== 'number' || isNaN(limit) || !isFinite(limit)) {
    return DEFAULT_MUTATION_PAGE_LIMIT
  }
  const intLimit = Math.floor(limit)
  if (intLimit < MIN_MUTATION_PAGE_LIMIT) return MIN_MUTATION_PAGE_LIMIT
  if (intLimit > MAX_MUTATION_PAGE_LIMIT) return MAX_MUTATION_PAGE_LIMIT
  return intLimit
}

/**
 * Deterministic, scope-safe cursor pagination for bond and trust-score mutations.
 */
export function paginateMutationOperations(
  options: PaginateMutationOptions = {}
): PaginatedMutationResult {
  const { type, status, scope, cursor, order = 'desc' } = options
  const limit = clampLimit(options.limit)

  const storage = readMutationStorage()
  let operations = Object.values(storage.operations)

  // Filter by type
  if (type) {
    operations = operations.filter((op) => op.type === type)
  }

  // Filter by status
  if (status) {
    operations = operations.filter((op) => op.status === status)
  }

  // Filter by scope (e.g. address or metadata scope)
  if (scope) {
    operations = operations.filter((op) => {
      const metadata = op.requestMetadata || {}
      return (
        metadata.address === scope ||
        metadata.account === scope ||
        metadata.scope === scope ||
        op.operationId.includes(scope)
      )
    })
  }

  const totalCount = operations.length

  // Sort deterministically by (updatedAt, operationId tiebreaker)
  operations.sort((a, b) => compareOperations(a, b, order))

  // Handle cursor if provided
  let sliced = operations
  if (cursor) {
    const validation = validateMutationCursor(cursor, { type, status, scope, order })
    if (!validation.valid || !validation.payload) {
      logWarn('invalid_mutation_cursor_provided', { cursor, error: validation.error })
      // Safe fallback: return empty page without nextCursor on invalid or scope-mismatched cursor
      return {
        items: [],
        nextCursor: undefined,
        hasNextPage: false,
        totalCount,
        limit,
        appliedScope: scope,
      }
    }

    const { updatedAt: cTs, operationId: cId } = validation.payload
    sliced = operations.filter((op) => {
      const opTime = new Date(op.updatedAt).getTime()
      const cTime = new Date(cTs).getTime()
      if (order === 'desc') {
        if (opTime < cTime) return true
        if (opTime === cTime) return op.operationId.localeCompare(cId) < 0
        return false
      } else {
        if (opTime > cTime) return true
        if (opTime === cTime) return op.operationId.localeCompare(cId) > 0
        return false
      }
    })
  }

  // Slice up to limit
  const items = sliced.slice(0, limit)
  const hasNextPage = sliced.length > limit

  let nextCursor: string | undefined
  if (hasNextPage && items.length > 0) {
    const lastItem = items[items.length - 1]
    nextCursor = encodeMutationCursor({
      version: MUTATION_CURSOR_VERSION,
      updatedAt: lastItem.updatedAt,
      operationId: lastItem.operationId,
      type,
      status,
      scope,
      order,
    })
  }

  return {
    items,
    nextCursor,
    hasNextPage,
    totalCount,
    limit,
    appliedScope: scope,
  }
}

/**
 * Gets a specific operation by ID.
 */
export function getMutationOperation(operationId: MutationOperationId): MutationOperation | null {
  const storage = readMutationStorage()
  return storage.operations[operationId] || null
}

/**
 * Removes completed or cancelled operations (manual cleanup).
 */
export function cleanupCompletedOperations(): number {
  const storage = readMutationStorage()
  const completedStatuses: MutationStatus[] = ['success', 'cancelled']

  const toRemove = Object.entries(storage.operations).filter(([, op]) =>
    completedStatuses.includes(op.status)
  )

  for (const [operationId] of toRemove) {
    delete storage.operations[operationId]
  }

  if (toRemove.length > 0) {
    writeMutationStorage(storage)
    logInfo('mutation_storage_manual_cleanup', { removedOperations: toRemove.length })
  }

  return toRemove.length
}

/**
 * Emergency function to reset all mutation storage (destructive).
 */
export function resetMutationStorage(): void {
  const removeResult = safeRemoveItem(MUTATION_STORAGE_V2_KEY)
  if (!removeResult.ok) {
    logWarn('mutation_storage_reset_failed', {
      error: removeResult.error?.message || 'Unknown error',
    })
  }

  // Also clean up legacy keys
  for (const key of MUTATION_STORAGE_LEGACY_KEYS) {
    safeRemoveItem(key) // Best effort, ignore failures
  }

  logInfo('mutation_storage_reset', { timestamp: new Date().toISOString() })
}

/**
 * Export functions for testing and diagnostics.
 */
export const __testing__ = {
  generateOperationId,
  calculateRequestHash,
  mapLegacyStatus,
  cleanupStaleOperations,
  compareOperations,
  clampLimit,
  STALE_OPERATION_MS,
  DEFAULT_MAX_ATTEMPTS,
}
