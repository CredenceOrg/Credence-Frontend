# Mutation System API Reference

## Overview

This document provides detailed API reference for the enhanced mutation system, including public interfaces, React hooks, and integration patterns.

## Core APIs

### Storage Layer

#### `readMutationStorage(): MutationStorageV2`

Reads the current mutation storage with automatic migration and cleanup.

```typescript
import { readMutationStorage } from '../lib/mutationStorage'

const storage = readMutationStorage()
console.log(`Schema version: ${storage.schemaVersion}`)
console.log(`Operations: ${Object.keys(storage.operations).length}`)
```

#### `createMutationOperation(type, params, maxAttempts?): { operationId, isNewOperation }`

Creates a new mutation operation with automatic deduplication.

```typescript
import { createMutationOperation } from '../lib/mutationStorage'

// Create bond creation operation
const { operationId, isNewOperation } = createMutationOperation(
  'bond_create',
  { amountUsdc: 1000 },
  3 // maxAttempts (optional)
)

if (isNewOperation) {
  console.log('New operation created:', operationId)
} else {
  console.log('Existing operation found:', operationId)
}
```

#### `updateMutationOperation(operationId, updater): MutationOperation | null`

Updates an existing operation atomically.

```typescript
import { updateMutationOperation } from '../lib/mutationStorage'

const updatedOp = updateMutationOperation('op-123', (current) => ({
  status: 'success',
  finalTxHash: 'hash-456',
  completedAt: new Date().toISOString(),
}))
```

#### `getMutationOperations(type?, status?): MutationOperation[]`

Retrieves operations with optional filtering.

```typescript
import { getMutationOperations } from '../lib/mutationStorage'

// Get all operations
const allOps = getMutationOperations()

// Get pending bond operations
const pendingBonds = getMutationOperations('bond_create', 'pending')

// Get all trust score operations
const trustOps = getMutationOperations('trust_score_lookup')
```

### Recovery System

#### `initiateMutation(type, params, maxAttempts?): Promise<{ operationId, isNewOperation, started }>`

High-level API to initiate a mutation with automatic recovery.

```typescript
import { initiateMutation } from '../lib/mutationRecovery'

try {
  const result = await initiateMutation('bond_create', { amountUsdc: 1500 })

  if (result.isNewOperation) {
    console.log('Started new operation:', result.operationId)
  } else {
    console.log('Resumed existing operation:', result.operationId)
  }

  if (!result.started) {
    console.warn('Operation failed to start')
  }
} catch (error) {
  console.error('Failed to initiate mutation:', error)
}
```

#### `retryMutation(operationId): Promise<boolean>`

Retries a failed operation with exponential backoff.

```typescript
import { retryMutation } from '../lib/mutationRecovery'

const success = await retryMutation('failed-op-123')
if (success) {
  console.log('Retry initiated successfully')
} else {
  console.log('Retry failed or not allowed')
}
```

#### `cancelMutation(operationId): boolean`

Cancels an active operation.

```typescript
import { cancelMutation } from '../lib/mutationRecovery'

const cancelled = cancelMutation('active-op-123')
if (cancelled) {
  console.log('Operation cancelled')
} else {
  console.log('Operation could not be cancelled')
}
```

### System Management

#### `initializeMutationSystem(config?): Promise<InitializationResult>`

Initializes the mutation system with optional configuration.

```typescript
import { initializeMutationSystem } from '../lib/mutationSystemInitializer'

const config = {
  enableAutoRecovery: true,
  forceMigration: false,
  cleanupCompleted: true,
  verboseLogging: process.env.NODE_ENV === 'development',
}

const result = await initializeMutationSystem(config)

if (result.success) {
  console.log('System initialized successfully')
  if (result.migrationResults) {
    console.log('Migrations:', result.migrationResults)
  }
} else {
  console.error('Initialization failed:', result.errors)
}
```

#### `getMutationSystemStatus(): SystemStatus`

Gets current system status and health information.

```typescript
import { getMutationSystemStatus } from '../lib/mutationSystemInitializer'

const status = getMutationSystemStatus()

console.log('System healthy:', status.isHealthy)
console.log('Schema version:', status.storage.schemaVersion)
console.log('Active operations:', status.recovery.active)

if (!status.isHealthy) {
  console.warn('Issues found:', status.issues)
}
```

#### `performMutationSystemHealthCheck(): Promise<HealthCheckResult>`

Performs comprehensive health check with recommendations.

