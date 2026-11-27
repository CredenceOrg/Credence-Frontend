import React, { Suspense } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet, useNavigate } from 'react-router-dom'
import { useRouteFocus } from './useRouteFocus'
import { ANNOUNCE_DELAY_MS } from '../components/RouteAnnouncer'

function Shell() {
  useRouteFocus()
  return (
    <div>
      <header>
        <button type="button" id="header-btn">Header Button</button>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
    </div>
  )
}

function HomePage() {
  return (
    <div>
      <h1>Home</h1>
      <p>Welcome home</p>
    </div>
  )
}

function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <input id="settings-input" placeholder="Type here" />
    </div>
  )
}

function NoHeadingPage() {
  return (
    <div>
      <p>Page without an h1 heading</p>
    </div>
  )
}

// Navigator helper to trigger transitions from inside router context
let globalNavigate: ReturnType<typeof useNavigate>

function NavigationController() {
  globalNavigate = useNavigate()
  return null
}

describe('useRouteFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initial render does not move focus', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<HomePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    // Ensure focus is on body initially
    document.body.focus()

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS * 2)
    })

    const heading = screen.getByRole('heading', { level: 1, name: 'Home' })
    expect(document.activeElement).not.toBe(heading)
    expect(document.activeElement).toBe(document.body)
  })

  it('navigating / → /settings focuses the h1 "Settings"', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavigationController />
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)
    })

    // Navigate to /settings
    act(() => {
      globalNavigate('/settings')
    })

    // Heading should not be focused immediately before delayMs
    const settingsHeading = screen.getByRole('heading', { level: 1, name: 'Settings' })
    expect(document.activeElement).not.toBe(settingsHeading)

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)
    })

    expect(settingsHeading).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement).toBe(settingsHeading)
  })

  it('?tab=x changes do not move focus', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <NavigationController />
        <Routes>
          <Route element={<Shell />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)
    })

    // Focus the input inside settings
    const input = screen.getByPlaceholderText('Type here')
    input.focus()
    expect(document.activeElement).toBe(input)

    // Change only the search params (?tab=notifications)
    act(() => {
      globalNavigate('/settings?tab=notifications')
    })

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS * 2)
    })

    // Focus must NOT have moved away from the input to the h1
    const heading = screen.getByRole('heading', { level: 1, name: 'Settings' })
    expect(document.activeElement).not.toBe(heading)
    expect(document.activeElement).toBe(input)
  })

  it('a page without h1 focuses #main-content', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavigationController />
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/no-heading" element={<NoHeadingPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)
    })

    act(() => {
      globalNavigate('/no-heading')
    })

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)
    })

    const main = document.getElementById('main-content')
    expect(main).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement).toBe(main)
  })

  it('navigating to a route that suspends first still ends with focus on its h1, not <body>', async () => {
    let resolveLazyPromise!: (component: { default: React.ComponentType }) => void
    const lazyPromise = new Promise<{ default: React.ComponentType }>((resolve) => {
      resolveLazyPromise = resolve
    })

    const LazyComponent = React.lazy(() => lazyPromise)

    function LazyPageWrapper() {
      return (
        <Suspense fallback={<div data-testid="fallback">Loading route...</div>}>
          <LazyComponent />
        </Suspense>
      )
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <NavigationController />
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/lazy" element={<LazyPageWrapper />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)
    })

    // Focus a button in the header before navigating to simulate user clicking link
    const headerBtn = document.getElementById('header-btn')!
    headerBtn.focus()
    expect(document.activeElement).toBe(headerBtn)

    // Navigate to lazy route
    act(() => {
      globalNavigate('/lazy')
    })

    // During suspension, fallback is displayed
    expect(screen.getByTestId('fallback')).toBeInTheDocument()

    // Advance by the normal route announcer delay (route is still suspended)
    act(() => {
      vi.advanceTimersByTime(ANNOUNCE_DELAY_MS)
    })

    // Now resolve the lazy chunk promise
    await act(async () => {
      resolveLazyPromise({
        default: function LoadedLazyPage() {
          return (
            <div>
              <h1>Lazy Heading</h1>
              <p>Loaded successfully</p>
            </div>
          )
        },
      })
    })

    const lazyHeading = screen.getByRole('heading', { level: 1, name: 'Lazy Heading' })
    expect(lazyHeading).toBeInTheDocument()
    expect(lazyHeading).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement).toBe(lazyHeading)
    expect(document.activeElement).not.toBe(document.body)
  })
})
