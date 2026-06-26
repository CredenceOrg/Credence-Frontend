import { lazy, Suspense } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { LazyRouteBoundary } from './App'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

beforeEach(() => {
  localStorage.clear()
})

function renderAppAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('App routing', () => {
  it('renders the Settings page at /settings', async () => {
    renderAppAt('/settings')

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /page not found/i })).not.toBeInTheDocument()
  })

  it('keeps unknown routes wired to NotFound', async () => {
    renderAppAt('/missing-route')

    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('renders the CreateBondFlow wizard at /bond/new', async () => {
    renderAppAt('/bond/new')

    expect(await screen.findByRole('heading', { name: /^Create Bond$/i })).toBeInTheDocument()
    expect(await screen.findByText(/Step 1: Enter Bond Amount/i)).toBeInTheDocument()
  })
})

describe('lazy route error handling', () => {
  it('renders a retry UI for a failed lazy route and retries with a fresh import', async () => {
    let attempts = 0

    function RetryableLazyRoute({ retryKey }: { retryKey: number }) {
      const Page = lazy(async () => {
        attempts += 1

        if (attempts === 1) {
          throw new Error('Failed to fetch dynamically imported module')
        }

        return { default: () => <h1>Recovered route</h1> }
      })

      return (
        <Suspense fallback={<div>Loading route...</div>}>
          <Page key={retryKey} />
        </Suspense>
      )
    }

    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <LazyRouteBoundary>
          {(retryKey) => <RetryableLazyRoute retryKey={retryKey} />}
        </LazyRouteBoundary>
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: /page failed to load/i })).toBeInTheDocument()
    expect(screen.getByText(/page bundle could not be loaded/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByRole('heading', { name: /recovered route/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /page failed to load/i })).not.toBeInTheDocument()
    expect(attempts).toBe(2)
  })
})