```typescript
import { performMutationSystemHealthCheck } from '../lib/mutationSystemInitializer'

const healthCheck = await performMutationSystemHealthCheck()

console.log('Overall health:', healthCheck.healthy)

if (healthCheck.recommendations.length > 0) {
  console.log('Recommendations:')
  healthCheck.recommendations.forEach((rec) => console.log('-', rec))
}
```

## React Integration

### `useEnhancedBondMutations(): UseEnhancedBondMutationsResult`

React hook for bond operations with persistent storage and recovery.

```typescript
import { useEnhancedBondMutations } from '../hooks/useEnhancedBondMutations'

function BondComponent() {
  const {
    create,
    withdraw,
    actions,
    hasActiveOperations,
    recoveryStatus
  } = useEnhancedBondMutations()

  const handleCreateBond = async (amount: number) => {
    try {
      const operationId = await actions.createBond(amount)
      console.log('Bond creation started:', operationId)
    } catch (error) {
      console.error('Failed to create bond:', error)
    }
  }

  const handleRetry = async () => {
    const success = await actions.retry()
    if (success) {
      console.log('Retry initiated')
    }
  }

  return (
    <div>
      <p>Create Status: {create.status}</p>
      {create.canRetry && (
        <button onClick={handleRetry}>Retry</button>
      )}
      {create.error && (
        <p>Error: {create.error}</p>
      )}
      {hasActiveOperations && (
        <p>Operations in progress...</p>
      )}
    </div>
  )
}
```

**Return Value:**

```typescript
interface UseEnhancedBondMutationsResult {
  create: BondMutationState
  withdraw: BondMutationState
  actions: {
    createBond: (amountUsdc: number) => Promise<MutationOperationId>
    withdrawBond: (bondId: number, amountUsdc: number) => Promise<MutationOperationId>
    retry: () => Promise<boolean>
    cancel: () => boolean
    reset: () => void
  }
  hasActiveOperations: boolean
  recoveryStatus: {
    isRecovering: boolean
    recoveredCount: number
  }
}

interface BondMutationState {
  operationId: MutationOperationId | null
  isActive: boolean
  status: 'idle' | 'pending' | 'submitting' | 'success' | 'error' | 'cancelled'
  attempts: number
  canRetry: boolean
  txHash?: string
  error?: string
  createdAt?: string
  lastAttemptAt?: string
  completedAt?: string
}
```

### `useEnhancedTrustScore(address, options?): UseEnhancedTrustScoreResult`

React hook for trust score lookups with persistent storage.

```typescript
import { useEnhancedTrustScore } from '../hooks/useEnhancedTrustScore'

function TrustScoreComponent({ address }: { address: string }) {
  const {
    data,
    isLoading,
    error,
    operationId,
    canRetry,
    refetch,
    retry,
    cancel
  } = useEnhancedTrustScore(address, {
    autoRecover: true,
    enablePolling: true,
    pollingInterval: 1000
  })

  if (isLoading) return <div>Loading...</div>

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        {canRetry && (
          <button onClick={retry}>Retry</button>
        )}
      </div>
    )
  }

  if (data) {
    return (
      <div>
        <h3>Trust Score: {data.score}</h3>
        <p>Tier: {data.tier}</p>
        <button onClick={refetch}>Refresh</button>
      </div>
    )
  }

  return <button onClick={refetch}>Look up Trust Score</button>
}
```

**Options:**

```typescript
interface UseEnhancedTrustScoreOptions {
  autoRecover?: boolean // Default: true
  enablePolling?: boolean // Default: true
  pollingInterval?: number // Default: 1000ms
}
```

**Return Value:**

```typescript
interface UseEnhancedTrustScoreResult {
  data: TrustScore | null
  isLoading: boolean
  error: string | null
  operationId: MutationOperationId | null
  canRetry: boolean
  attempts: number
  isRecovered: boolean

  // Actions
  refetch: () => Promise<void>
  refresh: () => Promise<void> // Force refresh
  retry: () => Promise<boolean>
  cancel: () => boolean
  reset: () => void
}
```

### `useMutationRecovery(): MutationRecoveryContextValue`

Context hook for system-wide mutation recovery status.

