import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function GoodChild() {
  return <div>Normal content</div>
}

function BadChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('test render error')
  return <div>Recovered content</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress React's console.error noise for expected thrown errors.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('happy path — no error', () => {
    it('renders children when nothing throws', () => {
      render(
        <ErrorBoundary>
          <GoodChild />
        </ErrorBoundary>
      )
      expect(screen.getByText('Normal content')).toBeInTheDocument()
    })

    it('does not render the fallback when nothing throws', () => {
      render(
        <ErrorBoundary>
          <GoodChild />
        </ErrorBoundary>
      )
      expect(screen.queryByRole('heading', { name: /something went wrong/i })).toBeNull()
    })
  })

  describe('error path — child throws', () => {
    it('shows the ErrorState heading when a child throws', () => {
      render(
        <ErrorBoundary>
          <BadChild shouldThrow />
        </ErrorBoundary>
      )
      expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    })

    it('hides children content after a throw', () => {
      render(
        <ErrorBoundary>
          <BadChild shouldThrow />
        </ErrorBoundary>
      )
      expect(screen.queryByText('Normal content')).toBeNull()
    })

    it('renders a "Try again" button', () => {
      render(
        <ErrorBoundary>
          <BadChild shouldThrow />
        </ErrorBoundary>
      )
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('renders a "Go to home page" link', () => {
      render(
        <ErrorBoundary>
          <BadChild shouldThrow />
        </ErrorBoundary>
      )
      const link = screen.getByRole('link', { name: /go to home page/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/')
    })

    it('logs via console.error on catch', () => {
      render(
        <ErrorBoundary>
          <BadChild shouldThrow />
        </ErrorBoundary>
      )
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('retry — clears error state without hard reload', () => {
    it('re-renders children after retry when they no longer throw', () => {
      let shouldThrow = true

      function MaybeThrow() {
        if (shouldThrow) throw new Error('transient error')
        return <div>Recovered content</div>
      }

      render(
        <ErrorBoundary>
          <MaybeThrow />
        </ErrorBoundary>
      )

      expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()

      shouldThrow = false
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))

      expect(screen.getByText('Recovered content')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /something went wrong/i })).toBeNull()
    })

    it('catches again if the child still throws after retry', () => {
      render(
        <ErrorBoundary>
          <BadChild shouldThrow />
        </ErrorBoundary>
      )

      fireEvent.click(screen.getByRole('button', { name: /try again/i }))

      // Child still throws — boundary should catch again
      expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    })
  })

  describe('custom fallback prop', () => {
    it('calls the fallback render prop with the caught error', () => {
      const customFallback = vi.fn((_err: Error, _reset: () => void) => (
        <div>Custom fallback UI</div>
      ))

      render(
        <ErrorBoundary fallback={customFallback}>
          <BadChild shouldThrow />
        </ErrorBoundary>
      )

      expect(customFallback).toHaveBeenCalled()
      expect(customFallback.mock.calls[0][0]).toBeInstanceOf(Error)
      expect(screen.getByText('Custom fallback UI')).toBeInTheDocument()
    })

    it('passes a working reset callback to the custom fallback', () => {
      let shouldThrow = true

      function MaybeThrow() {
        if (shouldThrow) throw new Error('custom boundary error')
        return <div>Custom recovered</div>
      }

      render(
        <ErrorBoundary
          fallback={(_err, reset) => (
            <button onClick={reset}>Custom retry</button>
          )}
        >
          <MaybeThrow />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: /custom retry/i })).toBeInTheDocument()

      shouldThrow = false
      fireEvent.click(screen.getByRole('button', { name: /custom retry/i }))

      expect(screen.getByText('Custom recovered')).toBeInTheDocument()
    })
  })
})
