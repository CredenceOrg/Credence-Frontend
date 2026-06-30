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
      expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('ErrorBoundary catches lazy-loaded component mount errors and shows error state', async () => {
    const LazyFailComponent = () => {
      throw new Error('Failed to load lazy component')
    }
    
    render(
      <ErrorBoundary>
        <LazyFailComponent />
      </ErrorBoundary>
    )
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    })
  })

  it('ErrorBoundary allows retry after component succeeds on reset', async () => {
    let attempts = 0
    
    const FlakyComponent = () => {
      attempts++
      if (attempts === 1) {
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
      expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    
    await waitFor(() => {
      expect(screen.getByText('Recovered content')).toBeInTheDocument()
    })
  })
})