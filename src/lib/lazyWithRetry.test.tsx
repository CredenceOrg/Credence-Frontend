import { Suspense } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { lazyWithRetry, CHUNK_RELOAD_STORAGE_KEY } from './lazyWithRetry'
import ErrorBoundary from '../components/ErrorBoundary'

describe('lazyWithRetry', () => {
  let originalLocation: Location

  beforeEach(() => {
    sessionStorage.clear()
    originalLocation = window.location
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
    vi.restoreAllMocks()
  })

  it('The factory rejects once and then resolves → after reset, the component renders, and the factory was called 2 times', async () => {
    let callCount = 0
    const factory = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new Error('Failed to fetch dynamically imported module'))
      }
      return Promise.resolve({
        default: () => <div>Successfully loaded component</div>,
      })
    })

    const LazyComponent = lazyWithRetry(factory)

    render(
      <ErrorBoundary>
        <Suspense fallback={<div>Loading chunk...</div>}>
          <LazyComponent />
        </Suspense>
      </ErrorBoundary>
    )

    // Wait for the failure to be caught by ErrorBoundary
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(callCount).toBe(1)
    expect(screen.queryByText('Successfully loaded component')).not.toBeInTheDocument()

    // Reset the boundary via "Try again"
    const tryAgainBtn = screen.getByRole('button', { name: /try again/i })
    fireEvent.click(tryAgainBtn)

    // After reset, the component renders successfully and factory was called 2 times
    await waitFor(() => {
      expect(screen.getByText('Successfully loaded component')).toBeInTheDocument()
    })
    expect(callCount).toBe(2)
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('The factory always rejects → after 2 attempts, "Reload page" is offered, and clicking it calls a stubbed window.location.reload once. A second mount within the same session does not auto-reload again', async () => {
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        reload: reloadMock,
      },
    })

    const factory = vi.fn().mockRejectedValue(new Error('Failed to fetch dynamically imported module'))
    const FailingComponent = lazyWithRetry(factory)

    const { unmount } = render(
      <ErrorBoundary maxRetries={2}>
        <Suspense fallback={<div>Loading chunk...</div>}>
          <FailingComponent />
        </Suspense>
      </ErrorBoundary>
    )

    // Initial mount failure
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // 1st retry attempt
    const tryAgain1 = screen.getByRole('button', { name: /try again/i })
    fireEvent.click(tryAgain1)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // 2nd retry attempt
    const tryAgain2 = screen.getByRole('button', { name: /try again/i })
    fireEvent.click(tryAgain2)

    // After 2 retry attempts, "Reload page" is offered
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()

    // Clicking "Reload page" calls stubbed window.location.reload once
    const reloadButton = screen.getByRole('button', { name: /reload page/i })
    fireEvent.click(reloadButton)

    expect(reloadMock).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)).toBe('true')

    // Subsequent clicks within the session do not trigger reload again
    fireEvent.click(reloadButton)
    expect(reloadMock).toHaveBeenCalledTimes(1)

    // Unmount and re-mount second time within the same session
    unmount()

    render(
      <ErrorBoundary maxRetries={2}>
        <Suspense fallback={<div>Loading chunk...</div>}>
          <FailingComponent />
        </Suspense>
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Does not auto-reload again
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })
})
