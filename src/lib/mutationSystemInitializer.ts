/**
 * @file mutationSystemInitializer.ts
 * @description System initializer for the enhanced mutation storage and recovery system.
 *
 * This module provides centralized initialization and lifecycle management for
 * the mutation system, ensuring proper startup sequencing and graceful shutdown.
 * It coordinates between storage migration, recovery engine startup, and
 * integration with existing application patterns.
 */

import {
  readMutationStorage,
  writeMutationStorage,
  cleanupCompletedOperations,
} from './mutationStorage'
import {
  initializeMutationRecovery,
  shutdownMutationRecovery,
  mutationRecoveryEngine,
} from './mutationRecovery'
import { forceBondActionsMigration } from './bondActionStorage'
import { logInfo, logError } from './log'

// ═══════════════════════════════════════════════════════════════════════════
// Initialization Configuration
// ═══════════════════════════════════════════════════════════════════════════

export interface MutationSystemConfig {
  /** Whether to force migration of all legacy data on startup */
  forceMigration?: boolean
  /** Whether to clean up completed operations on startup */
  cleanupCompleted?: boolean
  /** Maximum age in milliseconds for operations to keep */
  maxOperationAge?: number
  /** Whether to enable automatic recovery on startup */
  enableAutoRecovery?: boolean
  /** Whether to log detailed initialization steps */
  verboseLogging?: boolean
}

export interface InitializationResult {
  success: boolean
  migrationResults?: {
    bondActionsMigrated: number
    operationsRecovered: number
  }
  cleanupResults?: {
    operationsRemoved: number
  }
  errors: string[]
  warnings: string[]
  duration: number
}

const DEFAULT_CONFIG: Required<MutationSystemConfig> = {
  forceMigration: false,
  cleanupCompleted: false,
  maxOperationAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  enableAutoRecovery: true,
  verboseLogging: false,
}

// ═══════════════════════════════════════════════════════════════════════════
// System State Management
// ═══════════════════════════════════════════════════════════════════════════

let isInitialized = false
let initializationPromise: Promise<InitializationResult> | null = null
let shutdownPromise: Promise<void> | null = null

// ═══════════════════════════════════════════════════════════════════════════
// Initialization Logic
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Initializes the mutation system with migration, recovery, and cleanup.
 *
 * This function is idempotent - multiple calls will return the same promise
 * until the system is shut down and reinitialized.
 */
export function initializeMutationSystem(
  config: MutationSystemConfig = {}
): Promise<InitializationResult> {
  // Return existing initialization if in progress or completed
  if (initializationPromise) {
    return initializationPromise
  }

  // Create new initialization promise
  initializationPromise = performInitialization({ ...DEFAULT_CONFIG, ...config })
    .then((result) => {
      isInitialized = result.success
      return result
    })
    .catch((error) => {
      initializationPromise = null
      throw error
    })

  return initializationPromise
}

async function performInitialization(
  config: Required<MutationSystemConfig>
): Promise<InitializationResult> {
  const startTime = Date.now()
  const result: InitializationResult = {
    success: false,
    errors: [],
    warnings: [],
    duration: 0,
  }

  if (config.verboseLogging) {
    logInfo('mutation_system_initialization_started', {
      enableAutoRecovery: config.enableAutoRecovery,
      cleanupCompleted: config.cleanupCompleted,
      forceMigration: config.forceMigration,
    })
  }

  try {
    // Step 1: Verify and initialize storage
    await initializeStorage(config, result)

    // Step 2: Perform migrations if requested
    if (config.forceMigration) {
      await performMigrations(config, result)
    }

    // Step 3: Clean up old operations if requested
    if (config.cleanupCompleted) {
      await performCleanup(config, result)
    }

    // Step 4: Initialize recovery system
    if (config.enableAutoRecovery) {
      await initializeRecoverySystem(config, result)
    }

    // Step 5: Validate system state
    await validateSystemState(config, result)

    result.success = result.errors.length === 0
    result.duration = Math.max(1, Date.now() - startTime)

    if (result.success) {
      logInfo('mutation_system_initialization_completed', {
        duration: result.duration,
        migrations: result.migrationResults,
        cleanup: result.cleanupResults,
        warnings: result.warnings.length,
      })
    } else {
      logError('mutation_system_initialization_failed', {
        duration: result.duration,
        errors: result.errors,
        warnings: result.warnings,
      })
    }

    return result
  } catch (error) {
    result.success = false
    result.duration = Date.now() - startTime
    result.errors.push(error instanceof Error ? error.message : String(error))

    logError('mutation_system_initialization_error', {
      duration: result.duration,
      error: error instanceof Error ? error.message : String(error),
    })

    return result
  }
}

