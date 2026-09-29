import { fireEvent, render, screen, act, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { lazy, Suspense } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import { DOM_EVENTS } from './events'

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
  sessionStorage.clear()
})

function renderAppAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

function createBeforeInstallPromptEvent() {
  const event = new Event(DOM_EVENTS.BEFORE_INSTALL_PROMPT) as Event & {
    preventDefault: () => void
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  event.preventDefault = vi.fn()
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome: 'dismissed' })

  return event
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

  it('shows the install prompt card once per session and respects dismissal', async () => {
    renderAppAt('/')

    expect(await screen.findByRole('link', { name: /credence/i })).toBeInTheDocument()

    window.dispatchEvent(createBeforeInstallPromptEvent())
    window.dispatchEvent(createBeforeInstallPromptEvent())

    expect(await screen.findByText(/Install Credence/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Install Credence/i)).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))

    expect(screen.queryByText(/Install Credence/i)).not.toBeInTheDocument()

    window.dispatchEvent(createBeforeInstallPromptEvent())

    expect(screen.queryByText(/Install Credence/i)).not.toBeInTheDocument()
  })
})

// ─── route-level loading skeleton ────────────────────────────────────────

describe('route-level loading skeleton', () => {
  it('shows the loading skeleton while a lazy route is being resolved', () => {
    let resolveLazy!: (value: { default: React.ComponentType }) => void
    const LazyPage = lazy(
      () =>
        new Promise<{ default: React.ComponentType }>((resolve) => {
          resolveLazy = resolve
        })
    )

    render(
      <MemoryRouter initialEntries={['/lazy-test']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/lazy-test" element={<LazyPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    )

    // The skeleton (fallback) should be visible while the module is pending
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('removes the loading skeleton after the lazy route resolves', async () => {
    let resolveLazy!: (value: { default: React.ComponentType }) => void
    const LazyPage = lazy(
      () =>
        new Promise<{ default: React.ComponentType }>((resolve) => {
          resolveLazy = resolve
        })
    )

    render(
      <MemoryRouter initialEntries={['/lazy-test']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/lazy-test" element={<LazyPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    )

    // Confirm skeleton is showing
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Resolve the lazy module
    await act(async () => {
      resolveLazy({ default: () => <div>Lazy Content Loaded</div> })
    })

    // Skeleton should be gone, loaded content should be visible
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      expect(screen.getByText('Lazy Content Loaded')).toBeInTheDocument()
    })
  })

  it('does not leave the loading skeleton in the DOM after a lazy route resolves', async () => {
    let resolveLazy!: (value: { default: React.ComponentType }) => void
    const LazyPage = lazy(
      () =>
        new Promise<{ default: React.ComponentType }>((resolve) => {
          resolveLazy = resolve
        })
    )

    const { container } = render(
      <MemoryRouter initialEntries={['/lazy-test']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/lazy-test" element={<LazyPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    )

    // Resolve the lazy module
    await act(async () => {
      resolveLazy({ default: () => <div>Clean Unmount</div> })
    })

    await waitFor(() => {
      // The fallback text must not appear anywhere in the DOM
      expect(container.textContent).not.toContain('Loading...')
      // The loaded content should be present
      expect(container.textContent).toContain('Clean Unmount')
    })
  })
})