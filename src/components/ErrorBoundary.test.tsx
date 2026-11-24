import { lazy, Suspense } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

const captureExceptionMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/errorReporting', () => ({
  captureException: captureExceptionMock,
  initErrorReporting: vi.fn(),
}))

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

  it.each([
    'Loading chunk 123 failed',
    'Failed to load dynamically imported module',
    'Loading module failed',
    'Dynamically imported route failed',
    'Failed to fetch route module',
    'Import(./route) failed',
    'Network error while loading route',
    'chunk-load failed',
  ])('classifies network loading failure: %s', async (message) => {
    const FailChild = () => {
      throw new Error(message)
    }

    render(
      <ErrorBoundary>
        <FailChild />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveAttribute('data-error-kind', 'network')
    })
  })

  it('keeps ordinary errors mentioning a chunk generic and isolates the failed subtree', async () => {
    const FailChild = () => {
      throw new Error('Invalid chunk of user input')
    }

    render(
      <>
        <ErrorBoundary>
          <FailChild />
        </ErrorBoundary>
        <p>Unaffected sibling</p>
      </>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveAttribute('data-error-kind', 'generic')
    })
    expect(screen.getByText('Unaffected sibling')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to home page/i })).toHaveAttribute('href', '/')
  })

  it('displays a copyable correlation error id with feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    const FailChild = () => {
      throw new Error('Unexpected render crash')
    }

    render(
      <ErrorBoundary>
        <FailChild />
      </ErrorBoundary>
    )

    const idEl = await screen.findByTestId('error-boundary-id')
    const errorId = idEl.textContent ?? ''
    expect(errorId).toMatch(/^err-[a-z0-9]+-[a-z0-9]+$/i)

    const copyBtn = screen.getByRole('button', { name: /copy error id/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(errorId)
      expect(copyBtn).toHaveTextContent(/copied/i)
    })
  })

  it('keeps the error id stable across parent re-renders and clears it on reset', async () => {
    let shouldThrow = true
    const FlakyChild = ({ tick }: { tick: number }) => {
      if (shouldThrow) {
        throw new Error(`Crash on tick ${tick}`)
      }
      return <div>Healthy tick {tick}</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <FlakyChild tick={1} />
      </ErrorBoundary>
    )

    const initialId = (await screen.findByTestId('error-boundary-id')).textContent
    expect(initialId).toMatch(/^err-/)

    // Re-render parent while boundary is in error state — id must remain identical
    rerender(
      <ErrorBoundary>
        <FlakyChild tick={2} />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('error-boundary-id').textContent).toBe(initialId)

    // Reset clears the error state and id
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() => {
      expect(screen.getByText('Healthy tick 2')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('error-boundary-id')).not.toBeInTheDocument()
  })

  it('renders collapsed technical details with PII and address-like substrings scrubbed and no stack trace', async () => {
    const stellarAddr = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
    const hexAddr = '0x1234567890abcdef1234567890abcdef12345678'
    const email = 'alice@example.com'

    const FailChild = () => {
      const err = new Error(`Failed for ${stellarAddr}, ${hexAddr}, and ${email}`)
      err.stack = 'Error: secret stack\n    at SensitiveInternalFn (secret.ts:42:1)'
      throw err
    }

    render(
      <ErrorBoundary>
        <FailChild />
      </ErrorBoundary>
    )

    const summary = await screen.findByText(/technical details/i)
    const details = summary.closest('details')
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute('open')

    const messageEl = screen.getByTestId('error-boundary-message')
    expect(messageEl.textContent).toContain('[REDACTED]')
    expect(messageEl.textContent).not.toContain(stellarAddr)
    expect(messageEl.textContent).not.toContain(hexAddr)
    expect(messageEl.textContent).not.toContain(email)
    expect(document.body.textContent).not.toContain('SensitiveInternalFn')
  })
})

describe('ErrorBoundary error reporting', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    captureExceptionMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports caught render errors through captureException', async () => {
    const FailChild = () => {
      throw new Error('render exploded')
    }

    render(
      <ErrorBoundary>
        <FailChild />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(captureExceptionMock).toHaveBeenCalledTimes(1)
    })

    const [error, context] = captureExceptionMock.mock.calls[0] as [Error, Record<string, unknown>]
    expect(error.message).toBe('render exploded')
    expect(context).toMatchObject({
      source: 'ErrorBoundary',
      kind: 'generic',
      severity: 'danger',
      retryCount: 0,
      exhausted: false,
    })
  })

  it('still renders the fallback when reporting throws', async () => {
    captureExceptionMock.mockImplementationOnce(() => {
      throw new Error('reporter unavailable')
    })

    const FailChild = () => {
      throw new Error('render exploded')
    }

    render(
      <ErrorBoundary>
        <FailChild />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveAttribute('data-error-kind', 'generic')
    })
  })
})