async function initializeStorage(
  config: Required<MutationSystemConfig>,
  result: InitializationResult
): Promise<void> {
  try {
    const storage = readMutationStorage()

    if (config.verboseLogging) {
      logInfo('mutation_storage_initialized', {
        schemaVersion: storage.schemaVersion,
        operationCount: Object.keys(storage.operations).length,
      })
    }

    // Verify storage integrity
    for (const [operationId, operation] of Object.entries(storage.operations)) {
      if (!operation.operationId || !operation.type || !operation.status) {
        result.warnings.push(`Invalid operation found: ${operationId}`)
      }
    }
  } catch (error) {
    result.errors.push(
      `Storage initialization failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

async function performMigrations(
  config: Required<MutationSystemConfig>,
  result: InitializationResult
): Promise<void> {
  try {
    const migrationResults = forceBondActionsMigration()

    result.migrationResults = {
      bondActionsMigrated: migrationResults.migrated,
      operationsRecovered: 0, // Will be set by recovery system
    }

    if (config.verboseLogging) {
      logInfo('mutation_migrations_completed', {
        migratedCount: migrationResults.migrated,
        failedCount: migrationResults.failed,
        operationsCount: migrationResults.operations.length,
      })
    }

    if (migrationResults.failed > 0) {
      result.warnings.push(`${migrationResults.failed} bond actions failed to migrate`)
    }
  } catch (error) {
    result.errors.push(
      `Migration failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

async function performCleanup(
  config: Required<MutationSystemConfig>,
  result: InitializationResult
): Promise<void> {
  try {
    const removedCount = cleanupCompletedOperations()

    result.cleanupResults = {
      operationsRemoved: removedCount,
    }

    if (config.verboseLogging) {
      logInfo('mutation_cleanup_completed', { removedOperations: removedCount })
    }
  } catch (error) {
    result.warnings.push(
      `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

async function initializeRecoverySystem(
  config: Required<MutationSystemConfig>,
  result: InitializationResult
): Promise<void> {
  try {
    await initializeMutationRecovery()

    if (!result.migrationResults) {
      result.migrationResults = {
        bondActionsMigrated: 0,
        operationsRecovered: 0,
      }
    }
    const recoveryStatus = mutationRecoveryEngine.getRecoveryStatus()
    result.migrationResults.operationsRecovered = recoveryStatus.pending

    if (config.verboseLogging) {
      const status = mutationRecoveryEngine.getRecoveryStatus()
      logInfo('mutation_recovery_initialized', {
        activeCount: status.active.length,
        pendingCount: status.pending,
        failedCount: status.failed,
      })
    }
  } catch (error) {
    result.errors.push(
      `Recovery system initialization failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

async function validateSystemState(
  config: Required<MutationSystemConfig>,
  result: InitializationResult
): Promise<void> {
  try {
    const storage = readMutationStorage()

    // Validate schema version
    if (storage.schemaVersion !== 2) {
      result.errors.push(`Invalid storage schema version: ${storage.schemaVersion}`)
    }

    // Validate operation consistency
    let inconsistentOperations = 0
    for (const operation of Object.values(storage.operations)) {
      if (operation.attempts.length === 0 && operation.status !== 'idle') {
        inconsistentOperations++
      }
    }

    if (inconsistentOperations > 0) {
      result.warnings.push(`${inconsistentOperations} operations have inconsistent state`)
    }

    if (config.verboseLogging) {
      logInfo('mutation_system_validation_completed', {
        totalOperations: Object.keys(storage.operations).length,
        inconsistentOperations,
      })
    }
  } catch (error) {
    result.warnings.push(
      `System validation failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Shutdown Logic
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gracefully shuts down the mutation system.
 *
 * This function cancels all active operations and saves the current state
 * to ensure no data is lost and operations can be recovered on next startup.
 */
export async function shutdownMutationSystem(): Promise<void> {
  if (shutdownPromise) {
    return shutdownPromise
  }

  shutdownPromise = performShutdown()

  try {
    await shutdownPromise
    isInitialized = false
    initializationPromise = null
  } finally {
    shutdownPromise = null
  }
}

async function performShutdown(): Promise<void> {
  logInfo('mutation_system_shutdown_started')

  try {
    // Shutdown recovery system (this cancels active operations)
    shutdownMutationRecovery()

    // Final storage write to ensure persistence
    const storage = readMutationStorage()
    writeMutationStorage(storage)

    logInfo('mutation_system_shutdown_completed')
  } catch (error) {
    logError('mutation_system_shutdown_failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Status and Health Checks
// ═══════════════════════════════════════════════════════════════════════════

export interface SystemStatus {
  isInitialized: boolean
  isHealthy: boolean
  storage: {
    schemaVersion: number
    operationCount: number
    lastUpdated?: string
  }
  recovery: {
    active: number
    pending: number
    failed: number
  }
  issues: string[]
}

/**
 * Gets the current status of the mutation system.
 */
export function getMutationSystemStatus(): SystemStatus {
  const status: SystemStatus = {
    isInitialized,
    isHealthy: true,
    storage: {
      schemaVersion: 0,
      operationCount: 0,
    },
    recovery: {
      active: 0,
      pending: 0,
      failed: 0,
    },
    issues: [],
  }

  try {
    const storage = readMutationStorage()
    status.storage = {
      schemaVersion: storage.schemaVersion,
      operationCount: Object.keys(storage.operations).length,
      lastUpdated: storage.metadata.updatedAt || storage.metadata.createdAt,
    }

    const recoveryStatus = mutationRecoveryEngine.getRecoveryStatus()
    status.recovery = {
      active: recoveryStatus.active.length,
      pending: recoveryStatus.pending,
      failed: recoveryStatus.failed,
    }

    // Check for health issues
    if (!isInitialized) {
      status.isHealthy = false
      status.issues.push('System not initialized')
    }

    if (storage.schemaVersion !== 2) {
      status.isHealthy = false
      status.issues.push(`Invalid schema version: ${storage.schemaVersion}`)
    }

    if (recoveryStatus.failed > 0) {
      status.isHealthy = false
      status.issues.push(`${recoveryStatus.failed} operations failed recovery`)
    }
  } catch (error) {
    status.isHealthy = false
    status.issues.push(
      `Status check failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  return status
}

/**
 * Performs a comprehensive health check of the mutation system.
 */
export async function performMutationSystemHealthCheck(): Promise<{
  healthy: boolean
  status: SystemStatus
  recommendations: string[]
}> {
  const status = getMutationSystemStatus()
  const recommendations: string[] = []

  // Check if system needs initialization
  if (!status.isInitialized) {
    recommendations.push('Initialize the mutation system')
  }

  // Check for schema issues
  if (status.storage.schemaVersion !== 2) {
    recommendations.push('Update storage schema to latest version')
  }

  // Check for recovery issues
  if (status.recovery.failed > 0) {
    recommendations.push('Review and retry failed operations')
  }

  // Check for excessive pending operations
  if (status.recovery.pending > 10) {
    recommendations.push('Consider cleaning up old pending operations')
  }

  return {
    healthy: status.isHealthy && recommendations.length === 0,
    status,
    recommendations,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Checks if the mutation system is initialized and ready for use.
 */
export function isMutationSystemReady(): boolean {
  return isInitialized
}

/**
 * Ensures the mutation system is initialized before proceeding.
 * Throws an error if initialization fails.
 */
export async function ensureMutationSystemReady(config?: MutationSystemConfig): Promise<void> {
  if (!isInitialized) {
    const result = await initializeMutationSystem(config)
    if (!result.success) {
      throw new Error(`Mutation system initialization failed: ${result.errors.join(', ')}`)
    }
  }
}
