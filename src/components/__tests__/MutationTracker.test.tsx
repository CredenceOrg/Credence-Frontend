/**
 * @file MutationTracker.test.tsx
 * @description Tests for the MutationTracker component.
 *
 * Test Coverage:
 * - Operation status display for all states
 * - Retry and cancel functionality
 * - Real-time updates and polling
 * - Error handling and display
 * - Accessibility compliance
 * - Integration with mutation recovery system
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MutationTracker from '../MutationTracker'
import type { MutationOperation } from '../../lib/mutationStorage'

// Mock the modules
vi.mock('../../lib/mutationStorage')
vi.mock('../../lib/mutationRecovery')

// Create mock functions with proper typing
const mockGetMutationOperation = vi.fn() as Mock<[string], MutationOperation | null>
const mockRetryMutation = vi.fn() as Mock<[string], Promise<boolean>>
const mockCancelMutation = vi.fn() as Mock<[string], boolean>

// Mock the actual imports
vi.mocked(await import('../../lib/mutationStorage')).getMutationOperation = mockGetMutationOperation
vi.mocked(await import('../../lib/mutationRecovery')).retryMutation = mockRetryMutation
vi.mocked(await import('../../lib/mutationRecovery')).cancelMutation = mockCancelMutation

// Mock dependencies
vi.mock('../../lib/mutationStorage')
vi.mock('../../lib/mutationRecovery')
vi.mock('../../lib/log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

describe('MutationTracker', () => {

  const mockBondCreateOperation = {
    operationId: 'bond-create-123',
    type: 'bond_create',
    status: 'pending',
    requestHash: 'hash-123',
    requestMetadata: { amountUsdc: 1000 },
    attempts: [],
    maxAttempts: 3,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:01:00.000Z',
    correlationId: 'corr-bond-create-123',
    version: 1,
    isRecovered: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMutationOperation.mockReturnValue(mockBondCreateOperation)
    mockRetryMutation.mockResolvedValue(true)
    mockCancelMutation.mockReturnValue(true)
  })

  describe('operation status display', () => {
    it('displays pending operation correctly', () => {
      render(<MutationTracker operationId="bond-create-123" />)

      expect(screen.getByText('Create Bond (1,000 USDC)')).toBeInTheDocument()
      expect(screen.getByText('Operation is queued and will start shortly.')).toBeInTheDocument()
      expect(screen.getByText('Queued')).toBeInTheDocument()
      expect(screen.getByTestId('mutation-tracker')).toBeInTheDocument()
    })

    it('displays submitting operation with progress', () => {
      const submittingOperation = {
        ...mockBondCreateOperation,
        status: 'submitting',
        attempts: [
          {
            attemptId: 'attempt-1',
            timestamp: '2024-01-01T00:01:00.000Z',
            requestHash: 'hash-123',
            status: 'submitting',
          },
        ],
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(submittingOperation)

      render(<MutationTracker operationId="bond-create-123" />)

      expect(screen.getByText('Operation is in progress...')).toBeInTheDocument()
      expect(screen.getByText('Submitting (1/3)')).toBeInTheDocument()
    })

    it('displays successful operation with transaction hash', () => {
      const successOperation = {
        ...mockBondCreateOperation,
        status: 'success',
        finalTxHash: 'success-hash-456',
        completedAt: '2024-01-01T00:05:00.000Z',
        attempts: [
          {
            attemptId: 'attempt-1',
            timestamp: '2024-01-01T00:01:00.000Z',
            requestHash: 'hash-123',
            status: 'success',
            txHash: 'success-hash-456',
          },
        ],
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(successOperation)

      render(<MutationTracker operationId="bond-create-123" showDetails={true} />)

      expect(screen.getByText('Create Bond (1,000 USDC) Completed')).toBeInTheDocument()
      expect(screen.getByText(/Bond created successfully/)).toBeInTheDocument()
      expect(screen.getByText('success-hash-456')).toBeInTheDocument()
    })

    it('displays failed operation with error and retry option', () => {
      const failedOperation = {
        ...mockBondCreateOperation,
        status: 'error',
        attempts: [
          {
            attemptId: 'attempt-1',
            timestamp: '2024-01-01T00:01:00.000Z',
            requestHash: 'hash-123',
            status: 'error',
            error: {
              type: 'network',
              message: 'Network connection failed',
              timestamp: '2024-01-01T00:01:00.000Z',
              retryable: true,
            },
          },
        ],
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(failedOperation)

      render(<MutationTracker operationId="bond-create-123" showControls={true} />)

      expect(screen.getByText('Create Bond (1,000 USDC) Failed')).toBeInTheDocument()
      expect(screen.getByText('Network connection failed')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Retry operation' })).toBeInTheDocument()
    })

    it('displays cancelled operation', () => {
      const cancelledOperation = {
        ...mockBondCreateOperation,
        status: 'cancelled',
        completedAt: '2024-01-01T00:03:00.000Z',
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(cancelledOperation)

      render(<MutationTracker operationId="bond-create-123" />)

      expect(screen.getByText('Create Bond (1,000 USDC) Cancelled')).toBeInTheDocument()
      expect(screen.getByText('Operation was cancelled by user.')).toBeInTheDocument()
    })
  })

  describe('operation types', () => {
    it('displays bond withdraw operation correctly', () => {
      const withdrawOperation = {
        ...mockBondCreateOperation,
        type: 'bond_withdraw',
        requestMetadata: { bondId: 123, amountUsdc: 500 },
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(withdrawOperation)

      render(<MutationTracker operationId="bond-withdraw-456" />)

      expect(screen.getByText('Withdraw Bond (500 USDC)')).toBeInTheDocument()
    })

    it('displays trust score lookup operation correctly', () => {
      const trustScoreOperation = {
        ...mockBondCreateOperation,
        type: 'trust_score_lookup',
        requestMetadata: { address: 'GTEST123456789...' },
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(trustScoreOperation)

      render(<MutationTracker operationId="trust-lookup-789" />)

      expect(screen.getByText('Trust Score Lookup (GTEST123...)')).toBeInTheDocument()
    })

    it('displays custom title when provided', () => {
      render(<MutationTracker operationId="bond-create-123" title="Custom Bond Operation" />)

      expect(screen.getByText('Custom Bond Operation')).toBeInTheDocument()
    })
  })

  describe('controls and interactions', () => {
    it('handles retry operation', async () => {
      const user = userEvent.setup()
      const onError = vi.fn()

      const failedOperation = {
        ...mockBondCreateOperation,
        status: 'error',
        attempts: [
          {
            attemptId: 'attempt-1',
            timestamp: '2024-01-01T00:01:00.000Z',
            requestHash: 'hash-123',
            status: 'error',
            error: {
              type: 'network',
              message: 'Network error',
              timestamp: '2024-01-01T00:01:00.000Z',
              retryable: true,
            },
          },
        ],
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(failedOperation)

      render(
        <MutationTracker operationId="bond-create-123" showControls={true} onError={onError} />
      )

      const retryButton = screen.getByRole('button', { name: 'Retry operation' })
      await user.click(retryButton)

      expect(mockMutationRecovery.retryMutation).toHaveBeenCalledWith('bond-create-123')

      // Should show retrying state temporarily
      expect(screen.getByText('Retrying...')).toBeInTheDocument()
    })

    it('emits retry success event matching final state after retry', async () => {
      const user = userEvent.setup()
      const onSuccess = vi.fn()

      const failedOperation = {
        ...mockBondCreateOperation,
        status: 'error',
        attempts: [
          {
            attemptId: 'attempt-1',
            timestamp: '2024-01-01T00:01:00.000Z',
            requestHash: 'hash-123',
            status: 'error',
            error: {
              type: 'network',
              message: 'Network error',
              timestamp: '2024-01-01T00:01:00.000Z',
              retryable: true,
            },
          },
        ],
      }

      const retriedSuccessOperation = {
        ...mockBondCreateOperation,
        status: 'success',
        finalTxHash: 'retry-tx-hash',
        completedAt: '2024-01-01T00:06:00.000Z',
        attempts: [
          ...failedOperation.attempts,
          {
            attemptId: 'attempt-2',
            timestamp: '2024-01-01T00:05:00.000Z',
            requestHash: 'hash-123',
            status: 'success',
            txHash: 'retry-tx-hash',
          },
        ],
      }

      mockGetMutationOperation
        .mockReturnValueOnce(failedOperation)
        .mockReturnValue(retriedSuccessOperation)
      mockRetryMutation.mockResolvedValue(true)

      render(
        <MutationTracker
          operationId="bond-create-123"
          showControls={true}
          onSuccess={onSuccess}
        />
      )

      await user.click(screen.getByRole('button', { name: 'Retry operation' }))

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(retriedSuccessOperation)
      })

      const payload = onSuccess.mock.calls[0][0]
      expect(payload.finalTxHash).toBe('retry-tx-hash')
      expect(payload.attempts[payload.attempts.length - 1].txHash).toBe('retry-tx-hash')
      expect(payload.attempts).toHaveLength(2)
      expect(payload.correlationId).toBe('corr-bond-create-123')
    })

    it('handles cancel operation', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()

      const pendingOperation = {
        ...mockBondCreateOperation,
        status: 'pending',
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(pendingOperation)

      render(
        <MutationTracker operationId="bond-create-123" showControls={true} onCancel={onCancel} />
      )

      const cancelButton = screen.getByRole('button', { name: 'Cancel operation' })
      await user.click(cancelButton)

      expect(mockMutationRecovery.cancelMutation).toHaveBeenCalledWith('bond-create-123')

      // Should show cancelling state temporarily
      expect(screen.getByText('Cancelling...')).toBeInTheDocument()
    })

    it('disables retry button when operation is not retryable', () => {
      const failedOperation = {
        ...mockBondCreateOperation,
        status: 'error',
        attempts: [
          {
            attemptId: 'attempt-1',
            timestamp: '2024-01-01T00:01:00.000Z',
            requestHash: 'hash-123',
            status: 'error',
            error: {
              type: 'validation',
              message: 'Invalid amount',
              timestamp: '2024-01-01T00:01:00.000Z',
              retryable: false,
            },
          },
        ],
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(failedOperation)

      render(<MutationTracker operationId="bond-create-123" showControls={true} />)

      expect(screen.queryByRole('button', { name: 'Retry operation' })).not.toBeInTheDocument()
    })

    it('hides controls when showControls is false', () => {
      const failedOperation = {
        ...mockBondCreateOperation,
        status: 'error',
        attempts: [
          {
            attemptId: 'attempt-1',
            timestamp: '2024-01-01T00:01:00.000Z',
            requestHash: 'hash-123',
            status: 'error',
            error: {
              type: 'network',
              message: 'Network error',
              timestamp: '2024-01-01T00:01:00.000Z',
              retryable: true,
            },
          },
        ],
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(failedOperation)

      render(<MutationTracker operationId="bond-create-123" showControls={false} />)

      expect(screen.queryByRole('button', { name: 'Retry operation' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cancel operation' })).not.toBeInTheDocument()
    })
  })

  describe('details display', () => {
    it('shows detailed operation information when showDetails is true', () => {
      const detailedOperation = {
        ...mockBondCreateOperation,
        status: 'error',
        finalTxHash: 'tx-hash-123',
        isRecovered: true,
        recoverySource: 'storage',
        attempts: [
          {
            attemptId: 'attempt-1',
            timestamp: '2024-01-01T00:01:00.000Z',
            requestHash: 'hash-123',
            status: 'error',
            error: {
              type: 'network',
              message: 'Connection timeout',
              timestamp: '2024-01-01T00:01:00.000Z',
              retryable: true,
            },
          },
        ],
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(detailedOperation)

      render(<MutationTracker operationId="bond-create-123" showDetails={true} />)

      expect(screen.getByText('Attempts:')).toBeInTheDocument()
      expect(screen.getByText('1 / 3')).toBeInTheDocument()
      expect(screen.getByText('Transaction:')).toBeInTheDocument()
      expect(screen.getByText('tx-hash-123')).toBeInTheDocument()
      expect(screen.getByText('Error:')).toBeInTheDocument()
      expect(screen.getByText('Connection timeout')).toBeInTheDocument()
      expect(screen.getByText('Recovered:')).toBeInTheDocument()
      expect(screen.getByText('From storage')).toBeInTheDocument()
    })

    it('hides details when showDetails is false', () => {
      const detailedOperation = {
        ...mockBondCreateOperation,
        finalTxHash: 'tx-hash-123',
        attempts: [
          {
            attemptId: 'attempt-1',
            timestamp: '2024-01-01T00:01:00.000Z',
            requestHash: 'hash-123',
            status: 'error',
            error: {
              type: 'network',
              message: 'Connection timeout',
              timestamp: '2024-01-01T00:01:00.000Z',
              retryable: true,
            },
          },
        ],
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(detailedOperation)

      render(<MutationTracker operationId="bond-create-123" showDetails={false} />)

      expect(screen.queryByText('Attempts:')).not.toBeInTheDocument()
      expect(screen.queryByText('Transaction:')).not.toBeInTheDocument()
    })
  })

  describe('real-time updates', () => {
    it('polls for updates when operation is active', async () => {
      let callCount = 0
      mockGetMutationOperation.mockImplementation(() => {
        callCount++
        if (callCount <= 2) {
          return {
            ...mockBondCreateOperation,
            status: 'submitting',
          }
        } else {
          return {
            ...mockBondCreateOperation,
            status: 'success',
            finalTxHash: 'completed-hash',
          }
        }
      })

      render(<MutationTracker operationId="bond-create-123" />)

      // Initially shows submitting
      expect(screen.getByText('Operation is in progress...')).toBeInTheDocument()

      // Wait for polling to detect completion
      await waitFor(
        () => {
          expect(screen.getByText(/completed/i)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      expect(callCount).toBeGreaterThan(2)
    })

    it('stops polling when operation completes', async () => {
      mockMutationStorage.getMutationOperation.mockReturnValue({
        ...mockBondCreateOperation,
        status: 'success',
      })

      render(<MutationTracker operationId="bond-create-123" />)

      const initialCallCount = mockGetMutationOperation.mock.calls.length

      // Wait a bit to ensure polling has stopped for completed operations
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const finalCallCount = mockGetMutationOperation.mock.calls.length

      // Should not have made many additional calls after completion
      expect(finalCallCount - initialCallCount).toBeLessThan(3)
    })
  })

  describe('callbacks', () => {
    it('calls onSuccess when operation succeeds', () => {
      const onSuccess = vi.fn()
      const successOperation = {
        ...mockBondCreateOperation,
        status: 'success',
      }

      // First render with pending, then update to success
      mockGetMutationOperation
        .mockReturnValueOnce(mockBondCreateOperation)
        .mockReturnValue(successOperation)

      const { rerender } = render(
        <MutationTracker operationId="bond-create-123" onSuccess={onSuccess} />
      )

      // Trigger re-render with success status
      rerender(<MutationTracker operationId="bond-create-123" onSuccess={onSuccess} />)

      expect(onSuccess).toHaveBeenCalledWith(successOperation)
      expect(onSuccess.mock.calls[0][0]).toMatchObject({
        correlationId: 'corr-bond-create-123',
        version: 1,
      })
    })

    it('calls onError when operation fails', () => {
      const onError = vi.fn()
      const errorOperation = {
        ...mockBondCreateOperation,
        status: 'error',
      }

      // First render with pending, then update to error
      mockGetMutationOperation
        .mockReturnValueOnce(mockBondCreateOperation)
        .mockReturnValue(errorOperation)

      const { rerender } = render(
        <MutationTracker operationId="bond-create-123" onError={onError} />
      )

      // Trigger re-render with error status
      rerender(<MutationTracker operationId="bond-create-123" onError={onError} />)

      expect(onError).toHaveBeenCalledWith(errorOperation)
      const payload = onError.mock.calls[0][0]
      expect(payload.status).toBe('error')
      expect(payload.finalTxHash).toBeUndefined()
      expect(payload.correlationId).toBe('corr-bond-create-123')
    })

    it('calls onCancel when operation is cancelled', () => {
      const onCancel = vi.fn()
      const cancelledOperation = {
        ...mockBondCreateOperation,
        status: 'cancelled',
      }

      // First render with pending, then update to cancelled
      mockGetMutationOperation
        .mockReturnValueOnce(mockBondCreateOperation)
        .mockReturnValue(cancelledOperation)

      const { rerender } = render(
        <MutationTracker operationId="bond-create-123" onCancel={onCancel} />
      )

      // Trigger re-render with cancelled status
      rerender(<MutationTracker operationId="bond-create-123" onCancel={onCancel} />)

      expect(onCancel).toHaveBeenCalledWith(cancelledOperation)
      const payload = onCancel.mock.calls[0][0]
      expect(payload.status).toBe('cancelled')
      expect(payload.finalTxHash).toBeUndefined()
      expect(payload.correlationId).toBe('corr-bond-create-123')
    })

    it('does not emit terminal events for pending operation', () => {
      const onSuccess = vi.fn()
      const onError = vi.fn()
      const onCancel = vi.fn()

      mockGetMutationOperation.mockReturnValue(mockBondCreateOperation)

      render(
        <MutationTracker
          operationId="bond-create-123"
          onSuccess={onSuccess}
          onError={onError}
          onCancel={onCancel}
        />
      )

      expect(onSuccess).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
      expect(onCancel).not.toHaveBeenCalled()
    })
  })

  describe('error states', () => {
    it('displays loading skeleton while operation is loading', () => {
      mockMutationStorage.getMutationOperation.mockReturnValue(null)

      render(<MutationTracker operationId="loading-op" />)

      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
    })

    it('displays error when operation not found', () => {
      mockMutationStorage.getMutationOperation.mockReturnValue(null)

      render(<MutationTracker operationId="non-existent" />)

      // Wait for loading to finish
      waitFor(() => {
        expect(screen.getByText('Operation Not Found')).toBeInTheDocument()
        expect(screen.getByText('The requested operation could not be found.')).toBeInTheDocument()
      })
    })
  })

  describe('accessibility', () => {
    it('provides proper ARIA attributes', () => {
      render(<MutationTracker operationId="bond-create-123" />)

      const tracker = screen.getByTestId('mutation-tracker')
      expect(tracker).toBeInTheDocument()

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label')
      })
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()

      const failedOperation = {
        ...mockBondCreateOperation,
        status: 'error',
        attempts: [
          {
            attemptId: 'attempt-1',
            timestamp: '2024-01-01T00:01:00.000Z',
            requestHash: 'hash-123',
            status: 'error',
            error: {
              type: 'network',
              message: 'Network error',
              timestamp: '2024-01-01T00:01:00.000Z',
              retryable: true,
            },
          },
        ],
      }

      mockMutationStorage.getMutationOperation.mockReturnValue(failedOperation)

      render(<MutationTracker operationId="bond-create-123" showControls={true} />)

      const retryButton = screen.getByRole('button', { name: 'Retry operation' })

      await user.tab()
      expect(retryButton).toHaveFocus()

      await user.keyboard('{Enter}')
      expect(mockMutationRecovery.retryMutation).toHaveBeenCalled()
    })
  })
})