```typescript
import { useMutationRecovery } from '../components/MutationRecoveryProvider'

function SystemStatus() {
  const {
    isInitialized,
    isInitializing,
    systemStatus,
    activeOperations,
    refreshOperations,
    performHealthCheck
  } = useMutationRecovery()

  const handleHealthCheck = async () => {
    const isHealthy = await performHealthCheck()
    console.log('System healthy:', isHealthy)
  }

  if (!isInitialized) {
    return <div>System initializing...</div>
  }

  return (
    <div>
      <h3>Mutation System Status</h3>
      <p>Active Operations: {activeOperations.length}</p>
      <p>System Health: {systemStatus?.isHealthy ? 'Healthy' : 'Degraded'}</p>
      <button onClick={refreshOperations}>Refresh</button>
      <button onClick={handleHealthCheck}>Health Check</button>
    </div>
  )
}
```

### `useActiveOperations(): ActiveOperationsResult`

Specialized hook for monitoring active operations.

```typescript
import { useActiveOperations } from '../components/MutationRecoveryProvider'

function ActiveOperationsList() {
  const {
    operations,
    hasActive,
    bondOperations,
    trustScoreOperations
  } = useActiveOperations()

  if (!hasActive) {
    return <div>No active operations</div>
  }

  return (
    <div>
      <h3>Active Operations</h3>
      <p>Bond Operations: {bondOperations.length}</p>
      <p>Trust Score Operations: {trustScoreOperations.length}</p>

      {operations.map(op => (
        <div key={op.operationId}>
          <span>{op.type}: {op.status}</span>
        </div>
      ))}
    </div>
  )
}
```

## UI Components

### `<MutationTracker />`

Component for displaying operation status with controls.

```typescript
import MutationTracker from '../components/MutationTracker'

function OperationDisplay({ operationId }: { operationId: string }) {
  const handleSuccess = (operation: MutationOperation) => {
    console.log('Operation completed:', operation.operationId)
    // Show success toast, redirect, etc.
  }

  const handleError = (operation: MutationOperation) => {
    console.error('Operation failed:', operation.operationId)
    // Show error dialog, log error, etc.
  }

  return (
    <MutationTracker
      operationId={operationId}
      title="Custom Operation Title"
      showDetails={true}
      showControls={true}
      onSuccess={handleSuccess}
      onError={handleError}
      className="custom-tracker-styles"
    />
  )
}
```

**Props:**

```typescript
interface MutationTrackerProps {
  operationId: MutationOperationId
  title?: string // Custom operation title
  showDetails?: boolean // Show attempt details (default: true)
  showControls?: boolean // Show retry/cancel buttons (default: true)
  onSuccess?: (operation: MutationOperation) => void
  onError?: (operation: MutationOperation) => void
  onCancel?: (operation: MutationOperation) => void
  className?: string
}
```

### `<MutationRecoveryProvider />`

Context provider for the mutation system.

```typescript
import { MutationRecoveryProvider } from '../components/MutationRecoveryProvider'

function App() {
  return (
    <MutationRecoveryProvider
      autoInitialize={true}
      config={{
        enableAutoRecovery: true,
        cleanupCompleted: false,
        verboseLogging: process.env.NODE_ENV === 'development'
      }}
    >
      <YourApp />
    </MutationRecoveryProvider>
  )
}
```

**Props:**

```typescript
interface MutationRecoveryProviderProps {
  children: React.ReactNode
  config?: MutationSystemConfig
  autoInitialize?: boolean // Default: true
}

interface MutationSystemConfig {
  forceMigration?: boolean
  cleanupCompleted?: boolean
  enableAutoRecovery?: boolean
  verboseLogging?: boolean
}
```

## Trust Score Integration

### `lookupTrustScore(address, forceRefresh?): Promise<TrustScoreLookupResult>`

Direct API for trust score lookups with persistence.

```typescript
import { lookupTrustScore } from '../lib/trustScoreMutations'

// Basic lookup
const result = await lookupTrustScore('GTEST123...')
console.log('Operation ID:', result.operationId)
console.log('Is new operation:', result.isNewOperation)

// Force fresh lookup
const freshResult = await lookupTrustScore('GTEST123...', true)
```

### `lookupTrustScoresBatch(addresses): Promise<BatchTrustScoreLookupResult>`

Batch trust score lookups with automatic deduplication.

```typescript
import { lookupTrustScoresBatch } from '../lib/trustScoreMutations'

const addresses = ['GTEST1...', 'GTEST2...', 'GTEST3...']
const batchResult = await lookupTrustScoresBatch(addresses)

console.log('Total operations:', batchResult.totalOperations)
console.log('New operations:', batchResult.newOperations)

batchResult.operations.forEach(({ address, operationId, isNewOperation }) => {
  console.log(`${address}: ${operationId} (new: ${isNewOperation})`)
})
```

