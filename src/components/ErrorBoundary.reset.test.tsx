import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

describe('ErrorBoundary reset functionality', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('changing resetKey after an error re-renders the children', async () => {
    function FlakyChild({ shouldThrow }: { shouldThrow: boolean }) {
      if (shouldThrow) {
        throw new Error('Failure on initial key')
      }
      return <div>Healthy content on new key</div>
    }

    const { rerender } = render(
      <ErrorBoundary resetKey="/page-1">
        <FlakyChild shouldThrow={true} />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
    expect(screen.queryByText('Healthy content on new key')).not.toBeInTheDocument()

    // Changing resetKey clears the error and re-renders children
    rerender(
      <ErrorBoundary resetKey="/page-2">
        <FlakyChild shouldThrow={false} />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByText('Healthy content on new key')).toBeInTheDocument()
    })
  })

  it('resets the retry budget per key so each key gets a fresh budget', async () => {
    let attemptsOnKey1 = 0
    let attemptsOnKey2 = 0

    function ThrowingChild({ currentKey }: { currentKey: string }) {
      if (currentKey === 'key-1') {
        attemptsOnKey1++
        throw new Error(`Key 1 attempt ${attemptsOnKey1}`)
      }
      attemptsOnKey2++
      throw new Error(`Key 2 attempt ${attemptsOnKey2}`)
    }

    // maxRetries = 2: initial crash, retry 1, retry 2 -> terminal
    const { rerender } = render(
      <ErrorBoundary maxRetries={2} resetKey="key-1">
        <ThrowingChild currentKey="key-1" />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(attemptsOnKey1).toBeGreaterThanOrEqual(1)

    // First retry on key-1
    const attemptsBeforeRetry1 = attemptsOnKey1
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(attemptsOnKey1).toBeGreaterThan(attemptsBeforeRetry1)

    // Second retry on key-1 (exhausts budget)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      // Once budget is exhausted, terminal state is shown (no "Try again" button)
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
    })

    // Now change resetKey to key-2: budget should be completely fresh
    rerender(
      <ErrorBoundary maxRetries={2} resetKey="key-2">
        <ThrowingChild currentKey="key-2" />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      // "Try again" is available again because retryCount was reset to 0
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
    expect(attemptsOnKey2).toBeGreaterThanOrEqual(1)

    // Able to retry again on key-2 with the fresh budget
    const attemptsBeforeKey2Retry = attemptsOnKey2
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(attemptsOnKey2).toBeGreaterThan(attemptsBeforeKey2Retry)
  })

  it('supports resetKeys array prop for resetting on multiple dependencies', async () => {
    function DynamicChild({ value }: { value: number }) {
      if (value < 10) {
        throw new Error('Value too small')
      }
      return <div>Value is {value}</div>
    }

    const { rerender } = render(
      <ErrorBoundary resetKeys={['paramA', 5]}>
        <DynamicChild value={5} />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Changing one element of resetKeys triggers reset
    rerender(
      <ErrorBoundary resetKeys={['paramA', 20]}>
        <DynamicChild value={20} />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByText('Value is 20')).toBeInTheDocument()
    })
  })
})
