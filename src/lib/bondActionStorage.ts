/**
 * @file bondActionStorage.ts
 * @description Enhanced bond action storage with migration to unified mutation system.
 *
 * This module provides backward compatibility for existing bond operations while
 * migrating to the new unified mutation storage system. It serves as a bridge
 * between the legacy storage format and the new versioned mutation system.
 *
 * Migration Path:
 * 1. Legacy v1 bond actions continue to work through compatibility layer
 * 2. New operations automatically use the unified mutation system
 * 3. Existing operations are migrated on first access
 * 4. Legacy storage is preserved for rollback compatibility
 */

import { safeReadJson, safeWriteJson } from './storageJson'
import {
  createMutationOperation,
  updateMutationOperation,
  getMutationOperations,
  type MutationOperationId,
  type MutationOperation,
} from './mutationStorage'
import { logInfo, logWarn } from './log'

// ═══════════════════════════════════════════════════════════════════════════
// Legacy Types (maintained for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

export type BondActionStatus = 'idle' | 'pending' | 'success' | 'error'
export type BondActionKind = 'create' | 'withdraw'

export type BondActionError = {
  type: 'network' | 'backend' | 'validation' | 'generic'
  message: string
  at: string
}

export type BondActionRecord = {
  status: BondActionStatus
  attempts: number
  lastAttemptAt?: string
  lastSuccessAt?: string
  lastError?: BondActionError
  // Minimal request metadata (no secrets); helps users reason about what they were doing.
  lastRequest?: Record<string, unknown>
  // Authoritative tx hash returned by the submit step (even if later unconfirmed).
  lastTxHash?: string
  // New fields for mutation system integration
  operationId?: MutationOperationId
  migratedToV2?: boolean
}

type BondActionsV1 = {
  schemaVersion: 1
  create: BondActionRecord
  withdraw: BondActionRecord
  // Migration metadata
  migrationStatus?: {
    migratedAt?: string
    preservedLegacyData?: boolean
  }
}

export const BOND_ACTIONS_V1_KEY = 'credence:bond-actions:v1'

const emptyRecord: BondActionRecord = { status: 'idle', attempts: 0 }

function defaultStore(): BondActionsV1 {
  return { schemaVersion: 1, create: { ...emptyRecord }, withdraw: { ...emptyRecord } }
}

// ═══════════════════════════════════════════════════════════════════════════
// Enhanced Storage Operations with Migration Support
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reads bond actions with automatic migration to unified mutation system.
 *
 * This function maintains backward compatibility while progressively migrating
 * operations to the new system. Legacy operations are migrated on first access
 * and linked to their corresponding mutation operations.
 */
export function readBondActions(autoMigrate: boolean = true): BondActionsV1 {
  const res = safeReadJson<BondActionsV1>(BOND_ACTIONS_V1_KEY)
  let bondActions: BondActionsV1

  if (!res.ok || !res.value || res.value.schemaVersion !== 1) {
    bondActions = defaultStore()
  } else {
    // Shallow coercion to keep compatibility with missing fields
    bondActions = {
      schemaVersion: 1,
      create: { ...emptyRecord, ...(res.value.create ?? {}) },
      withdraw: { ...emptyRecord, ...(res.value.withdraw ?? {}) },
      migrationStatus: res.value.migrationStatus,
    }
  }

  if (!autoMigrate) {
    return bondActions
  }

  // Check if we need to perform migration for non-idle operations
  let needsMigration = false
  const updatedBondActions = { ...bondActions }

  for (const kind of ['create', 'withdraw'] as const) {
    const record = bondActions[kind]

    if (record.status !== 'idle' && !record.migratedToV2 && !record.operationId) {
      // Migrate this operation to the unified system
      const migratedRecord = migrateRecordToMutationSystem(record, kind)
      if (migratedRecord) {
        updatedBondActions[kind] = migratedRecord
        needsMigration = true
      }
    }
  }

  if (needsMigration) {
    updatedBondActions.migrationStatus = {
      migratedAt: new Date().toISOString(),
      preservedLegacyData: true,
    }

    writeBondActions(updatedBondActions)
    logInfo('bond_actions_partial_migration', {
      createMigrated: updatedBondActions.create.migratedToV2,
      withdrawMigrated: updatedBondActions.withdraw.migratedToV2,
    })
  }

  return updatedBondActions
}

