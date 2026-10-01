import { fireEvent, render, screen, act, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { lazy, Suspense, useEffect, useState } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import { DOM_EVENTS } from './events'
import { useWidgetCache } from './widgetCache'
import { useSettings } from './context/SettingsContext'
import { useToast } from './components/ToastProvider'
import { useWalletContext } from './context/WalletContext'

// ─── Wallet mock setup ───────────────────────────────────────────────────────
const mockWallet = {
  address: '',
  isConnected: false,
  isConnecting: false,
  error: null as { code: string; message: string } | null,
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(() => {}),
  network: 'public' as 'public' | 'test' | null,
}

vi.mock('./hooks/useWallet', () => ({
  useWallet: () => mockWallet,
}))

// ─── Mock page components to isolate App routing and boundary coverage ──────
vi.mock('./pages/Home', () => ({
  default: () => (
    <div className="home">
      <h1 className="home__title">Credence — Economic Trust</h1>
      <a href="/bond" role="button" className="home__cta">
        Create bond
      </a>
      <a href="/trust" role="button" className="home__cta">
        View trust score
      </a>
    </div>
  ),
}))

vi.mock('./pages/Settings', () => ({
  default: () => (
    <div>
      <h1>Settings</h1>
    </div>
  ),
}))

vi.mock('./pages/NotFound', () => ({
  default: () => (
    <div>
      <h1>Page Not Found</h1>
    </div>
  ),
}))

vi.mock('./pages/CreateBondPage', () => ({
  default: () => (
    <div>
      <h1>Create Bond</h1>
      <p>Step 1: Enter Bond Amount</p>
    </div>
  ),
}))

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
  mockWallet.address = ''
  mockWallet.isConnected = false
  mockWallet.isConnecting = false
  mockWallet.error = null
  mockWallet.network = 'public'
  vi.clearAllMocks()
})