## Bond Action Migration

### Legacy Compatibility APIs

These APIs maintain backward compatibility with existing bond action code:

#### `readBondActions(): BondActionsV1`

Reads bond actions with automatic migration to unified system.

```typescript
import { readBondActions } from '../lib/bondActionStorage'

const bondActions = readBondActions()
console.log('Create status:', bondActions.create.status)
console.log('Migrated:', bondActions.create.migratedToV2)
```

#### `updateBondAction(kind, updater): BondActionsV1`

Updates bond actions with automatic sync to unified system.

```typescript
import { updateBondAction } from '../lib/bondActionStorage'

const updated = updateBondAction('create', (current) => ({
  ...current,
  status: 'pending',
  attempts: current.attempts + 1,
  lastAttemptAt: new Date().toISOString(),
}))
```

#### `createEnhancedBondAction(kind, params): Promise<EnhancedBondActionResult>`

Creates operations in both legacy and unified systems.

```typescript
import { createEnhancedBondAction } from '../lib/bondActionStorage'

const result = await createEnhancedBondAction('create', { amountUsdc: 1000 })
console.log('Operation ID:', result.operationId)
console.log('Is new:', result.isNewOperation)
console.log('Legacy updated:', result.legacyUpdated)
```

### Migration Status APIs

#### `getBondActionMigrationStatus(): MigrationStatus`

Gets current migration status for bond actions.

```typescript
import { getBondActionMigrationStatus } from '../lib/bondActionStorage'

const status = getBondActionMigrationStatus()
console.log('Create migrated:', status.createMigrated)
console.log('Withdraw migrated:', status.withdrawMigrated)
console.log('Migration timestamp:', status.migrationTimestamp)
```

#### `forceBondActionsMigration(): MigrationResult`

Forces migration of all bond actions (for testing/maintenance).

```typescript
import { forceBondActionsMigration } from '../lib/bondActionStorage'

const result = forceBondActionsMigration()
console.log('Migrated:', result.migrated)
console.log('Failed:', result.failed)
console.log('Operation IDs:', result.operations)
```

## Error Handling

### Error Types

The system defines structured error types for consistent handling:

```typescript
interface MutationError {
  type: 'network' | 'backend' | 'validation' | 'wallet_rejected' | 'timeout' | 'generic'
  message: string
  code?: string | number
  timestamp: string
  retryable: boolean
}
```

### Error Recovery Patterns

```typescript
// Automatic retry with backoff
const retryWithBackoff = async (operationId: string, maxAttempts = 3) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const operation = getMutationOperation(operationId)
    if (!operation || operation.status !== 'error') break

    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000)
    await new Promise((resolve) => setTimeout(resolve, delay))

    const success = await retryMutation(operationId)
    if (success) break
  }
}

// Manual error handling
try {
  await initiateMutation('bond_create', { amountUsdc: 1000 })
} catch (error) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 0:
        console.error('Network error:', error.message)
        break
      case 400:
        console.error('Validation error:', error.message)
        break
      case 500:
        console.error('Server error:', error.message)
        break
      default:
        console.error('Unknown error:', error.message)
    }
  } else {
    console.error('Unexpected error:', error)
  }
}
```

## Best Practices

### Operation Lifecycle Management

1. **Always check operation status** before initiating new operations
2. **Handle deduplication** by checking `isNewOperation` flag
3. **Provide user feedback** for all operation states
4. **Clean up completed operations** periodically
5. **Monitor system health** in production environments

### Performance Optimization

1. **Limit polling frequency** for non-critical operations
2. **Use batch operations** for multiple similar requests
3. **Clean up old operations** to prevent storage bloat
4. **Implement proper loading states** to improve UX
5. **Consider operation priorities** for resource allocation

### Error Handling

1. **Always handle all error types** appropriately
2. **Provide clear user messages** for each error type
3. **Implement proper retry logic** with backoff
4. **Log errors** with sufficient context for debugging
5. **Plan for degraded states** when systems are unavailable

### Testing

1. **Test all failure scenarios** including network, wallet, and storage failures
2. **Verify migration paths** from all previous versions
3. **Test concurrent operations** and race conditions
4. **Validate error handling** for each error type
5. **Test system recovery** after crashes and restarts
