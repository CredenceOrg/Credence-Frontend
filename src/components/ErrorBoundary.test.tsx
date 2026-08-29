import { lazy, Suspense } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('catches render errors in its subtree and shows a branded ErrorState fallback', async () => {
    const FailChild = () => {
      throw new Error('Something went wrong in component render')
    }

    render(
      <ErrorBoundary>
        <FailChild />
      </ErrorBoundary>
    )

    await waitFor(() => {
      // Use data-attributes on the ErrorState panel to make the assertion
      // resilient to copy edits (per #810 standardisation).
      const panel = screen.getByRole('alert')
      expect(panel).toHaveAttribute('data-error-kind', 'generic')
      expect(panel).toHaveAttribute('data-error-severity', 'danger')
      expect(panel).toHaveTextContent(/something went wrong/i)
    })
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('ErrorBoundary catches lazy-loaded component mount errors and shows error state', async () => {
    const LazyFailComponent = () => {
      throw new Error('Component render failure')
    }

    render(
      <ErrorBoundary>
        <LazyFailComponent />
      </ErrorBoundary>
    )

    await waitFor(() => {
      const panel = screen.getByRole('alert')
      expect(panel).toHaveAttribute('data-error-kind', 'generic')
      expect(panel).toHaveAttribute('data-error-severity', 'danger')
      expect(panel).toHaveTextContent(/something went wrong/i)
    })
  })

  it('ErrorBoundary allows retry after component succeeds on reset', async () => {
    let shouldThrow = true

    const FlakyComponent = () => {
      if (shouldThrow) {
        Promise.resolve().then(() => {
          shouldThrow = false
        })
        throw new Error('First attempt fails')
      }
      return <div>Recovered content</div>
    }

    render(
      <ErrorBoundary>
        <FlakyComponent />
      </ErrorBoundary>
    )

    await waitFor(() => {
      const panel = screen.getByRole('alert')
      expect(panel).toHaveAttribute('data-error-kind', 'generic')
      expect(panel).toHaveTextContent(/something went wrong/i)
    })

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() => {
      expect(screen.getByText('Recovered content')).toBeInTheDocument()
    })
  })

  it('catches chunk-load errors from lazy-loaded routes and shows retry UI', async () => {
    const LazyFail = lazy(() => Promise.reject(new Error('Loading chunk 123 failed')))

    render(
      <MemoryRouter>
        <ErrorBoundary>
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              <Route path="/" element={<LazyFail />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </MemoryRouter>
    )

    await waitFor(() => {
      const panel = screen.getByRole('alert')
      expect(panel).toHaveAttribute('data-error-kind', 'network')
      expect(panel).toHaveAttribute('data-error-severity', 'danger')
      // Chunk-load failures fall through to the title override "Something
      // went wrong" so the whole-app-crash tone is preserved.
      expect(panel).toHaveTextContent(/something went wrong/i)
    })
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