/**
 * Migrates a legacy bond action record to the unified mutation system.
 */
function migrateRecordToMutationSystem(
  record: BondActionRecord,
  kind: BondActionKind
): BondActionRecord | null {
  try {
    const mutationType = kind === 'create' ? 'bond_create' : 'bond_withdraw'
    const params = record.lastRequest || {}
    const targetStatus = mapLegacyStatusToMutation(record.status)

    // Create operation in the unified system. For terminal states (success,
    // cancelled) that cannot be reached through idle → pending → …, we pass
    // migrationStatus so the operation is created directly in the target state.
    // This is the only code path that bypasses the normal lifecycle — all
    // other callers must go through idle.
    const { operationId } = createMutationOperation(mutationType, params, 3, {
      migrationStatus: targetStatus,
    })

    // Fill in the attempt history to reconstruct the legacy state. The
    // operation was created with the correct status via migrationStatus,
    // so no further status transitions are needed.
    const operation = updateMutationOperation(operationId, (op) => ({
      attempts: [
        {
          attemptId: `legacy:${kind}:${Date.now()}`,
          timestamp: record.lastAttemptAt || new Date().toISOString(),
          requestHash: op.requestHash,
          status: mapLegacyStatusToMutation(record.status),
          error: record.lastError
            ? {
                type: record.lastError.type as
                  | 'network'
                  | 'backend'
                  | 'validation'
                  | 'wallet_rejected'
                  | 'timeout'
                  | 'generic'
                  | 'rate_limit',
                message: record.lastError.message,
                timestamp: record.lastError.at,
                retryable:
                  record.lastError.type === 'network' || record.lastError.type === 'generic',
              }
            : undefined,
          txHash: record.lastTxHash,
        },
      ],
      completedAt: record.lastSuccessAt,
      finalTxHash: record.lastTxHash,
      isRecovered: true,
      recoveredAt: new Date().toISOString(),
      recoverySource: 'storage' as const,
    }))

    if (operation) {
      return {
        ...record,
        operationId,
        migratedToV2: true,
      }
    }

    return null
  } catch (error) {
    logWarn('bond_action_migration_failed', {
      kind,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function mapLegacyStatusToMutation(status: BondActionStatus): MutationOperation['status'] {
  switch (status) {
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

/**
 * Writes bond actions with preservation of migration state.
 */
export function writeBondActions(next: BondActionsV1): void {
  safeWriteJson(BOND_ACTIONS_V1_KEY, next)
}

/**
 * Updates a bond action with automatic integration to mutation system.
 *
 * For new operations, this creates entries in both the legacy and unified systems.
 * For existing migrated operations, this updates both systems consistently.
 */
export function updateBondAction(
  kind: BondActionKind,
  updater: (current: BondActionRecord) => BondActionRecord
): BondActionsV1 {
  const current = readBondActions(false)
  const record = kind === 'create' ? current.create : current.withdraw
  const updated = updater(record)

  // If this operation is linked to the mutation system, update both
  if (updated.operationId) {
    updateMutationOperation(updated.operationId, (op) => ({
      status: mapLegacyStatusToMutation(updated.status),
      updatedAt: new Date().toISOString(),
      completedAt: updated.lastSuccessAt,
      finalTxHash: updated.lastTxHash,
      // Add new attempt if status changed to error or success
      attempts:
        updated.lastAttemptAt !== record.lastAttemptAt
          ? [
              ...op.attempts,
              {
                attemptId: `legacy-update:${Date.now()}`,
                timestamp: updated.lastAttemptAt || new Date().toISOString(),
                requestHash: op.requestHash,
                status: mapLegacyStatusToMutation(updated.status),
                error: updated.lastError
                  ? {
                      type: updated.lastError.type as
                        | 'network'
                        | 'backend'
                        | 'validation'
                        | 'wallet_rejected'
                        | 'timeout'
                        | 'generic'
                        | 'rate_limit',
                      message: updated.lastError.message,
                      timestamp: updated.lastError.at,
                      retryable:
                        updated.lastError.type === 'network' ||
                        updated.lastError.type === 'generic',
                    }
                  : undefined,
                txHash: updated.lastTxHash,
              },
            ]
          : op.attempts,
    }))
  }

  const next: BondActionsV1 =
    kind === 'create' ? { ...current, create: updated } : { ...current, withdraw: updated }

  writeBondActions(next)
  return next
}

// ═══════════════════════════════════════════════════════════════════════════
// Enhanced Bond Operations Integration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Enhanced bond action creation that integrates with the unified mutation system.
 *
 * This function creates operations in both the legacy format (for backward compatibility)
 * and the new unified mutation system (for enhanced features).
 */
export function createEnhancedBondAction(
  kind: BondActionKind,
  params: Record<string, unknown>
): { legacyUpdated: BondActionsV1; operationId: MutationOperationId; isNewOperation: boolean } {
  const mutationType = kind === 'create' ? 'bond_create' : 'bond_withdraw'

  // Create operation in unified system
  const { operationId, isNewOperation } = createMutationOperation(mutationType, params, 3)

  // Update legacy system to link to the new operation
  const legacyUpdated = updateBondAction(kind, (current) => ({
    ...current,
    status: 'pending',
    attempts: current.attempts + (isNewOperation ? 1 : 0),
    lastAttemptAt: new Date().toISOString(),
    lastRequest: params,
    operationId,
    migratedToV2: true,
  }))

  logInfo('enhanced_bond_action_created', {
    kind,
    operationId,
    isNewOperation,
  })

  return { legacyUpdated, operationId, isNewOperation }
}

/**
 * Gets the unified mutation operation for a bond action.
 */
export function getBondActionMutationOperation(kind: BondActionKind): MutationOperation | null {
  const bondActions = readBondActions(false)
  const record = kind === 'create' ? bondActions.create : bondActions.withdraw

  if (!record.operationId) {
    return null
  }

  // Find the corresponding mutation operation
  const operations = getMutationOperations(kind === 'create' ? 'bond_create' : 'bond_withdraw')

  return operations.find((op) => op.operationId === record.operationId) || null
}

/**
 * Checks if bond actions have been migrated to the unified system.
 */
export function getBondActionMigrationStatus(): {
  createMigrated: boolean
  withdrawMigrated: boolean
  migrationTimestamp?: string
} {
  const bondActions = readBondActions(false)

  return {
    createMigrated: !!bondActions.create.migratedToV2,
    withdrawMigrated: !!bondActions.withdraw.migratedToV2,
    migrationTimestamp: bondActions.migrationStatus?.migratedAt,
  }
}

/**
 * Forces migration of all bond actions to the unified system.
 * This is useful for testing and ensuring complete migration.
 */
export function forceBondActionsMigration(): {
  migrated: number
  failed: number
  operations: MutationOperationId[]
} {
  const bondActions = readBondActions(false)
  const results = { migrated: 0, failed: 0, operations: [] as MutationOperationId[] }

  for (const kind of ['create', 'withdraw'] as const) {
    const record = bondActions[kind]

    if (record.status !== 'idle' && !record.migratedToV2) {
      const migrated = migrateRecordToMutationSystem(record, kind)
      if (migrated) {
        // Update the record in storage
        updateBondAction(kind, () => migrated)
        results.migrated++
        if (migrated.operationId) {
          results.operations.push(migrated.operationId)
        }
      } else {
        results.failed++
      }
    }
  }

  if (results.migrated > 0 || results.failed > 0) {
    logInfo('bond_actions_force_migration', {
      migratedCount: results.migrated,
      failedCount: results.failed,
      operationsCount: results.operations.length,
    })
  }

  return results
}

// ═══════════════════════════════════════════════════════════════════════════
// Backward Compatibility Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Legacy function wrapper that maintains existing API while adding migration support.
 * This ensures existing code continues to work without modification.
 */
export function readBondActionsLegacy(): BondActionsV1 {
  return readBondActions()
}

/**
 * Legacy function wrapper for updating bond actions.
 */
export function updateBondActionLegacy(
  kind: BondActionKind,
  updater: (current: BondActionRecord) => BondActionRecord
): BondActionsV1 {
  return updateBondAction(kind, updater)
}

/**
 * Export for testing and diagnostics.
 */
export const __testing__ = {
  migrateRecordToMutationSystem,
  mapLegacyStatusToMutation,
  defaultStore,
}
