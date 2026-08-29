/**
 * @file MutationTracker.tsx
 * @description React component for tracking and displaying mutation operation status.
 *
 * This component provides a unified interface for displaying the status of
 * long-running mutations (bond operations, trust score lookups) with:
 * - Real-time status updates
 * - Retry and cancellation controls
 * - Error handling with recovery options
 * - Integration with the mutation recovery system
 */

import { useState, useEffect, useCallback } from 'react'
import Button from './Button'
import Banner from './Banner'
import { LoadingSkeleton } from './states'
import {
  type MutationOperationId,
  type MutationOperation,
  getMutationOperation,
} from '../lib/mutationStorage'
import { retryMutation, cancelMutation } from '../lib/mutationRecovery'
import { formatUsdc } from '../lib/format'
import { logInfo, logWarn } from '../lib/log'
import './MutationTracker.css'

// ═══════════════════════════════════════════════════════════════════════════
// Component Types
// ═══════════════════════════════════════════════════════════════════════════

export interface MutationTrackerProps {
  operationId: MutationOperationId
  /** Custom title for the operation */
  title?: string
  /** Whether to show detailed attempt information */
  showDetails?: boolean
  /** Whether to show retry and cancel controls */
  showControls?: boolean
  /** Callback when operation completes successfully */
  onSuccess?: (operation: MutationOperation) => void
  /** Callback when operation fails permanently */
  onError?: (operation: MutationOperation) => void
  /** Callback when operation is cancelled */
  onCancel?: (operation: MutationOperation) => void
  /** Custom class name */
  className?: string
}