function renderAppAt(path: string, props = {}) {
  window.history.pushState({}, '', path)
  return render(<App {...props} />)
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

// ─── 1. App routing & Core navigation ───────────────────────────────────────

describe('App routing & Core navigation', () => {
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

// ─── 2. Route-level loading states & boundaries ─────────────────────────────

describe('route-level loading skeleton & boundary', () => {
  it('shows the loading skeleton with accessible role while a lazy route is resolving', () => {
    const LazyPage = lazy(() => new Promise<{ default: React.ComponentType }>(() => {}))

    render(
      <MemoryRouter initialEntries={['/lazy-test']}>
        <Suspense
          fallback={
            <div role="status" aria-live="polite">
              Loading...
            </div>
          }
        >
          <Routes>
            <Route path="/lazy-test" element={<LazyPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    )

    const loadingElement = screen.getByRole('status')
    expect(loadingElement).toBeInTheDocument()
    expect(loadingElement).toHaveTextContent('Loading...')
    expect(loadingElement).toHaveAttribute('aria-live', 'polite')
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
        <Suspense
          fallback={
            <div role="status" aria-live="polite">
              Loading...
            </div>
          }
        >
          <Routes>
            <Route path="/lazy-test" element={<LazyPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()

    await act(async () => {
      resolveLazy({ default: () => <div>Lazy Content Loaded</div> })
    })

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
        <Suspense fallback={<div role="status">Loading...</div>}>
          <Routes>
            <Route path="/lazy-test" element={<LazyPage />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    )

    await act(async () => {
      resolveLazy({ default: () => <div>Clean Unmount</div> })
    })

    await waitFor(() => {
      expect(container.textContent).not.toContain('Loading...')
      expect(container.textContent).toContain('Clean Unmount')
    })
  })

  it('supports custom loadingFallback prop on App component', async () => {
    let resolveLazy!: (value: { default: React.ComponentType }) => void
    const LazyChild = lazy(
      () =>
        new Promise<{ default: React.ComponentType }>((resolve) => {
          resolveLazy = resolve
        })
    )

    render(
      <App loadingFallback={<div data-testid="custom-spinner">Custom App Loader</div>}>
        <LazyChild />
      </App>
    )

    expect(screen.getByTestId('custom-spinner')).toBeInTheDocument()
    expect(screen.getByText('Custom App Loader')).toBeInTheDocument()

    await act(async () => {
      resolveLazy({ default: () => <div>Resolved Custom Lazy Child</div> })
    })

    await waitFor(() => {
      expect(screen.queryByTestId('custom-spinner')).not.toBeInTheDocument()
      expect(screen.getByText('Resolved Custom Lazy Child')).toBeInTheDocument()
    })
  })

  it('handles rapid consecutive lazy route resolution without DOM corruption', async () => {
    let resolveSecond!: (value: { default: React.ComponentType }) => void

    const FirstLazy = lazy(() => new Promise<{ default: React.ComponentType }>(() => {}))
    const SecondLazy = lazy(
      () =>
        new Promise<{ default: React.ComponentType }>((resolve) => {
          resolveSecond = resolve
        })
    )

    function Switcher({ active }: { active: 'first' | 'second' }) {
      return <App>{active === 'first' ? <FirstLazy /> : <SecondLazy />}</App>
    }

    const { rerender } = render(<Switcher active="first" />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Immediately switch before first resolves
    rerender(<Switcher active="second" />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Resolve second
    await act(async () => {
      resolveSecond({ default: () => <div>Second Loaded</div> })
    })

    await waitFor(() => {
      expect(screen.getByText('Second Loaded')).toBeInTheDocument()
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
  })
})

// ─── 3. Error boundary catching inside App ───────────────────────────────────

describe('App ErrorBoundary catching & containment', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('catches synchronous render errors and renders the branded ErrorState fallback', async () => {
    const CrashChild = () => {
      throw new Error('Fatal render error in route component')
    }

    render(
      <App>
        <CrashChild />
      </App>
    )

    await waitFor(() => {
      const panel = screen.getByRole('alert')
      expect(panel).toBeInTheDocument()
      expect(panel).toHaveAttribute('data-error-kind', 'generic')
      expect(panel).toHaveAttribute('data-error-severity', 'danger')
      expect(panel).toHaveTextContent(/something went wrong/i)
    })

    // Branded whole-app-crash fallback action and home navigation escape hatch
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to home page/i })).toHaveAttribute('href', '/')
  })

  it('catches dynamic chunk load failure and classifies as network error', async () => {
    const FailingChunk = lazy(() => Promise.reject(new Error('Loading chunk 404 failed')))

    render(
      <App>
        <FailingChunk />
      </App>
    )

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('data-error-kind', 'network')
      expect(alert).toHaveAttribute('data-error-severity', 'danger')
      expect(alert).toHaveTextContent(/something went wrong/i)
    })

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('catches async state-update render throws inside App tree', async () => {
    const AsyncThrowChild = () => {
      const [hasError, setHasError] = useState(false)

      useEffect(() => {
        const timer = setTimeout(() => setHasError(true), 10)
        return () => clearTimeout(timer)
      }, [])

      if (hasError) {
        throw new Error('Async state update crashed render')
      }

      return <div>Normal Initial Content</div>
    }

    render(
      <App>
        <AsyncThrowChild />
      </App>
    )

    expect(screen.getByText('Normal Initial Content')).toBeInTheDocument()

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('data-error-kind', 'generic')
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })

  it('supports custom errorFallback prop and passes caught Error and reset handler', async () => {
    const CrashChild = () => {
      throw new Error('Specific custom boundary error message')
    }

    const customFallback = vi.fn((error: Error, reset: () => void) => (
      <div data-testid="custom-error-panel">
        <p>Error caught: {error.message}</p>
        <button onClick={reset}>Custom Reset</button>
      </div>
    ))

    render(
      <App errorFallback={customFallback}>
        <CrashChild />
      </App>
    )

    await waitFor(() => {
      expect(screen.getByTestId('custom-error-panel')).toBeInTheDocument()
    })

    expect(screen.getByText(/Specific custom boundary error message/)).toBeInTheDocument()
    expect(customFallback).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Specific custom boundary error message' }),
      expect.any(Function)
    )
  })
})

// ─── 4. Recovery & Retry mechanics ───────────────────────────────────────────

describe('App recovery & retry mechanics', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('resets ErrorBoundary and remounts successfully when transient error clears', async () => {
    let shouldCrash = true

    const TransientFlakyComponent = () => {
      if (shouldCrash) {
        throw new Error('Transient network timeout during render')
      }
      return <div data-testid="recovered-view">Successfully Recovered Subtree</div>
    }

    render(
      <App>
        <TransientFlakyComponent />
      </App>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Transient failure clears before retry
    shouldCrash = false
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByTestId('recovered-view')).toBeInTheDocument()
      expect(screen.getByText('Successfully Recovered Subtree')).toBeInTheDocument()
    })
  })

  it('re-catches persistent error deterministically across repeated retry attempts', async () => {
    let attempts = 0

    const PersistentCrashComponent = () => {
      attempts++
      throw new Error(`Persistent failure attempt #${attempts}`)
    }

    render(
      <App>
        <PersistentCrashComponent />
      </App>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(attempts).toBeGreaterThanOrEqual(1)

    // First retry
    const priorAttempts = attempts
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(attempts).toBeGreaterThan(priorAttempts)

    // Second retry
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })
})

// ─── 5. Stale state & User data preservation ─────────────────────────────────

describe('Stale state & User data preservation across boundaries', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('preserves WidgetCache data across ErrorBoundary crash and recovery', async () => {
    let shouldCrash = false

    function WidgetCacheUserComponent() {
      const widget = useWidgetCache('test:dashboard-metric', async () => ({
        trustScore: 780,
        tier: 'Platinum',
      }))

      if (shouldCrash) {
        throw new Error('Component crashed after reading cache')
      }

      return (
        <div>
          <span data-testid="cache-status">{widget.status}</span>
          {widget.data && <span data-testid="cached-trust-score">{widget.data.trustScore}</span>}
          <button onClick={() => widget.refresh()}>Refresh Widget</button>
        </div>
      )
    }

    const { rerender } = render(
      <App>
        <WidgetCacheUserComponent />
      </App>
    )

    // Wait for widget cache to populate
    await waitFor(() => {
      expect(screen.getByTestId('cached-trust-score')).toHaveTextContent('780')
    })

    // Now trigger a crash in the child route/component
    shouldCrash = true
    rerender(
      <App>
        <WidgetCacheUserComponent />
      </App>
    )

    // Error boundary caught the crash
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Resolve condition and click "Try again" to recover
    shouldCrash = false
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    // Verify widget cache was NOT wiped by the error boundary crash or recovery
    await waitFor(() => {
      expect(screen.getByTestId('cached-trust-score')).toHaveTextContent('780')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('preserves SettingsContext state across ErrorBoundary crash and recovery', async () => {
    let shouldCrash = false

    function SettingsConsumerComponent() {
      const { themeMode, setThemeMode } = useSettings()

      if (shouldCrash) {
        throw new Error('Settings consumer crashed')
      }

      return (
        <div>
          <span data-testid="current-theme">{themeMode}</span>
          <button onClick={() => setThemeMode('dark')}>Set Dark Mode</button>
        </div>
      )
    }

    const { rerender } = render(
      <App>
        <SettingsConsumerComponent />
      </App>
    )

    expect(screen.getByTestId('current-theme')).toBeInTheDocument()

    // Change settings
    fireEvent.click(screen.getByRole('button', { name: /set dark mode/i }))
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')

    // Simulate route crash
    shouldCrash = true
    rerender(
      <App>
        <SettingsConsumerComponent />
      </App>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Recover
    shouldCrash = false
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    // Theme setting is retained, not reset to default!
    await waitFor(() => {
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    })
  })

  it('allows ToastProvider notifications to dispatch and display through recovery', async () => {
    let shouldCrash = false

    function ToastTriggerComponent() {
      const { addToast } = useToast()

      if (shouldCrash) {
        throw new Error('Toast consumer crash')
      }

      return (
        <div>
          <button onClick={() => addToast('info', 'Recovery notification saved')}>
            Trigger Toast
          </button>
        </div>
      )
    }

    const { rerender } = render(
      <App>
        <ToastTriggerComponent />
      </App>
    )

    fireEvent.click(screen.getByRole('button', { name: /trigger toast/i }))
    expect(
      (await screen.findAllByText('Recovery notification saved')).length
    ).toBeGreaterThanOrEqual(1)

    // Crash and recover
    shouldCrash = true
    rerender(
      <App>
        <ToastTriggerComponent />
      </App>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    shouldCrash = false
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /trigger toast/i })).toBeInTheDocument()
    })

    // Able to trigger toasts after recovery
    fireEvent.click(screen.getByRole('button', { name: /trigger toast/i }))
    expect(
      (await screen.findAllByText('Recovery notification saved')).length
    ).toBeGreaterThanOrEqual(1)
  })
})

// ─── 6. Permission & Authorization states ────────────────────────────────────

describe('App permission & authorization states', () => {
  it('enforces disconnected wallet state deterministically in App tree', async () => {
    mockWallet.isConnected = false
    mockWallet.address = ''

    function WalletConsumerComponent() {
      const wallet = useWalletContext()
      return (
        <div>
          <span data-testid="is-connected">{String(wallet.isConnected)}</span>
          <span data-testid="wallet-address">{wallet.address || 'none'}</span>
          <button disabled={!wallet.isConnected} data-testid="guarded-action">
            Guarded Action
          </button>
        </div>
      )
    }

    render(
      <App>
        <WalletConsumerComponent />
      </App>
    )

    expect(screen.getByTestId('is-connected')).toHaveTextContent('false')
    expect(screen.getByTestId('wallet-address')).toHaveTextContent('none')
    expect(screen.getByTestId('guarded-action')).toBeDisabled()
  })

  it('updates guarded actions when wallet transitions to connected state without unmounting providers', async () => {
    mockWallet.isConnected = false
    mockWallet.address = ''

    function WalletConsumerComponent() {
      const wallet = useWalletContext()
      return (
        <div>
          <span data-testid="is-connected">{String(wallet.isConnected)}</span>
          <span data-testid="wallet-address">{wallet.address || 'none'}</span>
          <button disabled={!wallet.isConnected} data-testid="guarded-action">
            Guarded Action
          </button>
        </div>
      )
    }

    const { rerender } = render(
      <App>
        <WalletConsumerComponent />
      </App>
    )

    expect(screen.getByTestId('guarded-action')).toBeDisabled()

    // Transition to connected state
    mockWallet.isConnected = true
    mockWallet.address = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

    rerender(
      <App>
        <WalletConsumerComponent />
      </App>
    )

    expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
    expect(screen.getByTestId('wallet-address')).toHaveTextContent(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    )
    expect(screen.getByTestId('guarded-action')).not.toBeDisabled()
  })

  it('handles in-flight connecting state without corrupting session or data', async () => {
    mockWallet.isConnected = false
    mockWallet.isConnecting = true

    function WalletConnectingComponent() {
      const wallet = useWalletContext()
      return (
        <div>
          <span data-testid="is-connecting">{String(wallet.isConnecting)}</span>
          <span data-testid="is-connected">{String(wallet.isConnected)}</span>
        </div>
      )
    }

    render(
      <App>
        <WalletConnectingComponent />
      </App>
    )

    expect(screen.getByTestId('is-connecting')).toHaveTextContent('true')
    expect(screen.getByTestId('is-connected')).toHaveTextContent('false')
  })
})