interface OperationDisplayInfo {
  title: string
  description: string
  statusText: string
  statusVariant: 'default' | 'success' | 'warning' | 'critical'
  canRetry: boolean
  canCancel: boolean
  showProgress: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// Component Implementation
// ═══════════════════════════════════════════════════════════════════════════

export default function MutationTracker({
  operationId,
  title,
  showDetails = true,
  showControls = true,
  onSuccess,
  onError,
  onCancel,
  className = '',
}: MutationTrackerProps) {
  const [operation, setOperation] = useState<MutationOperation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // ═══════════════════════════════════════════════════════════════════════════
  // State Management
  // ═══════════════════════════════════════════════════════════════════════════

  const updateOperation = useCallback(() => {
    const currentOperation = getMutationOperation(operationId)
    setOperation(currentOperation)
    setIsLoading(false)

    // Fire callbacks for status changes
    if (currentOperation) {
      const prevStatus = operation?.status
      const newStatus = currentOperation.status

      if (prevStatus !== newStatus) {
        switch (newStatus) {
          case 'success':
            onSuccess?.(currentOperation)
            break
          case 'error':
            onError?.(currentOperation)
            break
          case 'cancelled':
            onCancel?.(currentOperation)
            break
        }
      }
    }
  }, [operationId, operation?.status, onSuccess, onError, onCancel])

  // ═══════════════════════════════════════════════════════════════════════════
  // Effects
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    updateOperation()
  }, [updateOperation])

  useEffect(() => {
    if (!operation) return

    const isActive = operation.status === 'pending' || operation.status === 'submitting'

    if (isActive) {
      const interval = setInterval(updateOperation, 1000)
      return () => clearInterval(interval)
    }
  }, [operation?.status, updateOperation])

  // ═══════════════════════════════════════════════════════════════════════════
  // Action Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  const handleRetry = useCallback(async () => {
    if (!operation || isRetrying) return

    setIsRetrying(true)
    try {
      const success = await retryMutation(operationId)
      if (success) {
        updateOperation()
        logInfo('mutation_tracker_retry_success', { operationId })
      } else {
        logWarn('mutation_tracker_retry_failed', { operationId })
      }
    } catch (error) {
      logWarn('mutation_tracker_retry_error', {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsRetrying(false)
    }
  }, [operation, operationId, isRetrying, updateOperation])

  const handleCancel = useCallback(async () => {
    if (!operation || isCancelling) return

    setIsCancelling(true)
    try {
      const success = cancelMutation(operationId)
      if (success) {
        updateOperation()
        logInfo('mutation_tracker_cancel_success', { operationId })
      } else {
        logWarn('mutation_tracker_cancel_failed', { operationId })
      }
    } catch (error) {
      logWarn('mutation_tracker_cancel_error', {
        operationId,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsCancelling(false)
    }
  }, [operation, operationId, isCancelling, updateOperation])

  // ═══════════════════════════════════════════════════════════════════════════
  // Display Logic
  // ═══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (!operation) {
    return (
      <Banner
        severity="warn"
        title="Operation Not Found"
      >
        The requested operation could not be found.
      </Banner>
    )
  }

  const displayInfo = getOperationDisplayInfo(operation, title)
  const lastAttempt = operation.attempts[operation.attempts.length - 1]

  return (
    <div className={`mutation-tracker ${className}`} data-testid="mutation-tracker">
      {/* Main Status Banner */}
      <Banner
        severity="info"
        title={displayInfo.title}
      >
        <div className="mutation-tracker__content">
          <div className="mutation-tracker__description">{displayInfo.description}</div>

          {displayInfo.showProgress && (
            <div className="mutation-tracker__progress">
              <span className="mutation-tracker__progress-text">
                {displayInfo.statusText}
              </span>
            </div>
          )}

          {/* Controls */}
          {showControls && (displayInfo.canRetry || displayInfo.canCancel) && (
            <div className="mutation-tracker__actions">
              {displayInfo.canRetry && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  aria-label="Retry operation"
                >
                  {isRetrying ? 'Retrying...' : 'Retry'}
                </Button>
              )}

              {displayInfo.canCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  aria-label="Cancel operation"
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel'}
                </Button>
              )}
            </div>
          )}
        </div>
      </Banner>

      {/* Details Section */}
      {showDetails && (
        <div className="mutation-tracker__details">
          <div className="mutation-tracker__metadata">
            <div className="mutation-tracker__meta-item">
              <span className="mutation-tracker__meta-label">Attempts:</span>
              <span className="mutation-tracker__meta-value">
                {operation.attempts.length} / {operation.maxAttempts}
              </span>
            </div>

            {operation.finalTxHash && (
              <div className="mutation-tracker__meta-item">
                <span className="mutation-tracker__meta-label">Transaction:</span>
                <span className="mutation-tracker__meta-value mutation-tracker__tx-hash">
                  {operation.finalTxHash}
                </span>
              </div>
            )}

            {lastAttempt?.error && (
              <div className="mutation-tracker__meta-item">
                <span className="mutation-tracker__meta-label">Error:</span>
                <span className="mutation-tracker__meta-value mutation-tracker__error">
                  {lastAttempt.error.message}
                </span>
              </div>
            )}

            {operation.isRecovered && (
              <div className="mutation-tracker__meta-item">
                <span className="mutation-tracker__meta-label">Recovered:</span>
                <span className="mutation-tracker__meta-value">
                  <span className="mutation-tracker__recovery-text">
                    From {operation.recoverySource}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function getOperationDisplayInfo(
  operation: MutationOperation,
  customTitle?: string
): OperationDisplayInfo {
  const baseTitle = customTitle || getDefaultTitle(operation)
  const lastAttempt = operation.attempts[operation.attempts.length - 1]

  switch (operation.status) {
    case 'idle':
      return {
        title: baseTitle,
        description: 'Operation is ready to start.',
        statusText: 'Ready',
        statusVariant: 'default',
        canRetry: false,
        canCancel: false,
        showProgress: false,
      }

    case 'pending':
      return {
        title: baseTitle,
        description: 'Operation is queued and will start shortly.',
        statusText: 'Queued',
        statusVariant: 'default',
        canRetry: false,
        canCancel: true,
        showProgress: true,
      }

    case 'submitting':
      return {
        title: baseTitle,
        description: 'Operation is in progress...',
        statusText: `Submitting (${operation.attempts.length}/${operation.maxAttempts})`,
        statusVariant: 'default',
        canRetry: false,
        canCancel: true,
        showProgress: true,
      }

    case 'success':
      return {
        title: `${baseTitle} Completed`,
        description: getSuccessDescription(operation),
        statusText: 'Success',
        statusVariant: 'success',
        canRetry: false,
        canCancel: false,
        showProgress: false,
      }

    case 'error': {
      const canRetry =
        operation.attempts.length < operation.maxAttempts &&
        (lastAttempt?.error?.retryable ?? false)

      return {
        title: `${baseTitle} Failed`,
        description: lastAttempt?.error?.message || 'Operation failed with unknown error',
        statusText: `Failed (${operation.attempts.length}/${operation.maxAttempts})`,
        statusVariant: 'critical',
        canRetry,
        canCancel: false,
        showProgress: false,
      }
    }

    case 'cancelled': {
      return {
        title: `${baseTitle} Cancelled`,
        description: 'Operation was cancelled by user.',
        statusText: 'Cancelled',
        statusVariant: 'warning',
        canRetry: false,
        canCancel: false,
        showProgress: false,
      }
    }

    default:
      return {
        title: baseTitle,
        description: `Unknown status: ${operation.status}`,
        statusText: operation.status,
        statusVariant: 'default',
        canRetry: false,
        canCancel: false,
        showProgress: false,
      }
  }
}

function getDefaultTitle(operation: MutationOperation): string {
  switch (operation.type) {
    case 'bond_create': {
      const createAmount = operation.requestMetadata.amountUsdc as number
      return `Create Bond (${formatUsdc(createAmount)})`
    }

    case 'bond_withdraw': {
      const withdrawAmount = operation.requestMetadata.amountUsdc as number
      return `Withdraw Bond (${formatUsdc(withdrawAmount)})`
    }

    case 'trust_score_lookup': {
      const address = operation.requestMetadata.address as string
      return `Trust Score Lookup (${address.slice(0, 8)}...)`
    }

    default:
      return 'Operation'
  }
}

function getSuccessDescription(operation: MutationOperation): string {
  switch (operation.type) {
    case 'bond_create':
      return `Bond created successfully. Transaction: ${operation.finalTxHash?.slice(0, 12)}...`

    case 'bond_withdraw':
      return `Bond withdrawn successfully. Transaction: ${operation.finalTxHash?.slice(0, 12)}...`

    case 'trust_score_lookup': {
      const score = operation.finalResponse as Record<string, unknown>
      return `Trust score retrieved: ${(score?.score as string) || 'N/A'} (${(score?.tier as string) || 'Unknown tier'})`
    }

    default:
      return 'Operation completed successfully.'
  }
}
